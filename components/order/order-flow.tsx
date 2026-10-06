"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { placeOrderAction } from "@/app/actions";
import { ProductImage } from "@/components/product-image";
import { buttonClasses } from "@/components/ui/button";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { DisplayProduct, DisplaySettings, Order } from "@/lib/types";

const STEP_LABELS = ["Product", "Confirm"] as const;

type Step = 1 | 2;

function Stepper({ current }: { current: number }) {
  return (
    <div className="my-[18px] flex max-w-[640px] items-center min-[601px]:my-[28px]">
      {STEP_LABELS.map((label, index) => {
        const position = index + 1;
        const active = current === position;
        const done = current > position;
        return (
          <Fragment key={label}>
            <div
              className={`flex items-center gap-[6px] text-[10px] font-semibold whitespace-nowrap min-[601px]:gap-[9px] min-[601px]:text-xs ${
                active || done ? "text-coffee" : "text-[#a99e90]"
              }`}
            >
              <span
                className={`grid h-[27px] w-[27px] place-items-center rounded-full text-xs min-[601px]:h-[30px] min-[601px]:w-[30px] ${
                  active || done ? "bg-coffee text-white" : "bg-[#ece4d8]"
                }`}
              >
                {done ? "✓" : position}
              </span>
              <span>{label}</span>
            </div>
            {position < STEP_LABELS.length ? (
              <span className="mx-[6px] h-px flex-1 bg-[#e2d8ca] min-[601px]:mx-3" />
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}

type OrderFlowProps = {
  product: DisplayProduct;
  settings: DisplaySettings;
};

export function OrderFlow({ product, settings }: OrderFlowProps) {
  const [step, setStep] = useState<Step>(1);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [pending, startTransition] = useTransition();

  const total = product.price * quantity;
  const soldOut = product.stock < 1;

  function goToConfirm() {
    if (quantity < 1 || quantity > product.stock) {
      setError("Please select a valid quantity.");
      return;
    }
    setError("");
    setStep(2);
  }

  function placeOrder() {
    startTransition(async () => {
      // `pending` is disabled on the button, so a double tap cannot send a second
      // order while the first is still in flight.
      const result = await placeOrderAction(product.id, quantity);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPlacedOrder(result.data);
      setError("");
    });
  }

  if (placedOrder) {
    return (
      <main className="mx-auto my-7 w-[min(100%,650px)] rounded-[18px] bg-white px-[18px] py-8 text-center shadow-card min-[601px]:my-[45px] min-[601px]:px-[30px] min-[601px]:py-[42px]">
        <div className="mx-auto mb-[18px] grid h-[58px] w-[58px] place-items-center rounded-full bg-[#e5f2e8] text-[29px] text-success">
          ✓
        </div>
        <div className="text-[11px] font-bold tracking-[.16em] text-clay uppercase">
          A little happiness is on its way
        </div>
        <h1 className="mb-2 mt-2 font-serif text-[30px] font-semibold text-coffee min-[601px]:text-[34px]">
          ORDER CONFIRMED
        </h1>
        <p className="text-sm text-muted">Thank you for ordering from Samson Cafe.</p>

        <div className="mx-auto my-[25px] max-w-[390px] border-y border-line py-[18px] text-left">
          <div className="flex justify-between gap-3 py-[5px] text-sm">
            <span className="text-muted">Order ID</span>
            <strong>{placedOrder.id}</strong>
          </div>
          <div className="flex justify-between gap-3 py-[5px] text-sm">
            <span className="text-muted">Item</span>
            <strong>
              {product.name} × {placedOrder.quantity}
            </strong>
          </div>
          <div className="flex justify-between gap-3 py-[5px] text-sm">
            <span className="text-muted">Total</span>
            <strong>{formatMoney(placedOrder.total, settings.currency)}</strong>
          </div>
          <div className="flex justify-between gap-3 py-[5px] text-sm">
            <span className="text-muted">Payment</span>
            <span className="inline-flex items-center rounded-full bg-[#fff2dc] px-2 py-[5px] text-[10px] font-bold text-[#8e6321]">
              {placedOrder.status}
            </span>
          </div>
          <div className="flex justify-between gap-3 py-[5px] text-sm">
            <span className="text-muted">Date &amp; time</span>
            <strong>{formatDateTime(placedOrder.date, settings.timezone)}</strong>
          </div>
        </div>

        <Link href="/" className={buttonClasses("primary")}>
          BACK TO MENU
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-67px)] max-w-[960px] px-[15px] pt-[22px] pb-[48px] min-[601px]:min-h-[calc(100vh-78px)] min-[601px]:px-6 min-[601px]:pt-[34px] min-[601px]:pb-[76px]">
      <Link href="/" className="mb-[18px] inline-block py-2 text-[13px] text-clay">
        &larr; &nbsp; Back to menu
      </Link>

      <div className="text-[11px] font-bold tracking-[.16em] text-clay uppercase">Quick order</div>
      <h1 className="mb-5 mt-2 font-serif text-[29px] font-semibold text-coffee min-[601px]:text-[34px]">
        Your order
      </h1>

      <Stepper current={step} />

      <section className="rounded-[16px] bg-white p-[17px] shadow-card min-[601px]:p-[25px]">
        {error ? (
          <div className="mb-4 rounded-lg bg-[#f8eee9] px-[14px] py-3 text-[13px] text-[#964335]">
            {error}
          </div>
        ) : null}

        {step === 1 ? (
          <>
            <div className="grid grid-cols-1 items-center gap-[14px] min-[601px]:grid-cols-[minmax(180px,42%)_1fr] min-[601px]:gap-[26px]">
              <ProductImage
                picture={product.picture}
                fallback={settings.fallbackImage}
                priority
                sizes="(max-width: 600px) calc(100vw - 30px), 380px"
                className="h-[210px] w-full rounded-[11px] bg-[#e9dfd0] object-cover min-[601px]:h-[270px]"
              />
              <div>
                <div className="text-[11px] font-bold tracking-[.16em] text-clay uppercase">
                  Order item
                </div>
                <h2 className="mt-1.5 mb-[6px] font-serif text-[25px] font-semibold text-coffee min-[601px]:text-[28px]">
                  {product.name}
                </h2>
                <div className="text-xs text-muted">Item ID · {product.id}</div>
                <div className="mt-4 mb-1.5 text-[18px] font-bold">
                  {formatMoney(product.price, settings.currency)}{" "}
                  <span className="text-xs font-normal text-muted">/ each</span>
                </div>
                <div className="text-[13px] text-muted">{product.stock} available</div>

                <div className="my-[17px] flex items-center gap-4 min-[601px]:my-[22px]">
                  <span>Quantity</span>
                  <div className="flex items-center overflow-hidden rounded-[9px] border border-line">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                      disabled={quantity <= 1}
                      className="h-[42px] w-[42px] cursor-pointer border-0 bg-[#f8f5f0] text-[20px] text-coffee disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      &minus;
                    </button>
                    <span className="min-w-[44px] text-center font-semibold">{quantity}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => setQuantity((current) => Math.min(product.stock, current + 1))}
                      disabled={quantity >= product.stock}
                      className="h-[42px] w-[42px] cursor-pointer border-0 bg-[#f8f5f0] text-[20px] text-coffee disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-line py-[17px] text-sm text-muted">
                  <span>Total amount</span>
                  <strong className="text-[21px] text-coffee">
                    {formatMoney(total, settings.currency)}
                  </strong>
                </div>
              </div>
            </div>

            <div className="mt-[18px] flex flex-col-reverse justify-between gap-3 min-[601px]:flex-row">
              <Link href="/" className={buttonClasses("secondary", "w-full min-[601px]:w-auto")}>
                BACK TO MENU
              </Link>
              <button
                type="button"
                onClick={goToConfirm}
                disabled={soldOut}
                className={buttonClasses("primary", "w-full min-[601px]:w-auto")}
              >
                CONTINUE
              </button>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="text-[11px] font-bold tracking-[.16em] text-clay uppercase">
              Step 2 · Confirm order
            </div>
            <h2 className="mt-[7px] mb-5 font-serif text-[21px] font-semibold text-coffee">
              Everything look right?
            </h2>

            <div className="grid grid-cols-1 gap-[22px] min-[601px]:grid-cols-[1.2fr_.8fr]">
              <div>
                <div className="border-b border-line pt-0.5 pb-[17px]">
                  <h3 className="mb-3 text-[11px] tracking-[.1em] text-clay uppercase">Your order</h3>
                  <div className="flex justify-between gap-3 py-[5px] text-[13px]">
                    <span className="text-muted">Product</span>
                    <strong>{product.name}</strong>
                  </div>
                  <div className="flex justify-between gap-3 py-[5px] text-[13px]">
                    <span className="text-muted">Item ID</span>
                    <strong>{product.id}</strong>
                  </div>
                  <div className="flex justify-between gap-3 py-[5px] text-[13px]">
                    <span className="text-muted">Quantity</span>
                    <strong>{quantity}</strong>
                  </div>
                  <div className="flex justify-between gap-3 py-[5px] text-[13px]">
                    <span className="text-muted">Price</span>
                    <strong>{formatMoney(product.price, settings.currency)} each</strong>
                  </div>
                </div>
              </div>

              <div className="self-start rounded-[10px] bg-paper p-[18px]">
                <div className="flex justify-between gap-3 py-[5px] text-[13px]">
                  <span className="text-muted">Payment status</span>
                  <span className="inline-flex items-center rounded-full bg-[#fff2dc] px-2 py-[5px] text-[10px] font-bold text-[#8e6321]">
                    Pending
                  </span>
                </div>
                <div className="flex justify-between gap-3 py-[5px] text-[13px]">
                  <span className="text-muted">Total amount</span>
                  <strong className="text-[23px] text-coffee">
                    {formatMoney(total, settings.currency)}
                  </strong>
                </div>
                <p className="mt-[9px] mb-0 text-xs text-muted">
                  Pay when you collect your order.
                </p>
              </div>
            </div>

            <div className="mt-[18px] flex flex-col-reverse justify-between gap-3 min-[601px]:flex-row">
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setStep(1);
                }}
                className={buttonClasses("secondary", "w-full min-[601px]:w-auto")}
              >
                BACK
              </button>
              <button
                type="button"
                onClick={placeOrder}
                disabled={pending}
                className={buttonClasses("primary", "w-full min-[601px]:w-auto")}
              >
                {pending ? "PLACING ORDER…" : "PLACE ORDER"}
              </button>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
