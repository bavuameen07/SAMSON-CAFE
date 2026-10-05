/**
 * Shown while the dashboard waits on Apps Script, which can take several seconds
 * on a cold start and up to the 15s request timeout. Without this the layout
 * renders with an empty panel while every number is still being fetched, which
 * reads as a broken page rather than a slow one.
 *
 * The shapes mirror the real sections so nothing jumps when the data lands.
 */
export default function AdminDashboardLoading() {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading cafe data from Google Sheets…</p>

      <div className="mb-[22px] animate-pulse">
        <div className="mb-1 h-[28px] w-[220px] rounded bg-[#eceef1]" />
        <div className="h-[12px] w-[260px] rounded bg-[#f1f2f4]" />
      </div>

      <section className="mb-[23px] grid grid-cols-2 gap-[9px] min-[601px]:grid-cols-3 min-[601px]:gap-[15px]">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="animate-pulse rounded-[11px] border border-[#eceef1] bg-white p-[14px] min-[601px]:p-[18px]"
          >
            <div className="h-[9px] w-[70px] rounded bg-[#f1f2f4]" />
            <div className="mt-[9px] h-[22px] w-[54px] rounded bg-[#e9ebef] min-[601px]:h-[26px]" />
            <div className="mt-1 h-[9px] w-[88px] rounded bg-[#f5f6f8]" />
          </div>
        ))}
      </section>

      <section className="mb-[17px] animate-pulse rounded-[11px] border border-[#eceef1] bg-white p-[13px] min-[601px]:p-[18px]">
        <div className="mb-4 h-[14px] w-[140px] rounded bg-[#eceef1]" />
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="mb-3 h-[34px] rounded bg-[#f5f6f8] last:mb-0"
          />
        ))}
      </section>
    </div>
  );
}