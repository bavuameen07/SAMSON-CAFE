export default function Loading() {
  return (
    <div className="flex h-screen items-center justify-center gap-3 text-muted">
      <span className="spinner" />
      <span>Brewing something good…</span>
    </div>
  );
}
