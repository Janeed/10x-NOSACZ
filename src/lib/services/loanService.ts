import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../db/database.types.ts";
import type {
  CreateLoanCommand,
  LoanDto,
  LoanListQuery,
  LoanListResponse,
  PatchLoanCommand,
  UpdateLoanCommand,
} from "../../types.ts";
import {
  conflictError,
  internalError,
  notFoundError,
  preconditionError,
  validationError,
} from "../errors.ts";
import { invalidateDashboardCache } from "./dashboardService.ts";
import { markActiveSimulationStale } from "./simulationService";

type LoanRow = Database["public"]["Tables"]["loans"]["Row"];
type LoanInsert = Database["public"]["Tables"]["loans"]["Insert"];
type LoanUpdate = Database["public"]["Tables"]["loans"]["Update"];
type LoanChangeEventInsert =
  Database["public"]["Tables"]["loan_change_events"]["Insert"];

type SupabaseErrorPayload = { code: string; message: string } | null;

interface SupabaseErrorDetails {
  supabaseCode: string;
  supabaseMessage: string;
}

const withSupabaseError = (
  error: SupabaseErrorPayload,
): SupabaseErrorDetails | undefined => {
  if (!error) {
    return undefined;
  }

  return {
    supabaseCode: error.code,
    supabaseMessage: error.message,
  };
};

const assertSupabaseClient = (
  supabase: SupabaseClient<Database> | undefined,
): SupabaseClient<Database> => {
  if (!supabase) {
    throw internalError(
      "SUPABASE_CLIENT_MISSING",
      "Supabase client is not available",
    );
  }

  return supabase;
};

const assertUserId = (userId: string | undefined): string => {
  if (!userId) {
    throw internalError(
      "USER_IDENTIFIER_MISSING",
      "User identifier is required to perform loan operations",
    );
  }

  return userId;
};

const toLoanDto = (row: LoanRow): LoanDto => ({
  id: row.id,
  userId: row.user_id,
  principal: row.principal,
  remainingBalance: row.remaining_balance,
  annualRate: row.annual_rate,
  termMonths: row.term_months,
  originalTermMonths: row.original_term_months,
  startMonth: row.start_month,
  isClosed: row.is_closed,
  closedMonth: row.closed_month,
  createdAt: row.created_at,
});

const computeLoanETag = (row: LoanRow): string => {
  const hash = createHash("sha256")
    .update(
      [
        row.id,
        row.created_at,
        row.principal.toString(),
        row.remaining_balance.toString(),
        row.annual_rate.toString(),
        row.term_months.toString(),
        row.original_term_months.toString(),
        row.start_month,
        row.is_closed ? "1" : "0",
        row.closed_month ?? "",
      ].join("|"),
    )
    .digest("base64url");

  return `W/"loan:${row.id}:${hash}"`;
};

const hasSimulationRelevantChange = (
  previous: LoanRow,
  next: LoanRow,
): boolean => {
  return (
    previous.principal !== next.principal ||
    previous.remaining_balance !== next.remaining_balance ||
    previous.annual_rate !== next.annual_rate ||
    previous.term_months !== next.term_months ||
    previous.original_term_months !== next.original_term_months ||
    previous.start_month !== next.start_month ||
    previous.is_closed !== next.is_closed ||
    previous.closed_month !== next.closed_month
  );
};

const formatEffectiveMonth = (): string => {
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  return monthStart.toISOString().slice(0, 10);
};

