import type {
  CreateLoanCommand,
  LoanDto,
  LoanListResponse,
  PatchLoanCommand,
  UpdateLoanCommand,
} from "@/types";

export interface LoanListItemVM extends LoanDto {
  etag?: string;
  staleSimulation?: boolean;
}

export type LoanSortField = "created_at" | "start_month" | "remaining_balance";

export type SortingOrder = "asc" | "desc";

export interface SortingState {
  field: LoanSortField;
  order: SortingOrder;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

export interface LoanFormValues {
  principal: number | "";
  remainingBalance: number | "";
  annualRate: number | "";
  termMonths: number | "";
  originalTermMonths: number | "";
  startMonth: string;
  rateChangeEffective: "current" | "next";
}

export interface LoanFormErrors {
  principal?: string;
  remainingBalance?: string;
  annualRate?: string;
  termMonths?: string;
  originalTermMonths?: string;
  startMonth?: string;
  rateChangeEffective?: string;
  nonFieldError?: string;
}

export type StaleTrigger =
  | "edit"
  | "delete"
  | "balance_adjust"
  | "rate_change"
  | "create";

export interface StaleState {
  isStale: boolean;
  trigger?: StaleTrigger;
}

export interface LoanPatchBalanceCommandVM {
  remainingBalance: number;
}

export interface ApiErrorIssue {
  path?: string;
  message: string;
  code?: string;
}

export interface ApiErrorShape {
  code: string;
  message: string;
  status: number;
  issues?: ApiErrorIssue[];
}

export type LoanListResult = LoanListResponse;
export type CreateLoanPayload = CreateLoanCommand;
export type UpdateLoanPayload = UpdateLoanCommand;
export type PatchLoanPayload = PatchLoanCommand;
