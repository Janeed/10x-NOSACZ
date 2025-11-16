import type { ReactNode } from "react";

import type { OverviewCardVM } from "@/types/dashboard";
import { cn } from "@/lib/utils";

interface OverviewCardProps extends OverviewCardVM {
  readonly icon?: ReactNode;
}

const STATUS_LABELS: Record<NonNullable<OverviewCardVM["status"]>, string> = {
  loading: "Updating",
  ok: "",
};

export function OverviewCard({
  title,
  value,
  icon,
  status = "ok",
}: OverviewCardProps) {
  const isLoading = status === "loading";

  return (
    <article className="flex flex-col justify-between gap-3 rounded-2xl border border-muted bg-card p-5 shadow-sm">
      <header className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {icon ? (
          <span className="text-muted-foreground" aria-hidden>
            {icon}
          </span>
        ) : null}
      </header>
      <div className="min-h-10">
        {isLoading ? (
          <span
            aria-label={STATUS_LABELS.loading}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground"
          >
            <span className="inline-block size-2 animate-ping rounded-full bg-secondary" />
            Updating…
          </span>
        ) : (
          <p
            className={cn(
              "text-2xl font-semibold text-foreground",
              typeof value === "number" ? "tabular-nums" : undefined,
            )}
          >
            {value}
          </p>
        )}
      </div>
    </article>
  );
}
