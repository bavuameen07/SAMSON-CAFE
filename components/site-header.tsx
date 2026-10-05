import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-[67px] items-center justify-between border-b border-line/50 bg-paper px-[17px] min-[601px]:h-[78px] min-[601px]:px-[max(24px,calc((100vw-1200px)/2))]">
      <Link href="/" className="font-serif text-[21px] font-bold tracking-[.035em] text-coffee">
        SAMSON CAFE
        <small className="mt-0.5 block font-sans text-[10px] font-medium tracking-[.14em] text-clay">
          Good Coffee. Good Food. Good Moments.
        </small>
      </Link>
      <div className="flex items-center gap-5">
        <span className="max-w-[165px] text-right text-[10px] leading-tight text-muted min-[601px]:max-w-none min-[601px]:text-xs">
          Made fresh, just for you
        </span>
        <Link
          href="/admin/login"
          className="rounded-[7px] border border-line px-3 py-[9px] text-[10px] font-bold tracking-[.08em] text-coffee transition-colors hover:bg-cream"
        >
          ADMIN
        </Link>
      </div>
    </header>
  );
}
