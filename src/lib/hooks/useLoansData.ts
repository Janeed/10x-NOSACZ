import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { LoanListResponse } from "@/types";
import {
  type ApiErrorShape,
  type LoanListItemVM,
  type LoanSortField,
  type PaginationState,
  type SortingState,
} from "@/lib/viewModels/loans";
import { useApiFetch } from "./useApiFetch";
import type { ApiFetchMeta } from "./useApiFetch";

interface UseLoansDataOptions {
  readonly initialPage?: number;
  readonly initialPageSize?: number;
  readonly initialSorting?: SortingState;
}

interface UseLoansDataResult {
  readonly loans: LoanListItemVM[];
  readonly isLoading: boolean;
  readonly error: ApiErrorShape | null;
  readonly pagination: PaginationState;
  readonly sorting: SortingState;
  readonly listMeta: ApiFetchMeta | null;
  readonly changePage: (page: number) => void;
  readonly changePageSize: (pageSize: number) => void;
  readonly changeSorting: (field: LoanSortField) => void;
  readonly refetch: () => Promise<void>;
  readonly getLoanEtag: (id: string) => string | undefined;
  readonly setLoanEtag: (id: string, etag?: string | null) => void;
  readonly upsertLoan: (
    loan: LoanListItemVM,
    options?: { etag?: string | null | undefined },
  ) => void;
  readonly removeLoan: (id: string) => void;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_SORTING: SortingState = {
  field: "created_at",
  order: "desc",
};

const buildRequestPath = (
  sorting: SortingState,
  pagination: PaginationState,
) => {
  const params = new URLSearchParams();
  params.set("page", String(pagination.page));
  params.set("pageSize", String(pagination.pageSize));
  params.set("sort", sorting.field);
  params.set("order", sorting.order);
  return `/api/loans?${params.toString()}`;
};

const toPaginationState = (response: LoanListResponse): PaginationState => {
  return {
    page: response.page,
    pageSize: response.pageSize,
    totalItems: response.totalItems,
    totalPages: response.totalPages,
  } satisfies PaginationState;
};

/**
 * Handles loan listing data: fetching, pagination, sorting, error state, and ETag caching.
 */
export function useLoansData(
  options: UseLoansDataOptions = {},
): UseLoansDataResult {
  const initialSorting = options.initialSorting ?? DEFAULT_SORTING;
  const initialPage = options.initialPage ?? DEFAULT_PAGE;
  const initialPageSize = options.initialPageSize ?? DEFAULT_PAGE_SIZE;

  const { apiFetch } = useApiFetch();
  const isMountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const etagRef = useRef<Map<string, string>>(new Map());

  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [pagination, setPagination] = useState<PaginationState>({
    page: initialPage,
    pageSize: initialPageSize,
    totalItems: 0,
    totalPages: 1,
  });
  const [loans, setLoans] = useState<LoanListItemVM[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [listMeta, setListMeta] = useState<ApiFetchMeta | null>(null);

  const requestPath = useMemo(() => {
    return buildRequestPath(sorting, pagination);
  }, [pagination.page, pagination.pageSize, sorting.field, sorting.order]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const runFetch = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    const result = await apiFetch<LoanListResponse>({
      path: requestPath,
      method: "GET",
      signal: controller.signal,
    });

    if (!isMountedRef.current || controller.signal.aborted) {
      return;
    }

    setListMeta(result.meta ?? null);

    if (!result.ok) {
      setIsLoading(false);
      setError(result.error);
      return;
    }

    if (!result.data) {
      setIsLoading(false);
      setError({
        code: "INVALID_RESPONSE",
        message: "Loan list response was empty.",
        status: 500,
      });
      return;
    }

    const response = result.data;
    const etagLookup = etagRef.current;

    const mappedLoans = response.items.map((loan) => {
      const storedEtag = etagLookup.get(loan.id);
      return {
        ...loan,
        etag: storedEtag ?? undefined,
      } satisfies LoanListItemVM;
    });

    const visibleIds = new Set(mappedLoans.map((loan) => loan.id));
    etagLookup.forEach((_, key) => {
      if (!visibleIds.has(key)) {
        etagLookup.delete(key);
      }
    });

    setLoans(mappedLoans);
    setPagination(toPaginationState(response));
    setIsLoading(false);
    setError(null);
  }, [apiFetch, requestPath]);

  useEffect(() => {
    void runFetch();
  }, [runFetch]);

  const changePage = useCallback((page: number) => {
    setPagination((current) => {
      const nextPage = Math.max(1, Math.floor(page));
      if (current.page === nextPage) {
        return current;
      }
      return {
        ...current,
        page: nextPage,
      } satisfies PaginationState;
    });
  }, []);

  const changePageSize = useCallback((pageSize: number) => {
    setPagination((current) => {
      const normalized = Math.max(1, Math.floor(pageSize));
      if (current.pageSize === normalized) {
        return current;
      }
      return {
        ...current,
        page: 1,
        pageSize: normalized,
      } satisfies PaginationState;
    });
  }, []);

  const changeSorting = useCallback((field: LoanSortField) => {
    setSorting((current) => {
      if (current.field === field) {
        const nextOrder = current.order === "asc" ? "desc" : "asc";
        return {
          field,
          order: nextOrder,
        } satisfies SortingState;
      }
      return {
        field,
        order: "asc",
      } satisfies SortingState;
    });
  }, []);

  const refetch = useCallback(async () => {
    await runFetch();
  }, [runFetch]);

  const getLoanEtag = useCallback((id: string) => {
    return etagRef.current.get(id);
  }, []);

  const setLoanEtag = useCallback((id: string, etag?: string | null) => {
    if (!id) {
      return;
    }

    const store = etagRef.current;
    if (!etag) {
      store.delete(id);
      return;
    }

    store.set(id, etag);
  }, []);

  const upsertLoan = useCallback(
    (loan: LoanListItemVM, options?: { etag?: string | null | undefined }) => {
      const resolvedEtag = options?.etag ?? loan.etag;
      if (resolvedEtag) {
        etagRef.current.set(loan.id, resolvedEtag);
      }

      setLoans((current) => {
        const index = current.findIndex((item) => item.id === loan.id);
        const nextLoan: LoanListItemVM = {
          ...loan,
          etag: resolvedEtag ?? undefined,
        };

        if (index === -1) {
          return [nextLoan, ...current];
        }

        const next = current.slice();
        next[index] = {
          ...current[index],
          ...nextLoan,
        } satisfies LoanListItemVM;
        return next;
      });
    },
    [],
  );

  const removeLoan = useCallback((id: string) => {
    if (!id) {
      return;
    }

    etagRef.current.delete(id);
    setLoans((current) => current.filter((loan) => loan.id !== id));
  }, []);

  return {
    loans,
    isLoading,
    error,
    pagination,
    sorting,
    listMeta,
    changePage,
    changePageSize,
    changeSorting,
    refetch,
    getLoanEtag,
    setLoanEtag,
    upsertLoan,
    removeLoan,
  } as const;
}
