type AvailabilityProps = {
  stock: number;
  threshold: number;
};

export function Availability({ stock, threshold }: AvailabilityProps) {
  if (stock <= 0) {
    return <div className="my-[10px_16px] text-xs font-bold text-danger">OUT OF STOCK</div>;
  }

  const low = stock <= threshold;
  return (
    <div className={`my-[10px_16px] text-xs ${low ? "text-warning" : "text-muted"}`}>
      {stock} available
    </div>
  );
}