const buildLoanChangeEvents = (
  previous: LoanRow,
  next: LoanRow,
  userId: string,
): LoanChangeEventInsert[] => {
  const effectiveMonth = formatEffectiveMonth();
  const events: LoanChangeEventInsert[] = [];

  if (previous.principal !== next.principal) {
    events.push({
      user_id: userId,
      loan_id: previous.id,
      change_type: "principal_correction",
      effective_month: effectiveMonth,
      old_principal: previous.principal,
      new_principal: next.principal,
    });
  }

  if (previous.annual_rate !== next.annual_rate) {
    events.push({
      user_id: userId,
      loan_id: previous.id,
      change_type: "rate_change",
      effective_month: effectiveMonth,
      old_annual_rate: previous.annual_rate,
      new_annual_rate: next.annual_rate,
    });
  }

  if (previous.term_months !== next.term_months) {
    events.push({
      user_id: userId,
      loan_id: previous.id,
      change_type: "term_adjustment",
      effective_month: effectiveMonth,
      old_term_months: previous.term_months,
      new_term_months: next.term_months,
    });
  }

  if (previous.remaining_balance !== next.remaining_balance) {
    events.push({
      user_id: userId,
      loan_id: previous.id,
      change_type: "balance_adjustment",
      effective_month: effectiveMonth,
      old_remaining_balance: previous.remaining_balance,
      new_remaining_balance: next.remaining_balance,
    });
  }

  return events;
};

const recordLoanChangeEvents = async (
  supabase: SupabaseClient<Database>,
  events: LoanChangeEventInsert[],
): Promise<void> => {
  if (events.length === 0) {
    return;
  }

  let result;
  try {
    result = await supabase.from("loan_change_events").insert(events);
  } catch (cause) {
    throw internalError(
      "SUPABASE_UNAVAILABLE",
      "Unable to record loan change events",
      { cause },
    );
  }

  const { error } = result;

  if (error) {
    throw internalError("SUPABASE_ERROR", "Failed to record loan change events", {
      cause: error,
      details: withSupabaseError(error),
    });
  }
};

const ensureLoanNotInRunningSimulation = async (
  supabase: SupabaseClient<Database>,
  userId: string,
  loanId: string,
): Promise<void> => {
  let runningSimulations;
  try {
    runningSimulations = await supabase
      .from("simulations")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "running");
  } catch (cause) {
    throw internalError(
      "SUPABASE_UNAVAILABLE",
      "Unable to verify simulation conflicts",
      { cause },
    );
  }

  const { data: sims, error: simError } = runningSimulations;

  if (simError) {
    throw internalError(
      "SUPABASE_ERROR",
      "Failed to check simulation conflicts",
      {
        cause: simError,
        details: withSupabaseError(simError),
      },
    );
  }

  if (!sims || sims.length === 0) {
    return;
  }

  const simulationIds = sims.map((item) => item.id);
  if (simulationIds.length === 0) {
    return;
  }

  let snapshotResult;
  try {
    snapshotResult = await supabase
      .from("simulation_loan_snapshots")
      .select("id")
      .eq("user_id", userId)
      .eq("loan_id", loanId)
      .in("simulation_id", simulationIds)
      .limit(1);
  } catch (cause) {
    throw internalError(
      "SUPABASE_UNAVAILABLE",
      "Unable to verify loan snapshot conflicts",
      { cause },
    );
  }

  const { data: snapshots, error: snapshotError } = snapshotResult;

  if (snapshotError) {
    throw internalError(
      "SUPABASE_ERROR",
      "Failed to verify loan snapshot conflicts",
      {
        cause: snapshotError,
        details: withSupabaseError(snapshotError),
      },
    );
  }

  if (snapshots && snapshots.length > 0) {
    throw conflictError(
      "LOAN_SIMULATION_RUNNING",
      "Loan cannot be deleted while a simulation referencing it is running",
    );
  }
};

const fetchLoanRow = async (
  supabase: SupabaseClient<Database>,
  userId: string,
  loanId: string,
): Promise<LoanRow> => {
  let result;
  try {
    result = await supabase
      .from("loans")
      .select("*")
      .eq("user_id", userId)
      .eq("id", loanId)
      .maybeSingle();
  } catch (cause) {
    throw internalError("SUPABASE_UNAVAILABLE", "Unable to load loan", {
      cause,
    });
  }

  const { data, error } = result;

  if (error) {
    throw internalError("SUPABASE_ERROR", "Failed to load loan", {
      cause: error,
      details: withSupabaseError(error),
    });
  }

  if (!data) {
    throw notFoundError("LOAN_NOT_FOUND", "Loan not found");
  }

  return data;
};

