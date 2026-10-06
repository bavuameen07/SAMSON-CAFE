import type { Metadata } from "next";
import Link from "next/link";
import { AdminErrorState } from "@/components/admin/error-state";
import { OrdersTable } from "@/components/admin/orders-table";
import { AdminCard, AdminHeading, EmptyTable, StatGrid, type Stat } from "@/components/admin/section";
import { textButtonClasses } from "@/components/ui/button";
import { loadAdminData } from "@/lib/data";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminDashboardPage() {
  const { orders, stats, settings, connected, error } = await loadAdminData();

  if (!connected) {
    return <AdminErrorState message={error ?? "Admin data could not be loaded."} />;
  }

  // Every figure below comes from the backend's `adminStats` action, so the
  // overview always reports what the sheet actually says rather than a count
  // made here that could disagree with it.
  const summary = stats ?? {
    totalItems: 0,
    totalStock: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    totalOrders: 0,
    pendingOrders: 0,
    paidOrders: 0,
    cancelledOrders: 0,
    failedOrders: 0,
    totalSales: 0,
  };

  const statList: Stat[] = [
    ["Total items", String(summary.totalItems), "Products on your menu"],
    ["Total stock", String(summary.totalStock), "Units across all items"],
    ["Low stock", String(summary.lowStockItems), "At or below threshold"],
    ["Out of stock", String(summary.outOfStockItems), "Nothing left to sell"],
    ["Total orders", String(summary.totalOrders), "All recorded orders"],
    ["Pending orders", String(summary.pendingOrders), "Awaiting payment"],
    ["Paid orders", String(summary.paidOrders), "Payment received"],
    ["Cancelled orders", String(summary.cancelledOrders), "No longer going ahead"],
    ["Total sales", formatMoney(summary.totalSales, settings.currency), "From paid orders"],
  ];

  return (
    <>
      <AdminHeading title="Good day, cafe team" description="Here’s how Samson Cafe is doing today." />
      <StatGrid stats={statList} />

      <AdminCard title="Recent orders">
        {orders.length === 0 ? (
          <EmptyTable>Your new orders will appear here.</EmptyTable>
        ) : (
          <>
            <OrdersTable orders={orders.slice(0, 6)} settings={settings} />
            <div className="mt-[13px]">
              <Link href="/admin/orders" className={textButtonClasses()}>
                VIEW ALL ORDERS →
              </Link>
            </div>
          </>
        )}
      </AdminCard>
    </>
  );
}
