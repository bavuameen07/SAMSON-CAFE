"use client";

import { formatDateTime, formatMoney } from "@/lib/format";
import type { DisplaySettings, Order } from "@/lib/types";
import { textButtonClasses } from "@/components/ui/button";
import { PaymentBadge } from "./badges";
import { EmptyTable } from "./section";

type OrdersTableProps = {
  orders: Order[];
  settings: DisplaySettings;
  showActions?: boolean;
  onView?: (orderId: string) => void;
};

const HEADINGS = ["Order ID", "Item", "Item ID", "Quantity", "Total", "Date & time", "Payment"];

const CELL = "border-b border-[#eff0f2] px-[11px] py-3";

export function OrdersTable({ orders, settings, showActions = false, onView }: OrdersTableProps) {
  if (orders.length === 0) {
    return <EmptyTable>No orders found. Use Refresh Orders to fetch the latest rows.</EmptyTable>;
  }

  const headings = showActions ? [...HEADINGS, "Action"] : HEADINGS;

  return (
    <div className="w-full overflow-auto">
      <table className="w-full border-collapse text-left text-xs whitespace-nowrap">
        <thead>
          <tr>
            {headings.map((heading) => (
              <th
                key={heading}
                className={`${CELL} bg-[#fafafa] text-[10px] font-bold tracking-[.08em] text-[#888] uppercase`}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="last:[&>td]:border-b-0">
              <td className={CELL}>
                <strong>{order.id}</strong>
              </td>
              <td className={CELL}>{order.itemName}</td>
              <td className={CELL}>{order.itemId}</td>
              <td className={CELL}>{order.quantity}</td>
              <td className={CELL}>{formatMoney(order.total, settings.currency)}</td>
              <td className={CELL}>{formatDateTime(order.date, settings.timezone)}</td>
              <td className={CELL}>
                <PaymentBadge status={order.status} />
              </td>
              {showActions ? (
                <td className={CELL}>
                  <button
                    type="button"
                    onClick={() => onView?.(order.id)}
                    className={textButtonClasses()}
                  >
                    VIEW
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