const buildPagination = (
  pageSize: number,
  totalItems: number,
): { totalItems: number; totalPages: number } => {
  if (totalItems <= 0) {
    return { totalItems: 0, totalPages: 0 };
  }

  const totalPages = Math.ceil(totalItems / pageSize);
  return {
    totalItems,
    totalPages,
  };
};

const applySorting = (
  query: LoanListQuery,
): { column: keyof LoanRow; ascending: boolean } => {
  const column = (query.sort ?? "created_at") as keyof LoanRow;
  const ascending = (query.order ?? "desc") === "asc";
  return { column, ascending };
};

export interface LoanLookupResult {
  loan: LoanDto;
  etag: string;
}

export interface LoanMutationResult {
  loan: LoanDto;
  etag: string;
  staleSimulation: boolean;
}

export interface LoanDeletionResult {
  staleSimulation: boolean;
}

export async function listLoans(
  supabaseClient: SupabaseClient<Database> | undefined,
  userId: string | undefined,
  query: LoanListQuery,
): Promise<LoanListResponse> {
  const supabase = assertSupabaseClient(supabaseClient);
  const resolvedUserId = assertUserId(userId);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { column, ascending } = applySorting(query);

  let request;
  try {
    request = supabase
      .from("loans")
      .select("*", { count: "exact" })
      .eq("user_id", resolvedUserId)
      .order(column as string, { ascending });

    if (query.isClosed !== undefined) {
      request = request.eq("is_closed", query.isClosed);
    }

    request = request.range(from, to);
  } catch (cause) {
    throw internalError("SUPABASE_UNAVAILABLE", "Unable to list loans", {
      cause,
    });
  }

  let response;
  try {
    response = await request;
  } catch (cause) {
    throw internalError("SUPABASE_UNAVAILABLE", "Unable to list loans", {
      cause,
    });
  }

  const { data, error, count } = response;

  if (error) {
    throw internalError("SUPABASE_ERROR", "Failed to list loans", {
      cause: error,
      details: withSupabaseError(error),
    });
  }

  const rows = data ?? [];
  const items = rows.map(toLoanDto);
  const totalItems = count ?? rows.length;
  const totals = buildPagination(pageSize, totalItems);

  return {
    items,
    page,
    pageSize,
    totalItems: totals.totalItems,
    totalPages: totals.totalPages,
  };
}

export async function createLoan(
  supabaseClient: SupabaseClient<Database> | undefined,
  userId: string | undefined,
  command: CreateLoanCommand,
): Promise<LoanMutationResult> {
  const supabase = assertSupabaseClient(supabaseClient);
  const resolvedUserId = assertUserId(userId);

  const insertPayload: LoanInsert = {
    user_id: resolvedUserId,
    principal: command.principal,
    remaining_balance: command.remainingBalance,
    annual_rate: command.annualRate,
    term_months: command.termMonths,
    original_term_months: command.originalTermMonths,
    start_month: command.startMonth,
    is_closed: false,
    closed_month: null,
  };

  if (command.id) {
    insertPayload.id = command.id;
  }

  let result;
  try {
    result = await supabase
      .from("loans")
      .insert(insertPayload)
      .select("*")
      .maybeSingle();
  } catch (cause) {
    throw internalError("SUPABASE_UNAVAILABLE", "Unable to create loan", {
      cause,
    });
  }

  const { data, error } = result;

  if (error) {
    if (error.code === "23505") {
      throw conflictError(
        "LOAN_DUPLICATE",
        "A loan with the provided identifier already exists",
        withSupabaseError(error),
      );
    }

    throw internalError("SUPABASE_ERROR", "Failed to create loan", {
      cause: error,
      details: withSupabaseError(error),
    });
  }

  if (!data) {
    throw internalError("SUPABASE_ERROR", "Loan insert returned no data");
  }

  const staleSimulation = await markActiveSimulationStale(
    supabase,
    resolvedUserId,
  );

  const dto = toLoanDto(data);
  if (staleSimulation) {
    dto.staleSimulation = true;
  }

  // Invalidate dashboard cache since loan data changed
  invalidateDashboardCache(resolvedUserId);

  return {
    loan: dto,
    etag: computeLoanETag(data),
    staleSimulation,
  };
}

