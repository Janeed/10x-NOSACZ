import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import type {
  ActiveSimulationDashboardDto,
  ActiveSimulationSummary,
  DashboardOverviewCurrentMonth,
  DashboardOverviewDto,
  OverpaymentStatus,
  PaymentStatus,
} from "@/types";
import type { DashboardContextValue } from "@/types/dashboard";

const DASHBOARD_OVERVIEW_QUERY_KEY = [
  "dashboard",
  "overview",
  { include: ["graphs", "adherence"] },
] as const;

const ACTIVE_SIMULATION_QUERY_KEY = ["simulations", "active"] as const;

type DashboardDataProviderProps = PropsWithChildren;

interface ApiErrorBody {
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
  };
  readonly requestId?: string;
}

class DashboardFetchError extends Error {
  readonly status: number;
  readonly requestId?: string;

  constructor(message: string, status: number, requestId?: string) {
    super(message);
    this.name = "DashboardFetchError";
    this.status = status;
    this.requestId = requestId;
  }
}

const DEFAULT_FETCH_OPTIONS: RequestInit = {
  credentials: "same-origin",
  headers: {
    Accept: "application/json",
  },
};

const buildError = async (response: Response): Promise<DashboardFetchError> => {
  let requestId: string | undefined;
  let message = "Unable to load dashboard data.";

  try {
    const body = (await response.json()) as ApiErrorBody;
    requestId =
      body.requestId ?? response.headers.get("X-Request-Id") ?? undefined;
    if (body.error?.message) {
      message = body.error.message;
    }
  } catch {
    requestId = response.headers.get("X-Request-Id") ?? undefined;
  }

  if (response.status === 401) {
    message = "Authentication required.";
  } else if (response.status >= 500) {
    message = "Something went wrong. Please try again.";
  }

  return new DashboardFetchError(message, response.status, requestId);
};

const fetchDashboardOverview =
  async (): Promise<DashboardOverviewDto | null> => {
    const response = await fetch(
      "/api/dashboard/overview?include=graphs,adherence",
      DEFAULT_FETCH_OPTIONS,
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw await buildError(response);
    }

    return (await response.json()) as DashboardOverviewDto;
  };

const fetchActiveSimulation =
  async (): Promise<ActiveSimulationDashboardDto | null> => {
    const response = await fetch(
      "/api/simulations/active",
      DEFAULT_FETCH_OPTIONS,
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw await buildError(response);
    }

    return (await response.json()) as ActiveSimulationDashboardDto;
  };

const normalizeMonthStart = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    const parsed = new Date(value as string);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toISOString();
    }
  } catch {
    // Swallow parse errors and fall back to stringified value
  }

  return String(value ?? "");
};

const mapCurrentMonthFromActive = (
  schedule: ActiveSimulationDashboardDto["currentMonthSchedule"] | undefined,
): DashboardOverviewCurrentMonth | null => {
  if (!schedule) {
    return null;
  }

  return {
    monthStart: normalizeMonthStart(schedule.monthStart),
    entries: schedule.entries.map((entry) => ({
      logId: entry.logId,
      loanId: entry.loanId,
      scheduledPayment: entry.scheduledPayment,
      scheduledOverpayment: entry.scheduledOverpayment,
      paymentStatus: entry.paymentStatus as PaymentStatus,
      overpaymentStatus: entry.overpaymentStatus as OverpaymentStatus,
    })),
  } satisfies DashboardOverviewCurrentMonth;
};

const toSimulationSummary = (
  simulation: ActiveSimulationDashboardDto | null | undefined,
): ActiveSimulationSummary | null => {
  if (!simulation) {
    return null;
  }

  return {
    id: simulation.id,
    strategy: simulation.strategy,
    goal: simulation.goal,
    projectedPayoffMonth: simulation.projectedPayoffMonth,
    totalInterestSaved: simulation.totalInterestSaved,
    status: simulation.status,
    stale: simulation.stale,
  } satisfies ActiveSimulationSummary;
};

const DashboardContext = createContext<DashboardContextValue | undefined>(
  undefined,
);

function DashboardDataProviderInner({ children }: PropsWithChildren) {
  const overviewQuery = useQuery({
    queryKey: DASHBOARD_OVERVIEW_QUERY_KEY,
    queryFn: fetchDashboardOverview,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const activeSimulationQuery = useQuery({
    queryKey: ACTIVE_SIMULATION_QUERY_KEY,
    queryFn: fetchActiveSimulation,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const mergedOverview = useMemo(() => {
    const overview = overviewQuery.data ?? undefined;
    const activeSimulation =
      overview?.activeSimulation ??
      toSimulationSummary(activeSimulationQuery.data) ??
      null;

    const currentMonth =
      overview?.currentMonth ??
      mapCurrentMonthFromActive(
        activeSimulationQuery.data?.currentMonthSchedule,
      ) ??
      null;

    const composedOverview = overview
      ? ({
          ...overview,
          currentMonth,
        } satisfies DashboardOverviewDto)
      : undefined;

    return {
      overview: composedOverview,
      activeSimulation,
    };
  }, [activeSimulationQuery.data, overviewQuery.data]);

  const isPending = overviewQuery.isPending || activeSimulationQuery.isPending;
  const hasInitialData = Boolean(
    overviewQuery.data ?? activeSimulationQuery.data,
  );
  const isRefetching =
    overviewQuery.isRefetching || activeSimulationQuery.isRefetching;
  const isLoading = isPending || (!hasInitialData && isRefetching);

  const error =
    (overviewQuery.error as Error | null) ??
    (activeSimulationQuery.error as Error | null) ??
    null;

  const refetch = useCallback(async () => {
    await Promise.all([
      overviewQuery.refetch(),
      activeSimulationQuery.refetch(),
    ]);
  }, [activeSimulationQuery, overviewQuery]);

  const contextValue = useMemo<DashboardContextValue>(
    () => ({
      overview: mergedOverview.overview,
      activeSimulation: mergedOverview.activeSimulation,
      isLoading,
      error,
      refetch,
    }),
    [
      error,
      isLoading,
      mergedOverview.activeSimulation,
      mergedOverview.overview,
      refetch,
    ],
  );

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  );
}

export function DashboardDataProvider({
  children,
}: DashboardDataProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <DashboardDataProviderInner>{children}</DashboardDataProviderInner>
    </QueryClientProvider>
  );
}

export const DASHBOARD_QUERY_KEYS = {
  overview: DASHBOARD_OVERVIEW_QUERY_KEY,
  activeSimulation: ACTIVE_SIMULATION_QUERY_KEY,
} as const;

export function useDashboardContext(): DashboardContextValue {
  const value = useContext(DashboardContext);
  if (!value) {
    throw new Error(
      "useDashboardContext must be used within a DashboardDataProvider",
    );
  }
  return value;
}
