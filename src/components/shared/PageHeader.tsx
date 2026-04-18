import { ArrowsClockwise } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export function PageHeader({
  title,
  subtitle,
  action,
  refreshedAt,
  onRefresh,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  refreshedAt?: string;
  onRefresh?: () => void;
}) {
  return (
    <div className="mb-10 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        {refreshedAt ? (
          <button
            className="hidden min-h-11 items-center gap-1 rounded-lg px-2 text-xs text-gray-400 hover:bg-white hover:text-brand-accent sm:flex"
            type="button"
            onClick={onRefresh}
          >
            <ArrowsClockwise aria-hidden />
            {refreshedAt}
          </button>
        ) : null}
        {action ? <Button asChild>{action}</Button> : null}
      </div>
    </div>
  );
}
