import type { Metadata } from "next";
import { ProductsManager } from "@/components/admin/products-manager";
import { AdminErrorState } from "@/components/admin/error-state";
import { loadAdminData } from "@/lib/data";

export const metadata: Metadata = { title: "Products" };

export default async function AdminProductsPage() {
  const { products, settings, connected, error } = await loadAdminData();

  if (!connected) {
    return <AdminErrorState message={error ?? "Admin data could not be loaded."} />;
  }

  return <ProductsManager products={products} settings={settings} />;
}
