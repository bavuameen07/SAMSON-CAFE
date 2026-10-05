import type { Metadata } from "next";
import { StockManager } from "@/components/admin/stock-manager";
import { AdminErrorState } from "@/components/admin/error-state";
import { loadAdminData } from "@/lib/data";

export const metadata: Metadata = { title: "Stock" };

export default async function AdminStockPage() {
  const { products, settings, connected, error } = await loadAdminData();

  if (!connected) {
    return <AdminErrorState message={error ?? "Admin data could not be loaded."} />;
  }

  return <StockManager products={products} settings={settings} />;
}