export async function getLoan(
  supabaseClient: SupabaseClient<Database> | undefined,
  userId: string | undefined,
  loanId: string,
): Promise<LoanLookupResult> {
  const supabase = assertSupabaseClient(supabaseClient);
  const resolvedUserId = assertUserId(userId);

  const loan = await fetchLoanRow(supabase, resolvedUserId, loanId);

  return {
    loan: toLoanDto(loan),
    etag: computeLoanETag(loan),
  };
}

export async function updateLoan(
  supabaseClient: SupabaseClient<Database> | undefined,
  userId: string | undefined,
  loanId: string,
  command: UpdateLoanCommand,
  expectedEtag?: string,
): Promise<LoanMutationResult> {
  const supabase = assertSupabaseClient(supabaseClient);
  const resolvedUserId = assertUserId(userId);

  const existing = await fetchLoanRow(supabase, resolvedUserId, loanId);

  const currentEtag = computeLoanETag(existing);
  const normalizedExpectedEtag = expectedEtag?.trim();

  if (!normalizedExpectedEtag) {
    throw preconditionError(
      "LOAN_ETAG_REQUIRED",
      "If-Match header is required to update a loan",
    );
  }

  if (normalizedExpectedEtag !== currentEtag) {
    throw preconditionError(
      "LOAN_ETAG_MISMATCH",
      "Loan has been modified by another process. Refresh and retry.",
    );
  }

  if (command.originalTermMonths !== existing.original_term_months) {
    throw validationError(
      "LOAN_ORIGINAL_TERM_IMMUTABLE",
      "originalTermMonths cannot be modified after loan creation",
    );
  }

  const updatePayload: LoanUpdate = {
    principal: command.principal,
    remaining_balance: command.remainingBalance,
    annual_rate: command.annualRate,
    term_months: command.termMonths,
    original_term_months: command.originalTermMonths,
    start_month: command.startMonth,
    is_closed: command.isClosed ?? false,
    closed_month: command.closedMonth ?? null,
  };

  let result;
  try {
    result = await supabase
      .from("loans")
      .update(updatePayload)
      .eq("user_id", resolvedUserId)
      .eq("id", loanId)
      .select("*")
      .maybeSingle();
  } catch (cause) {
    throw internalError("SUPABASE_UNAVAILABLE", "Unable to update loan", {
      cause,
    });
  }

  const { data, error } = result;

  if (error) {
    throw internalError("SUPABASE_ERROR", "Failed to update loan", {
      cause: error,
      details: withSupabaseError(error),
    });
  }

  if (!data) {
    throw notFoundError("LOAN_NOT_FOUND", "Loan not found");
  }

  const changes = buildLoanChangeEvents(existing, data, resolvedUserId);
  await recordLoanChangeEvents(supabase, changes);

  const simulationChanged = hasSimulationRelevantChange(existing, data);
  const staleSimulation = simulationChanged
    ? await markActiveSimulationStale(supabase, resolvedUserId)
    : false;

  const dto = toLoanDto(data);
  if (staleSimulation) {
    dto.staleSimulation = true;
  }

  // Invalidate dashboard cache since loan data changed
  invalidateDashboardCache(resolvedUserId);

  return {
    loan: dto,
    etag: computeLoanETag(data),
    staleSimulation,
  };
}

