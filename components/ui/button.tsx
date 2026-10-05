import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "admin" | "adminLight";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "rounded-lg bg-coffee px-[18px] py-[13px] text-xs font-bold tracking-[.07em] text-white transition duration-150 hover:-translate-y-px hover:bg-coffee-hover",
  secondary:
    "rounded-lg bg-cream px-[18px] py-[13px] text-xs font-bold tracking-[.07em] text-coffee transition duration-150 hover:bg-[#e6dccd]",
  ghost:
    "rounded-lg border border-line bg-transparent px-[18px] py-[13px] text-xs font-bold tracking-[.07em] text-coffee transition-colors hover:bg-cream",
  admin:
    "rounded-[7px] bg-coffee px-[14px] py-[10px] text-[11px] font-bold whitespace-nowrap text-white transition-colors hover:bg-coffee-hover",
  adminLight:
    "rounded-[7px] bg-[#eee9e1] px-[14px] py-[10px] text-[11px] font-bold whitespace-nowrap text-coffee",
};

const BASE =
  "inline-flex cursor-pointer items-center justify-center border-0 transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export function buttonClasses(variant: ButtonVariant = "primary", extra = ""): string {
  return [BASE, VARIANTS[variant], extra].filter(Boolean).join(" ");
}

/** Matches the old `.text-button`: borderless link-style action. */
export function textButtonClasses(extra = ""): string {
  return `inline-flex cursor-pointer items-center border-0 bg-none px-1.5 py-1 text-[11px] font-bold text-[#72543a] transition-colors hover:underline ${extra}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, className)} {...props} />;
}
