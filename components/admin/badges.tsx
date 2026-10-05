import type { OrderStatus } from "@/lib/types";

const BASE = "inline-flex items-center rounded-full px-2 py-[5px] text-[10px] font-bold";

const TONES = {
  neutral: "bg-[#f2f2f2] text-[#626262]",
  success: "bg-[#e8f4ed] text-[#317052]",
  warning: "bg-[#fff2dc] text-[#8e6321]",
  danger: "bg-[#fae9e6] text-[#a84032]",
} as const;

export type BadgeTone = keyof typeof TONES;

export function badgeClasses(tone: BadgeTone): string {
  return `${BASE} ${TONES[tone]}`;
}

export function PaymentBadge({ status }: { status: OrderStatus }) {
  return <span className={badgeClasses(status === "Paid" ? "success" : "warning")}>{status}</span>;
}

export function StockBadge({ stock, threshold }: { stock: number; threshold: number }) {
  if (stock <= 0) return <span className={badgeClasses("danger")}>OUT OF STOCK</span>;
  if (stock <= threshold) return <span className={badgeClasses("warning")}>LOW STOCK</span>;
  return <span className={badgeClasses("success")}>IN STOCK</span>;
}

export function MenuBadge({ enabled }: { enabled: boolean }) {
  return (
    <span className={badgeClasses(enabled ? "success" : "danger")}>
      {enabled ? "ENABLED" : "DISABLED"}
    </span>
  );
}
