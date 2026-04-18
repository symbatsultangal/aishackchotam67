export function SkeletonStat() {
  return <div className="skeleton h-10 w-20" />;
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 border-b border-gray-100 py-3">
      <div className="skeleton size-8 rounded-full" />
      <div className="min-w-0 flex-1">
        <div className="skeleton h-4 w-40" />
        <div className="skeleton mt-2 h-3 w-24" />
      </div>
      <div className="skeleton h-6 w-16" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg bg-white p-5">
      <div className="skeleton h-5 w-40" />
      <div className="skeleton mt-4 h-4 w-full" />
      <div className="skeleton mt-3 h-4 w-4/5" />
      <div className="skeleton mt-3 h-4 w-2/3" />
    </div>
  );
}

export function ChartSkeleton() {
  return <div className="skeleton h-40 w-full" />;
}