export async function patchLoan(
  supabaseClient: SupabaseClient<Database> | undefined,
  userId: string | undefined,
  loanId: string,
  command: PatchLoanCommand,
  expectedEtag?: string,
): Promise<LoanMutationResult> {
  const supabase = assertSupabaseClient(supabaseClient);
  const resolvedUserId = assertUserId(userId);

  const existing = await fetchLoanRow(supabase, resolvedUserId, loanId);

  const currentEtag = computeLoanETag(existing);
  const normalizedExpectedEtag = expectedEtag?.trim();

  if (normalizedExpectedEtag && normalizedExpectedEtag !== currentEtag) {
    throw preconditionError(
      "LOAN_ETAG_MISMATCH",
      "Loan has been modified by another process. Refresh and retry.",
    );
  }

  if (
    command.originalTermMonths !== undefined &&
    command.originalTermMonths !== existing.original_term_months
  ) {
    throw validationError(
      "LOAN_ORIGINAL_TERM_IMMUTABLE",
      "originalTermMonths cannot be modified after loan creation",
    );
  }

  const updatePayload: LoanUpdate = {};

  if (command.principal !== undefined) {
    updatePayload.principal = command.principal;
  }
  if (command.remainingBalance !== undefined) {
    updatePayload.remaining_balance = command.remainingBalance;
  }
  if (command.annualRate !== undefined) {
    updatePayload.annual_rate = command.annualRate;
  }
  if (command.termMonths !== undefined) {
    updatePayload.term_months = command.termMonths;
  }
  if (command.originalTermMonths !== undefined) {
    updatePayload.original_term_months = command.originalTermMonths;
  }
  if (command.startMonth !== undefined) {
    updatePayload.start_month = command.startMonth;
  }
  if (command.isClosed !== undefined) {
    updatePayload.is_closed = command.isClosed;
  }
  if (command.closedMonth !== undefined) {
    updatePayload.closed_month = command.closedMonth;
  }

  if (Object.keys(updatePayload).length === 0) {
    return {
      loan: toLoanDto(existing),
      etag: computeLoanETag(existing),
      staleSimulation: false,
    };
  }

  let result;
  try {
    result = await supabase
      .from("loans")
      .update(updatePayload)
      .eq("user_id", resolvedUserId)
      .eq("id", loanId)
      .select("*")
      .maybeSingle();
  } catch (cause) {
    throw internalError("SUPABASE_UNAVAILABLE", "Unable to patch loan", {
      cause,
    });
  }

  const { data, error } = result;

  if (error) {
    throw internalError("SUPABASE_ERROR", "Failed to patch loan", {
      cause: error,
      details: withSupabaseError(error),
    });
  }

  if (!data) {
    throw notFoundError("LOAN_NOT_FOUND", "Loan not found");
  }

  const changes = buildLoanChangeEvents(existing, data, resolvedUserId);
  await recordLoanChangeEvents(supabase, changes);

  const simulationChanged = hasSimulationRelevantChange(existing, data);
  const staleSimulation = simulationChanged
    ? await markActiveSimulationStale(supabase, resolvedUserId)
    : false;

  const dto = toLoanDto(data);
  if (staleSimulation) {
    dto.staleSimulation = true;
  }

  // Invalidate dashboard cache since loan data changed
  invalidateDashboardCache(resolvedUserId);

  return {
    loan: dto,
    etag: computeLoanETag(data),
    staleSimulation,
  };
}

export async function deleteLoan(
  supabaseClient: SupabaseClient<Database> | undefined,
  userId: string | undefined,
  loanId: string,
): Promise<LoanDeletionResult> {
  const supabase = assertSupabaseClient(supabaseClient);
  const resolvedUserId = assertUserId(userId);

  await fetchLoanRow(supabase, resolvedUserId, loanId);
  await ensureLoanNotInRunningSimulation(supabase, resolvedUserId, loanId);

  let result;
  try {
    result = await supabase
      .from("loans")
      .delete()
      .eq("user_id", resolvedUserId)
      .eq("id", loanId);
  } catch (cause) {
    throw internalError("SUPABASE_UNAVAILABLE", "Unable to delete loan", {
      cause,
    });
  }

  const { error } = result;

  if (error) {
    throw internalError("SUPABASE_ERROR", "Failed to delete loan", {
      cause: error,
      details: withSupabaseError(error),
    });
  }

  const staleSimulation = await markActiveSimulationStale(
    supabase,
    resolvedUserId,
  );

  // Invalidate dashboard cache since loan data changed
  invalidateDashboardCache(resolvedUserId);

  return { staleSimulation };
}
