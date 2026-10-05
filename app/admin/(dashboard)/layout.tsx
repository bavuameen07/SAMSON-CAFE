import type { Metadata } from "next";
import Link from "next/link";
import { adminLogoutAction } from "@/app/actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { textButtonClasses } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin-session";
import { loadAdminData } from "@/lib/data";

export const metadata: Metadata = {
  title: { default: "Samson Cafe · Admin", template: "%s · Samson Cafe · Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireAdmin();
  const { connected } = await loadAdminData();

  return (
    <div className="min-h-screen bg-shell">
      <header className="sticky top-0 z-[5] flex h-[58px] items-center justify-between border-b border-[#e9ebef] bg-white px-[14px] min-[601px]:h-16 min-[601px]:px-[25px]">
        <Link href="/" className="font-serif text-[17px] font-bold tracking-[.035em] text-coffee">
          SAMSON CAFE
        </Link>
        <div className="flex items-center gap-[9px] text-xs text-muted min-[601px]:gap-[17px]">
          <span className="hidden text-[11px] text-[#958b7f] min-[601px]:inline">
            {connected ? "Google Sheets connected" : "Google Sheets unavailable"}
          </span>
          <strong>Admin</strong>
          <form action={adminLogoutAction}>
            <button type="submit" className={textButtonClasses()}>
              SIGN OUT
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-58px)] max-w-[1500px] min-[851px]:min-h-[calc(100vh-64px)] min-[851px]:grid-cols-[225px_minmax(0,1fr)]">
        <AdminNav />
        <main className="min-w-0 px-[13px] py-5 min-[601px]:px-[clamp(18px,3vw,42px)] min-[601px]:py-[30px]">
          {children}
        </main>
      </div>
    </div>
  );
}
