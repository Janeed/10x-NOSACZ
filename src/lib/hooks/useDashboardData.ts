import { useMemo } from "react";

import { useDashboardContext } from "@/components/dashboard/DashboardDataProvider";
import type { DashboardOverviewDto } from "@/types";
import type {
  CurrentMonthEntryVM,
  DashboardLoanVM,
  OverviewCardVM,
} from "@/types/dashboard";
import {
  createLoanLookup,
  isSimulationRunning,
  mapCurrentMonthEntryToViewModel,
  mapLoanToViewModel,
} from "@/lib/dashboard/mappers";

interface DashboardDataResult {
  readonly overview: DashboardOverviewDto | undefined;
  readonly loans: DashboardLoanVM[];
  readonly currentMonthEntries: CurrentMonthEntryVM[];
  readonly activeSimulation: ReturnType<
    typeof useDashboardContext
  >["activeSimulation"];
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly refetch: () => Promise<void>;
  readonly showEmptyState: boolean;
  readonly adherence: DashboardOverviewDto["adherence"] | undefined;
  readonly graphs: DashboardOverviewDto["graphs"] | undefined;
  readonly isSimulationRunning: boolean;
  readonly overviewCards: OverviewCardVM[];
}

const buildCurrentMonthView = (
  overview: DashboardOverviewDto | undefined,
  activeSimulation: DashboardDataResult["activeSimulation"],
): CurrentMonthEntryVM[] => {
  if (!overview || !overview.currentMonth) {
    return [];
  }

  const loanLookup = createLoanLookup(overview);
  const monthStart = String(overview.currentMonth.monthStart);

  const simulationStatus = activeSimulation?.status;
  const simulationStale = Boolean(activeSimulation?.stale);
  const running = isSimulationRunning(simulationStatus);

  return overview.currentMonth.entries.map((entry) => {
    return mapCurrentMonthEntryToViewModel(entry, {
      overview,
      monthStart,
      isSimulationRunning: running,
      isSimulationStale: simulationStale,
      loanLookup,
    });
  });
};

const mapLoans = (
  overview: DashboardOverviewDto | undefined,
): DashboardLoanVM[] => {
  if (!overview) {
    return [];
  }
  return overview.loans.map(mapLoanToViewModel);
};

const strategyLabels: Record<string, string> = {
  snowball: "Snowball",
  avalanche: "Avalanche",
  custom: "Custom",
};

const goalLabels: Record<string, string> = {
  fastest_payoff: "Fastest payoff",
  payment_reduction: "Payment reduction",
  interest_savings: "Interest savings",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const monthFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  year: "numeric",
});

const formatLabel = (
  value: string | null | undefined,
  labels: Record<string, string>,
  fallback: string,
) => {
  if (!value) {
    return fallback;
  }
  return (
    labels[value] ??
    value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (segment) => segment.toUpperCase())
  );
};

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return "--";
  }
  return currencyFormatter.format(value);
};

const formatMonthYear = (value: string | Date | null | undefined) => {
  if (!value) {
    return "--";
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return "--";
  }
  return monthFormatter.format(parsed);
};

const buildOverviewCards = (
  overview: DashboardOverviewDto | undefined,
  activeSimulation: DashboardDataResult["activeSimulation"],
): OverviewCardVM[] => {
  const simulation = overview?.activeSimulation ?? activeSimulation;
  if (!simulation) {
    return [];
  }

  const status =
    typeof simulation.status === "string"
      ? simulation.status
      : String(simulation.status ?? "");
  const isRunning = status === "running" || status === "queued";

  const projectedPayoff = simulation.projectedPayoffMonth
    ? formatMonthYear(simulation.projectedPayoffMonth)
    : "--";

  const totalInterestSaved = formatCurrency(simulation.totalInterestSaved ?? 0);

  return [
    {
      title: "Strategy",
      value: formatLabel(simulation.strategy, strategyLabels, "--"),
      status: "ok",
    },
    {
      title: "Goal",
      value: formatLabel(simulation.goal, goalLabels, "--"),
      status: "ok",
    },
    {
      title: "Projected payoff",
      value: projectedPayoff,
      status: isRunning ? "loading" : "ok",
    },
    {
      title: "Total interest saved",
      value: totalInterestSaved,
      status: isRunning ? "loading" : "ok",
    },
  ];
};

export function useDashboardData(): DashboardDataResult {
  const context = useDashboardContext();

  const loans = useMemo(() => mapLoans(context.overview), [context.overview]);

  const currentMonthEntries = useMemo(() => {
    return buildCurrentMonthView(context.overview, context.activeSimulation);
  }, [context.activeSimulation, context.overview]);

  const overviewCards = useMemo(() => {
    return buildOverviewCards(context.overview, context.activeSimulation);
  }, [context.activeSimulation, context.overview]);

  const showEmptyState = useMemo(() => {
    if (context.isLoading) {
      return false;
    }
    if (context.overview && context.overview.activeSimulation === null) {
      return true;
    }
    return context.activeSimulation === null;
  }, [context.activeSimulation, context.isLoading, context.overview]);

  const simulationRunning = useMemo(() => {
    return isSimulationRunning(context.activeSimulation?.status);
  }, [context.activeSimulation?.status]);

  return {
    overview: context.overview,
    loans,
    currentMonthEntries,
    activeSimulation: context.activeSimulation,
    isLoading: context.isLoading,
    error: context.error,
    refetch: context.refetch,
    showEmptyState,
    adherence: context.overview?.adherence,
    graphs: context.overview?.graphs,
    isSimulationRunning: simulationRunning,
    overviewCards,
  };
}
