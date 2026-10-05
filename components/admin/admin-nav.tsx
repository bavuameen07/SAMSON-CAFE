"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/stock", label: "Stock" },
  { href: "/admin/reports", label: "Reports" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-[58px] z-[4] overflow-x-auto border-b border-[#e9ebef] bg-white px-[14px] py-2 min-[601px]:top-16 min-[851px]:min-h-[calc(100vh-64px)] min-[851px]:border-r min-[851px]:border-b-0 min-[851px]:px-[14px] min-[851px]:py-[23px]">
      <div className="mb-3 ml-[11px] hidden text-[10px] font-bold tracking-[.14em] text-faint uppercase min-[851px]:block">
        WORKSPACE
      </div>
      <nav className="flex min-w-max gap-1 min-[851px]:grid min-[851px]:min-w-0">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-lg px-3 py-[9px] text-[13px] transition-colors min-[851px]:py-[11px] ${
                active
                  ? "bg-[#f5f0e8] font-bold text-coffee"
                  : "text-[#625f5b] hover:bg-[#f5f0e8] hover:text-coffee"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
