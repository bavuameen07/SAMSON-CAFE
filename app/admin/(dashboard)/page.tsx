import type { Metadata } from "next";
import Link from "next/link";
import { AdminErrorState } from "@/components/admin/error-state";
import { OrdersTable } from "@/components/admin/orders-table";
import { AdminCard, AdminHeading, EmptyTable, StatGrid, type Stat } from "@/components/admin/section";
import { textButtonClasses } from "@/components/ui/button";
import { loadAdminData } from "@/lib/data";
import { formatMoney, isoDay } from "@/lib/format";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminDashboardPage() {
  const { products, orders, settings, connected, error } = await loadAdminData();

  if (!connected) {
    return <AdminErrorState message={error ?? "Admin data could not be loaded."} />;
  }

  const today = isoDay(new Date(), settings.timezone);
  const sales = orders
    .filter((order) => order.status === "Paid" && isoDay(order.date, settings.timezone) === today)
    .reduce((sum, order) => sum + order.total, 0);
  const pending = orders.filter((order) => order.status === "Pending").length;
  const paid = orders.filter((order) => order.status === "Paid").length;
  const lowStock = products.filter((product) => product.stock <= settings.lowStockThreshold).length;

  const stats: Stat[] = [
    ["Total products", String(products.length), "In your menu"],
    ["Total orders", String(orders.length), "All recorded orders"],
    ["Pending orders", String(pending), "Awaiting payment"],
    ["Paid orders", String(paid), "Payment received"],
    ["Low stock", String(lowStock), "At or below threshold"],
    ["Today's sales", formatMoney(sales, settings.currency), "Paid orders today"],
  ];

  return (
    <>
      <AdminHeading title="Good day, cafe team" description="Here’s how Samson Cafe is doing today." />
      <StatGrid stats={stats} />

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
