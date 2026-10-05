import type { Metadata } from "next";
import { OrdersManager } from "@/components/admin/orders-manager";
import { AdminErrorState } from "@/components/admin/error-state";
import { loadAdminData } from "@/lib/data";

export const metadata: Metadata = { title: "Orders" };

export default async function AdminOrdersPage() {
  const { orders, settings, connected, error } = await loadAdminData();

  if (!connected) {
    return <AdminErrorState message={error ?? "Admin data could not be loaded."} />;
  }

  return <OrdersManager orders={orders} settings={settings} />;
}
