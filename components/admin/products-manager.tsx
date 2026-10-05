"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createProductAction,
  setProductEnabledAction,
  updateProductAction,
} from "@/app/actions";
import { ProductImage } from "@/components/product-image";
import { buttonClasses, textButtonClasses } from "@/components/ui/button";
import {
  inputClasses,
  labelClasses,
  toolbarControlClasses,
  toolbarSearchClasses,
} from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Toast, useToast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/format";
import type { DisplayProduct, DisplaySettings } from "@/lib/types";
import { MenuBadge, StockBadge } from "./badges";
import { AdminCard, AdminHeading, EmptyTable } from "./section";

type Draft = { mode: "create" } | { mode: "edit"; product: DisplayProduct };

const CELL = "border-b border-[#eff0f2] px-[11px] py-3";
const HEADINGS = ["Product", "ID", "Stock", "Price", "Status", "Menu", "Action"];

type ProductsManagerProps = {
  products: DisplayProduct[];
  settings: DisplaySettings;
};

export function ProductsManager({ products, settings }: ProductsManagerProps) {
  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();
  const { toast, showToast } = useToast();

  const threshold = settings.lowStockThreshold;

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      if (needle && !`${product.name} ${product.id}`.toLowerCase().includes(needle)) return false;
      if (stockFilter === "low" && !(product.stock > 0 && product.stock <= threshold)) return false;
      if (stockFilter === "out" && product.stock !== 0) return false;
      return true;
    });
  }, [products, query, stockFilter, threshold]);

  function toggleEnabled(product: DisplayProduct) {
    startTransition(async () => {
      const result = await setProductEnabledAction(product.id, !product.enabled);
      showToast(
        result.ok ? `Product ${product.enabled ? "disabled" : "enabled"}.` : result.error,
        result.ok ? "info" : "error",
      );
    });
  }

  function save(formData: FormData) {
    if (!draft) return;
    const mode = draft.mode;
    startTransition(async () => {
      const result =
        mode === "create" ? await createProductAction(formData) : await updateProductAction(formData);
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      setDraft(null);
      showToast(mode === "create" ? "Product added." : "Product updated.");
    });
  }

  return (
    <>
      <AdminHeading
        title="Products"
        description="Keep your menu, pricing, and availability up to date."
        action={
          <button
            type="button"
            onClick={() => setDraft({ mode: "create" })}
            className={buttonClasses("admin")}
          >
            + &nbsp;ADD PRODUCT
          </button>
        }
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
              value={stockFilter}
              onChange={(event) => setStockFilter(event.target.value)}
              aria-label="Filter by stock level"
              className={toolbarControlClasses}
            >
              <option value="">All stock levels</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
          </>
        }
      >
        {rows.length === 0 ? (
          <EmptyTable>No products yet.</EmptyTable>
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
                          picture={product.picture}
                          alt=""
                          fallback={settings.fallbackImage}
                          sizes="40px"
                          className="h-[34px] w-[40px] rounded-[5px] bg-[#eee] object-cover"
                        />
                        <strong>{product.name}</strong>
                      </div>
                    </td>
                    <td className={CELL}>{product.id}</td>
                    <td className={CELL}>{product.stock}</td>
                    <td className={CELL}>{formatMoney(product.price, settings.currency)}</td>
                    <td className={CELL}>
                      <StockBadge stock={product.stock} threshold={threshold} />
                    </td>
                    <td className={CELL}>
                      <MenuBadge enabled={product.enabled} />
                    </td>
                    <td className={CELL}>
                      <button
                        type="button"
                        onClick={() => setDraft({ mode: "edit", product })}
                        className={textButtonClasses()}
                      >
                        EDIT
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleEnabled(product)}
                        disabled={pending}
                        className={textButtonClasses()}
                      >
                        {product.enabled ? "DISABLE" : "ENABLE"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      {draft ? (
        <ProductModal
          draft={draft}
          settings={settings}
          pending={pending}
          onClose={() => setDraft(null)}
          onSubmit={save}
        />
      ) : null}

      <Toast toast={toast} />
    </>
  );
}

type ProductModalProps = {
  draft: Draft;
  settings: DisplaySettings;
  pending: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
};

function ProductModal({ draft, settings, pending, onClose, onSubmit }: ProductModalProps) {
  const product = draft.mode === "edit" ? draft.product : null;

  return (
    <Modal
      title={product ? "Edit product" : "Add a menu item"}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={buttonClasses("adminLight")}>
            CANCEL
          </button>
          <button
            type="submit"
            form="product-form"
            disabled={pending}
            className={buttonClasses("admin")}
          >
            {pending ? "SAVING…" : product ? "SAVE CHANGES" : "ADD PRODUCT"}
          </button>
        </>
      }
    >
      <form
        id="product-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(new FormData(event.currentTarget));
        }}
        className="grid grid-cols-1 gap-[17px] min-[601px]:grid-cols-2"
      >
        {product ? <input type="hidden" name="id" value={product.id} /> : null}

        <div className="flex flex-col gap-[7px] min-[601px]:col-span-2">
          <label htmlFor="product-name" className={labelClasses}>
            Product name
          </label>
          <input
            id="product-name"
            name="name"
            required
            maxLength={80}
            defaultValue={product?.name ?? ""}
            className={inputClasses}
          />
        </div>

        <div className="flex flex-col gap-[7px] min-[601px]:col-span-2">
          <label htmlFor="product-image" className={labelClasses}>
            Image URL
          </label>
          <input
            id="product-image"
            name="image"
            type="url"
            defaultValue={product?.image ?? ""}
            placeholder="https://…"
            className={inputClasses}
          />
        </div>

        <div className="flex flex-col gap-[7px]">
          <label htmlFor="product-stock" className={labelClasses}>
            Stock
          </label>
          <input
            id="product-stock"
            name="stock"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={product?.stock ?? 0}
            className={inputClasses}
          />
        </div>

        <div className="flex flex-col gap-[7px]">
          <label htmlFor="product-price" className={labelClasses}>
            Price ({settings.currency})
          </label>
          <input
            id="product-price"
            name="price"
            type="number"
            min={0.01}
            step={0.01}
            required
            defaultValue={product?.price ?? ""}
            className={inputClasses}
          />
        </div>
      </form>
    </Modal>
  );
}
