import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface ChartCardProps {
  readonly title: string;
  readonly description: string;
  readonly hasData: boolean;
  readonly chart: ReactNode;
  readonly table: ReactNode;
  readonly emptyMessage: string;
  readonly legend?: ReactNode;
  readonly isLoading?: boolean;
}

export function ChartCard({
  title,
  description,
  hasData,
  chart,
  table,
  emptyMessage,
  legend,
  isLoading = false,
}: ChartCardProps) {
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    if (!hasData) {
      setShowTable(false);
    }
  }, [hasData]);

  const toggleDisabled = isLoading || !hasData;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-background p-6 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {hasData ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setShowTable((value) => !value)}
            disabled={toggleDisabled}
          >
            {showTable ? "View chart" : "View table"}
          </Button>
        ) : null}
      </header>

      {legend ? (
        <div className="text-xs text-muted-foreground">{legend}</div>
      ) : null}

      {isLoading ? (
        <div
          className="flex h-60 items-center justify-center"
          role="status"
          aria-live="polite"
        >
          <Spinner />
          <span className="sr-only">Loading chart data…</span>
        </div>
      ) : !hasData ? (
        <div className="rounded-lg border border-dashed border-muted/60 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : showTable ? (
        <div className="overflow-x-auto">{table}</div>
      ) : (
        <div className="overflow-hidden">{chart}</div>
      )}
    </section>
  );
}

function Spinner() {
  return (
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
  );
}
