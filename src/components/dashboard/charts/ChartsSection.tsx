import { useMemo } from "react";

import type {
  ChartBalancePointVM,
  ChartInterestPointVM,
} from "@/types/dashboard";
import { ChartCard } from "./ChartCard";
import { BalancesAccessibleTable } from "./BalancesAccessibleTable";
import { BalancesChart } from "./BalancesChart";
import { InterestAccessibleTable } from "./InterestAccessibleTable";
import { InterestVsSavedChart } from "./InterestVsSavedChart";

interface ChartsSectionProps {
  readonly balancePoints?: ChartBalancePointVM[];
  readonly interestPoints?: ChartInterestPointVM[];
  readonly isLoading?: boolean;
}

const hasData = <T,>(items: T[] | undefined): items is T[] =>
  Array.isArray(items) && items.length > 0;

export function ChartsSection({
  balancePoints,
  interestPoints,
  isLoading = false,
}: ChartsSectionProps) {
  const balanceSummary = useMemo(() => {
    if (!hasData(balancePoints)) {
      return null;
    }

    const first = balancePoints[0];
    const last = balancePoints[balancePoints.length - 1];
    const delta = last.totalRemaining - first.totalRemaining;
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

    const direction = delta <= 0 ? "decrease" : "increase";
    return `Projected ${direction} of ${formatter.format(Math.abs(delta))} across the modeled period.`;
  }, [balancePoints]);

  const interestSummary = useMemo(() => {
    if (!hasData(interestPoints)) {
      return null;
    }

    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

    const totalInterest = interestPoints.reduce(
      (acc, point) => acc + point.interest,
      0,
    );
    const totalSaved = interestPoints.reduce(
      (acc, point) => acc + point.interestSaved,
      0,
    );
    return `Total projected interest ${formatter.format(totalInterest)} with ${formatter.format(totalSaved)} saved.`;
  }, [interestPoints]);

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <ChartCard
        title="Remaining balance"
        description={
          balanceSummary ??
          "Track how your remaining balances trend under the active strategy."
        }
        hasData={hasData(balancePoints)}
        chart={<BalancesChart points={balancePoints} />}
        table={<BalancesAccessibleTable points={balancePoints} />}
        emptyMessage="Balance projections are unavailable. Re-run your simulation to regenerate chart data."
        legend={
          <div className="flex items-center gap-4">
            <LegendSwatch color="#2563eb" label="Remaining balance" />
          </div>
        }
        isLoading={isLoading}
      />
      <ChartCard
        title="Interest vs interest saved"
        description={
          interestSummary ??
          "Compare projected interest charges with savings from your strategy."
        }
        hasData={hasData(interestPoints)}
        chart={<InterestVsSavedChart points={interestPoints} />}
        table={<InterestAccessibleTable points={interestPoints} />}
        emptyMessage="Interest projections are unavailable. Re-run your simulation to regenerate chart data."
        legend={
          <div className="flex flex-wrap items-center gap-4">
            <LegendSwatch color="#1f2937" label="Interest charged" />
            <LegendSwatch color="#10b981" label="Interest saved" />
          </div>
        }
        isLoading={isLoading}
      />
    </section>
  );
}

interface LegendSwatchProps {
  readonly color: string;
  readonly label: string;
}

function LegendSwatch({ color, label }: LegendSwatchProps) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </span>
  );
}
