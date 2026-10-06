"use client";

import { useMemo, useState, useTransition } from "react";
import { updatePaymentAction } from "@/app/actions";
import { RefreshButton } from "@/components/refresh-button";
import { buttonClasses } from "@/components/ui/button";
import { toolbarControlClasses, toolbarSearchClasses, labelClasses } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Toast, useToast } from "@/components/ui/toast";
import { formatDateTime, formatMoney, dateValue, isoDay } from "@/lib/format";
import { ORDER_STATUSES, type DisplaySettings, type Order, type OrderStatus } from "@/lib/types";
import { PaymentBadge } from "./badges";
import { OrdersTable } from "./orders-table";
import { AdminCard, AdminHeading } from "./section";

type OrdersManagerProps = {
  orders: Order[];
  settings: DisplaySettings;
};

export function OrdersManager({ orders, settings }: OrdersManagerProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [sort, setSort] = useState("newest");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { toast, showToast } = useToast();

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = orders.filter((order) => {
      if (needle && !`${order.id} ${order.itemId} ${order.itemName}`.toLowerCase().includes(needle)) {
        return false;
      }
      if (status && order.status !== status) return false;
      if (date && isoDay(order.date, settings.timezone) !== date) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      const delta = dateValue(a.date) - dateValue(b.date);
      return sort === "oldest" ? delta : -delta;
    });
  }, [orders, query, status, date, sort, settings.timezone]);

  const selected = selectedId ? (orders.find((order) => order.id === selectedId) ?? null) : null;

  function changePayment(order: Order, next: OrderStatus) {
    startTransition(async () => {
      const result = await updatePaymentAction(order.id, order.itemId, next);
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      setSelectedId(null);
      showToast(`Payment marked ${next.toLowerCase()}.`);
    });
  }

  return (
    <>
      <AdminHeading
        title="Orders"
        description="Orders are read live from your Orders sheet."
        action={
          <RefreshButton variant="admin" label="REFRESH ORDERS" pendingLabel="REFRESHING…" />
        }
      />

      <AdminCard
        toolbar={
          <>
            <input
              type="search"
              placeholder="Search order or item ID…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={toolbarSearchClasses}
            />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Filter by payment status"
              className={toolbarControlClasses}
            >
              <option value="">All payment statuses</option>
              {ORDER_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              aria-label="Filter by date"
              className={toolbarControlClasses}
            />
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              aria-label="Sort orders"
              className={toolbarControlClasses}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </>
        }
      >
        <OrdersTable orders={rows} settings={settings} showActions onView={setSelectedId} />
      </AdminCard>

      {selected ? (
        <OrderDetailsModal
          order={selected}
          settings={settings}
          pending={pending}
          onClose={() => setSelectedId(null)}
          onPayment={(next) => changePayment(selected, next)}
        />
      ) : null}

      <Toast toast={toast} />
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[7px] bg-[#faf8f5] p-[10px]">
      <small className="mb-1 block text-muted">{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

type OrderDetailsModalProps = {
  order: Order;
  settings: DisplaySettings;
  pending: boolean;
  onClose: () => void;
  onPayment: (status: OrderStatus) => void;
};

function OrderDetailsModal({
  order,
  settings,
  pending,
  onClose,
  onPayment,
}: OrderDetailsModalProps) {
  return (
    <Modal
      title="Order details"
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className={buttonClasses("adminLight")}>
          CLOSE
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-[10px] text-[13px]">
        <Detail label="Order ID" value={order.id} />
        <Detail label="Item ID" value={order.itemId} />
        <Detail label="Product" value={order.itemName || order.itemId} />
        <Detail label="Quantity" value={String(order.quantity)} />
        <Detail label="Total amount" value={formatMoney(order.total, settings.currency)} />
        <Detail label="Date and time" value={formatDateTime(order.date, settings.timezone)} />
        <div className="rounded-[7px] bg-[#faf8f5] p-[10px]">
          <small className="mb-1 block text-muted">Payment status</small>
          <PaymentBadge status={order.status} />
        </div>
      </div>

      <div className="mt-[14px] flex flex-col gap-[7px] border-t border-[#eff0f2] pt-[14px]">
        <label htmlFor="payment-status" className={labelClasses}>
          Set payment status
        </label>
        <div className="flex flex-wrap gap-[7px]">
          {ORDER_STATUSES.map((value) => {
            const active = order.status === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onPayment(value)}
                disabled={pending || active}
                aria-pressed={active}
                className={buttonClasses(active ? "admin" : "adminLight")}
              >
                {value.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
