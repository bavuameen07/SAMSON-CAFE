import type { ReactNode } from "react";

type AdminHeadingProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function AdminHeading({ title, description, action }: AdminHeadingProps) {
  return (
    <div className="mb-[22px] flex items-center justify-between gap-[14px] max-[600px]:items-start">
      <div>
        <h1 className="mb-1 font-serif text-[25px] font-semibold text-coffee min-[601px]:text-[28px]">
          {title}
        </h1>
        <p className="mb-0 text-xs text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

type AdminCardProps = {
  title?: string;
  toolbar?: ReactNode;
  children: ReactNode;
};

export function AdminCard({ title, toolbar, children }: AdminCardProps) {
  return (
    <section className="mb-[17px] rounded-[11px] border border-[#eceef1] bg-white p-[13px] min-[601px]:p-[18px]">
      {title ? <h2 className="mb-4 text-sm">{title}</h2> : null}
      {toolbar ? (
        <div className="mb-[15px] flex flex-wrap items-center gap-[9px] max-[600px]:flex-col max-[600px]:items-stretch">
          {toolbar}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function EmptyTable({ children }: { children: ReactNode }) {
  return <div className="p-8! text-center text-muted">{children}</div>;
}

export type Stat = readonly [label: string, value: string, foot: string];

export function StatGrid({ stats }: { stats: readonly Stat[] }) {
  return (
    <section className="mb-[23px] grid grid-cols-2 gap-[9px] min-[601px]:grid-cols-3 min-[601px]:gap-[15px]">
      {stats.map(([label, value, foot]) => (
        <article
          key={label}
          className="rounded-[11px] border border-[#eceef1] bg-white p-[14px] min-[601px]:p-[18px]"
        >
          <div className="text-[10px] font-bold tracking-[.1em] text-[#888] uppercase">{label}</div>
          <div className="mt-[9px] text-[22px] font-bold text-coffee min-[601px]:text-[26px]">
            {value}
          </div>
          <div className="mt-1 text-[11px] text-[#8b877f]">{foot}</div>
        </article>
      ))}
    </section>
  );
}
