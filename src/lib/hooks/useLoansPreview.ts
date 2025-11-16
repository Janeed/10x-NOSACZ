import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { LoanListResponse } from "@/types";
import type { LoanPreviewVM } from "@/lib/viewModels/wizardSimulation";
import type { ApiErrorShape } from "@/lib/viewModels/loans";
import type { ApiFetchMeta } from "./useApiFetch";
import { useApiFetch } from "./useApiFetch";

interface UseLoansPreviewOptions {
  readonly enabled?: boolean;
  readonly pageSize?: number;
}

interface UseLoansPreviewResult {
  readonly loans: LoanPreviewVM[];
  readonly isLoading: boolean;
  readonly error: ApiErrorShape | null;
  readonly meta: ApiFetchMeta | null;
  readonly hasLoans: boolean;
  readonly refetch: () => Promise<void>;
}

const DEFAULT_PAGE_SIZE = 100;
const REQUEST_BASE = "/api/loans";

const buildRequestPath = (pageSize: number): string => {
  const params = new URLSearchParams();
  params.set("page", "1");
  params.set("pageSize", String(pageSize));
  params.set("isClosed", "false");
  return `${REQUEST_BASE}?${params.toString()}`;
};

const estimateRemainingTerm = (
  loan: LoanListResponse["items"][number],
): number => {
  if (typeof loan.termMonths === "number" && !Number.isNaN(loan.termMonths)) {
    return Math.max(0, Math.floor(loan.termMonths));
  }

  if (
    typeof loan.originalTermMonths === "number" &&
    !Number.isNaN(loan.originalTermMonths)
  ) {
    return Math.max(0, Math.floor(loan.originalTermMonths));
  }

  return 0;
};

const resolveHighlight = (
  loan: LoanListResponse["items"][number],
): LoanPreviewVM["highlight"] => {
  const highRateThreshold = 0.08; // 8%
  const smallBalanceThreshold = 5000;

  if (
    typeof loan.annualRate === "number" &&
    loan.annualRate >= highRateThreshold
  ) {
    return "highRate";
  }

  if (
    typeof loan.remainingBalance === "number" &&
    loan.remainingBalance > 0 &&
    loan.remainingBalance <= smallBalanceThreshold
  ) {
    return "smallBalance";
  }

  return undefined;
};

const mapLoanToPreview = (
  loan: LoanListResponse["items"][number],
): LoanPreviewVM => {
  const remainingTermMonths = estimateRemainingTerm(loan);

  return {
    ...loan,
    remainingTermMonths,
    highlight: resolveHighlight(loan),
  } satisfies LoanPreviewVM;
};

/**
 * Fetches the user's open loans to display in the wizard preview sidebar.
 */
export function useLoansPreview(
  options: UseLoansPreviewOptions = {},
): UseLoansPreviewResult {
  const { enabled = true, pageSize = DEFAULT_PAGE_SIZE } = options;
  const { apiFetch } = useApiFetch();
  const isMountedRef = useRef(true);

  const [loans, setLoans] = useState<LoanPreviewVM[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [meta, setMeta] = useState<ApiFetchMeta | null>(null);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const requestPath = useMemo(() => {
    return buildRequestPath(pageSize);
  }, [pageSize]);

  const runFetch = useCallback(async () => {
    if (!enabled) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await apiFetch<LoanListResponse>({
      path: requestPath,
      method: "GET",
    });

    if (!isMountedRef.current) {
      return;
    }

    setMeta(result.meta ?? null);

    if (!result.ok) {
      setIsLoading(false);
      setError(result.error);
      return;
    }

    const payload = result.data;
    if (!payload) {
      setLoans([]);
      setIsLoading(false);
      setError({
        code: "INVALID_RESPONSE",
        message: "Loan preview response was empty.",
        status: 500,
      });
      return;
    }

    const mapped = payload.items.map(mapLoanToPreview);
    setLoans(mapped);
    setIsLoading(false);
    setError(null);
  }, [apiFetch, enabled, requestPath]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void runFetch();
  }, [enabled, runFetch]);

  const refetch = useCallback(async () => {
    await runFetch();
  }, [runFetch]);

  return {
    loans,
    isLoading,
    error,
    meta,
    hasLoans: loans.length > 0,
    refetch,
  } as const;
}
