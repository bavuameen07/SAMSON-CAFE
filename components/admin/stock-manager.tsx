"use client";

import { useMemo, useState, useTransition } from "react";
import { updateStockAction } from "@/app/actions";
import { ProductImage } from "@/components/product-image";
import { buttonClasses, textButtonClasses } from "@/components/ui/button";
import { inputClasses, labelClasses, toolbarControlClasses, toolbarSearchClasses } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Toast, useToast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/format";
import type { DisplaySettings, Product } from "@/lib/types";
import { StockBadge } from "./badges";
import { AdminCard, AdminHeading, EmptyTable } from "./section";

const CELL = "border-b border-[#eff0f2] px-[11px] py-3";
const HEADINGS = ["Product", "Item ID", "Current stock", "Price", "Stock status", "Action"];

type StockManagerProps = {
  products: Product[];
  settings: DisplaySettings;
};

export function StockManager({ products, settings }: StockManagerProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { toast, showToast } = useToast();

  const threshold = settings.lowStockThreshold;

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      if (needle && !`${product.name} ${product.id}`.toLowerCase().includes(needle)) return false;
      if (filter === "out" && product.stock !== 0) return false;
      if (filter === "low" && !(product.stock > 0 && product.stock <= threshold)) return false;
      if (filter === "in" && product.stock <= threshold) return false;
      return true;
    });
  }, [products, query, filter, threshold]);

  const selected = selectedId ? (products.find((product) => product.id === selectedId) ?? null) : null;

  function saveStock(formData: FormData) {
    if (!selected) return;
    const productId = selected.id;
    startTransition(async () => {
      const result = await updateStockAction(productId, Number(formData.get("stock")));
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      setSelectedId(null);
      showToast("Stock updated.");
    });
  }

  return (
    <>
      <AdminHeading
        title="Stock"
        description={`Low stock alert threshold: ${threshold} items.`}
      />

      <AdminCard
        toolbar={
          <>
            <input
              type="search"
              placeholder="Search products…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={toolbarSearchClasses}
            />
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              aria-label="Filter by stock status"
              className={toolbarControlClasses}
            >
              <option value="">All stock statuses</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
              <option value="in">In stock</option>
            </select>
          </>
        }
      >
        {rows.length === 0 ? (
          <EmptyTable>No products found.</EmptyTable>
        ) : (
          <div className="w-full overflow-auto">
            <table className="w-full border-collapse text-left text-xs whitespace-nowrap">
              <thead>
                <tr>
                  {HEADINGS.map((heading) => (
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
                {rows.map((product) => (
                  <tr key={product.id} className="last:[&>td]:border-b-0">
                    <td className={CELL}>
                      <div className="flex items-center gap-[9px]">
                        <ProductImage
                          src={product.image}
                          alt=""
                          fallback={settings.fallbackImage}
                          className="h-[34px] w-[40px] rounded-[5px] bg-[#eee] object-cover"
                        />
                        <strong>{product.name}</strong>
                      </div>
                    </td>
                    <td className={CELL}>{product.id}</td>
                    <td className={CELL}>
                      <strong>{product.stock}</strong>
                    </td>
                    <td className={CELL}>{formatMoney(product.price, settings.currency)}</td>
                    <td className={CELL}>
                      <StockBadge stock={product.stock} threshold={threshold} />
                    </td>
                    <td className={CELL}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(product.id)}
                        className={textButtonClasses()}
                      >
                        UPDATE STOCK
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      {selected ? (
        <Modal
          title="Update stock"
          onClose={() => setSelectedId(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className={buttonClasses("adminLight")}
              >
                CANCEL
              </button>
              <button
                type="submit"
                form="stock-form"
                disabled={pending}
                className={buttonClasses("admin")}
              >
                {pending ? "SAVING…" : "SAVE STOCK"}
              </button>
            </>
          }
        >
          <form
            id="stock-form"
            onSubmit={(event) => {
              event.preventDefault();
              saveStock(new FormData(event.currentTarget));
            }}
          >
            <div className="flex flex-col gap-[7px]">
              <label htmlFor="stock-value" className={labelClasses}>
                Current stock · {selected.name}
              </label>
              <input
                id="stock-value"
                name="stock"
                type="number"
                min={0}
                step={1}
                required
                defaultValue={selected.stock}
                className={inputClasses}
              />
            </div>
          </form>
        </Modal>
      ) : null}

      <Toast toast={toast} />
    </>
  );
}
