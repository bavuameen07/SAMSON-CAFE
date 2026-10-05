import type { Metadata } from "next";
import { AdminErrorState } from "@/components/admin/error-state";
import { AdminCard, AdminHeading, EmptyTable, StatGrid, type Stat } from "@/components/admin/section";
import { loadAdminData } from "@/lib/data";
import { formatDay, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Reports" };

const CELL = "border-b border-[#eff0f2] px-[11px] py-3";

export default async function AdminReportsPage() {
  const { orders, settings, connected, error } = await loadAdminData();

  if (!connected) {
    return <AdminErrorState message={error ?? "Admin data could not be loaded."} />;
  }

  const paid = orders.filter((order) => order.status === "Paid");
  const paidSales = paid.reduce((sum, order) => sum + order.total, 0);

  const byDay = new Map<string, number>();
  for (const order of paid) {
    const key = formatDay(order.date, settings.timezone);
    byDay.set(key, (byDay.get(key) ?? 0) + order.total);
  }
  const dailyRows = [...byDay.entries()];

  const stats: Stat[] = [
    ["Paid order total", String(paid.length), "Recorded paid orders"],
    ["Paid sales", formatMoney(paidSales, settings.currency), "Across all recorded dates"],
    [
      "Average paid order",
      formatMoney(paid.length ? paidSales / paid.length : 0, settings.currency),
      "Paid sales per order",
    ],
  ];

  return (
    <>
      <AdminHeading
        title="Reports"
        description="Sales from orders marked Paid in your Orders sheet."
      />
      <StatGrid stats={stats} />

      <AdminCard title="Paid sales by date">
        {dailyRows.length === 0 ? (
          <EmptyTable>Paid orders will appear here.</EmptyTable>
        ) : (
          <div className="w-full overflow-auto">
            <table className="w-full border-collapse text-left text-xs whitespace-nowrap">
              <thead>
                <tr>
                  <th
                    className={`${CELL} bg-[#fafafa] text-[10px] font-bold tracking-[.08em] text-[#888] uppercase`}
                  >
                    Date
                  </th>
                  <th
                    className={`${CELL} bg-[#fafafa] text-[10px] font-bold tracking-[.08em] text-[#888] uppercase`}
                  >
                    Paid sales
                  </th>
                </tr>
              </thead>
              <tbody>
                {dailyRows.map(([day, total]) => (
                  <tr key={day} className="last:[&>td]:border-b-0">
                    <td className={CELL}>{day}</td>
                    <td className={CELL}>{formatMoney(total, settings.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </>
  );
}
