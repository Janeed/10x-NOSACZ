import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../db/database.types.ts";
import type {
  MonthlyExecutionLogDto,
  MonthlyExecutionLogListQuery,
  MonthlyExecutionLogListResponse,
  CreateMonthlyExecutionLogCommand,
  PatchMonthlyExecutionLogCommand,
} from "../../types.ts";
import {
  conflictError,
  internalError,
  notFoundError,
  validationError,
} from "../errors";
import { logger } from "../logger";
import { invalidateDashboardCache } from "./dashboardService";

type MonthlyExecutionLogRow =
  Database["public"]["Tables"]["monthly_execution_logs"]["Row"];
type MonthlyExecutionLogInsert =
  Database["public"]["Tables"]["monthly_execution_logs"]["Insert"];
type MonthlyExecutionLogUpdate =
  Database["public"]["Tables"]["monthly_execution_logs"]["Update"];

const SELECT_COLUMNS = `
  id,
  loan_id,
  user_id,
  month_start,
  payment_status,
  overpayment_status,
  scheduled_overpayment_amount,
  actual_overpayment_amount,
  interest_portion,
  principal_portion,
  remaining_balance_after,
  payment_executed_at,
  overpayment_executed_at,
  reason_code,
  created_at
`;

const toDto = (row: MonthlyExecutionLogRow): MonthlyExecutionLogDto => {
  return {
    id: row.id,
    loanId: row.loan_id,
    userId: row.user_id,
    monthStart: row.month_start,
    paymentStatus: row.payment_status,
    overpaymentStatus: row.overpayment_status,
    scheduledOverpaymentAmount: row.scheduled_overpayment_amount,
    actualOverpaymentAmount: row.actual_overpayment_amount,
    interestPortion: row.interest_portion,
    principalPortion: row.principal_portion,
    remainingBalanceAfter: row.remaining_balance_after,
    paymentExecutedAt: row.payment_executed_at,
    overpaymentExecutedAt: row.overpayment_executed_at,
    reasonCode: row.reason_code,
    createdAt: row.created_at,
  };
};

const normalizeMonthStart = (monthStart: string): string => {
  const date = new Date(monthStart);
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().split("T")[0];
};

const trimReason = (reasonCode: string | undefined): string | null => {
  const trimmed = reasonCode?.trim();
  return trimmed || null;
};

const validateStatusTransition = (
  currentPaymentStatus: string,
  currentOverpaymentStatus: string,
  incomingPaymentStatus?: string,
  incomingOverpaymentStatus?: string,
): void => {
  const paymentTransitions: Record<string, string[]> = {
    pending: ["paid", "backfilled"],
    backfilled: [],
    paid: [],
  };

  const overpaymentTransitions: Record<string, string[]> = {
    scheduled: ["executed", "skipped", "backfilled"],
    executed: [],
    skipped: [],
    backfilled: [],
  };

  if (
    incomingPaymentStatus &&
    !paymentTransitions[currentPaymentStatus]?.includes(incomingPaymentStatus)
  ) {
    throw validationError(
      "ERR_INVALID_STATUS_TRANSITION",
      `Invalid payment status transition from ${currentPaymentStatus} to ${incomingPaymentStatus}`,
    );
  }

  if (
    incomingOverpaymentStatus &&
    !overpaymentTransitions[currentOverpaymentStatus]?.includes(
      incomingOverpaymentStatus,
    )
  ) {
    throw validationError(
      "ERR_INVALID_STATUS_TRANSITION",
      `Invalid overpayment status transition from ${currentOverpaymentStatus} to ${incomingOverpaymentStatus}`,
    );
  }
};

const requiresReason = (status: string): boolean => {
  return status === "skipped" || status === "backfilled";
};

const markActiveSimulationStale = async (
  userId: string,
  supabase: SupabaseClient<Database>,
): Promise<void> => {
  const { error } = await supabase
    .from("simulations")
    .update({ stale: true })
    .eq("user_id", userId)
    .eq("is_active", true)
    .neq("stale", true);

  if (error) {
    logger.error(
      "mark_simulations_stale",
      "Failed to mark active simulations as stale",
      { userId, error: error.message },
    );
    throw internalError("ERR_INTERNAL", "Failed to update simulations");
  }
};

export const listLogs = async (
  query: MonthlyExecutionLogListQuery,
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<MonthlyExecutionLogListResponse> => {
  const {
    loanId,
    monthStart,
    paymentStatus,
    overpaymentStatus,
    page = 1,
    pageSize = 20,
    sort = "month_start",
    order = "desc",
  } = query;

  let dbQuery = supabase
    .from("monthly_execution_logs")
    .select(SELECT_COLUMNS, { count: "exact" })
    .eq("user_id", userId);

  if (loanId) {
    dbQuery = dbQuery.eq("loan_id", loanId);
  }
  if (monthStart) {
    dbQuery = dbQuery.eq("month_start", monthStart);
  }
  if (paymentStatus) {
    dbQuery = dbQuery.eq("payment_status", paymentStatus);
  }
  if (overpaymentStatus) {
    dbQuery = dbQuery.eq("overpayment_status", overpaymentStatus);
  }

  dbQuery = dbQuery.order(sort, { ascending: order === "asc" });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  dbQuery = dbQuery.range(from, to);

  const { data, error, count } = await dbQuery;

  if (error) {
    logger.error("list_logs", "Failed to list monthly execution logs", {
      userId,
      error: error.message,
    });
    throw internalError("ERR_INTERNAL", "Failed to retrieve logs");
  }

  const items = data?.map(toDto) || [];
  const totalItems = count || 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  return {
    items,
    page,
    pageSize,
    totalItems,
    totalPages,
  };
};

export const createLog = async (
  cmd: CreateMonthlyExecutionLogCommand,
  supabase: SupabaseClient<Database>,
  userId: string,
  requestId: string,
): Promise<MonthlyExecutionLogDto> => {
  // Check loan existence and ownership
  const { data: loan, error: loanError } = await supabase
    .from("loans")
    .select("id, is_closed")
    .eq("id", cmd.loanId)
    .eq("user_id", userId)
    .single();

  if (loanError || !loan) {
    logger.warn("create_log", "Loan not found or not owned", {
      userId,
      loanId: cmd.loanId,
      requestId,
    });
    throw notFoundError("ERR_NOT_FOUND", "Loan not found");
  }

  if (loan.is_closed) {
    logger.warn("create_log", "Attempt to create log for closed loan", {
      userId,
      loanId: cmd.loanId,
      requestId,
    });
    throw conflictError("ERR_CLOSED_LOAN", "Cannot create log for closed loan");
  }

  const normalizedMonthStart = normalizeMonthStart(cmd.monthStart);

  const insertData: MonthlyExecutionLogInsert = {
    loan_id: cmd.loanId,
    user_id: userId,
    month_start: normalizedMonthStart,
    payment_status: cmd.paymentStatus,
    overpayment_status: cmd.overpaymentStatus,
    scheduled_overpayment_amount: cmd.scheduledOverpaymentAmount,
    actual_overpayment_amount: cmd.actualOverpaymentAmount,
    interest_portion: cmd.interestPortion,
    principal_portion: cmd.principalPortion,
    remaining_balance_after: cmd.remainingBalanceAfter,
    reason_code: trimReason(cmd.reasonCode ?? undefined),
  };

  const { data, error } = await supabase
    .from("monthly_execution_logs")
    .insert(insertData)
    .select(SELECT_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") {
      // unique constraint violation
      logger.warn("create_log", "Duplicate monthly execution log", {
        userId,
        loanId: cmd.loanId,
        monthStart: normalizedMonthStart,
        requestId,
      });
      throw conflictError(
        "ERR_UNIQUE_CONSTRAINT",
        "Log already exists for this loan and month",
      );
    }
    logger.error("create_log", "Failed to create monthly execution log", {
      userId,
      error: error.message,
      requestId,
    });
    throw internalError("ERR_INTERNAL", "Failed to create log");
  }

  // Mark simulations stale if overpayment is backfilled or skipped
  if (
    cmd.overpaymentStatus === "backfilled" ||
    cmd.overpaymentStatus === "skipped"
  ) {
    await markActiveSimulationStale(userId, supabase);
  }

  logger.info("create_log", "Monthly execution log created", {
    userId,
    logId: data.id,
    requestId,
  });

  // Invalidate dashboard cache since execution log data changed
  invalidateDashboardCache(userId);

  return toDto(data);
};

export const patchLog = async (
  logId: string,
  cmd: PatchMonthlyExecutionLogCommand,
  supabase: SupabaseClient<Database>,
  userId: string,
  requestId: string,
): Promise<MonthlyExecutionLogDto> => {
  // Fetch existing log
  const { data: existing, error: fetchError } = await supabase
    .from("monthly_execution_logs")
    .select(SELECT_COLUMNS)
    .eq("id", logId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !existing) {
    logger.warn("patch_log", "Monthly execution log not found", {
      userId,
      logId,
      requestId,
    });
    throw notFoundError("ERR_NOT_FOUND", "Log not found");
  }

  // Check if loan is closed
  const { data: loan, error: loanError } = await supabase
    .from("loans")
    .select("is_closed")
    .eq("id", existing.loan_id)
    .eq("user_id", userId)
    .single();

  if (loanError || !loan) {
    logger.warn("patch_log", "Loan not found for log", {
      userId,
      logId,
      loanId: existing.loan_id,
      requestId,
    });
    throw notFoundError("ERR_NOT_FOUND", "Loan not found");
  }

  if (loan.is_closed) {
    logger.warn("patch_log", "Attempt to patch log for closed loan", {
      userId,
      logId,
      requestId,
    });
    throw conflictError("ERR_CLOSED_LOAN", "Cannot modify log for closed loan");
  }

  // Validate status transitions
  validateStatusTransition(
    existing.payment_status,
    existing.overpayment_status,
    cmd.paymentStatus,
    cmd.overpaymentStatus,
  );

  // Build update object
  const updateData: MonthlyExecutionLogUpdate = {};

  if (cmd.paymentStatus) {
    updateData.payment_status = cmd.paymentStatus;
    if (cmd.paymentStatus === "paid" || cmd.paymentStatus === "backfilled") {
      updateData.payment_executed_at =
        cmd.paymentExecutedAt || new Date().toISOString();
    }
  }

  if (cmd.overpaymentStatus) {
    updateData.overpayment_status = cmd.overpaymentStatus;
    if (
      cmd.overpaymentStatus === "executed" ||
      cmd.overpaymentStatus === "backfilled"
    ) {
      updateData.overpayment_executed_at =
        cmd.overpaymentExecutedAt || new Date().toISOString();
    }
    if (requiresReason(cmd.overpaymentStatus) && !cmd.reasonCode) {
      throw validationError(
        "ERR_VALIDATION",
        "reasonCode is required for this status change",
      );
    }
  }

  if (cmd.reasonCode !== undefined) {
    updateData.reason_code = trimReason(cmd.reasonCode ?? undefined);
  }

  if (cmd.actualOverpaymentAmount !== undefined) {
    updateData.actual_overpayment_amount = cmd.actualOverpaymentAmount;
  }

  if (cmd.scheduledOverpaymentAmount !== undefined) {
    updateData.scheduled_overpayment_amount = cmd.scheduledOverpaymentAmount;
  }

  if (cmd.remainingBalanceAfter !== undefined) {
    updateData.remaining_balance_after = cmd.remainingBalanceAfter;
  }

  const { data, error } = await supabase
    .from("monthly_execution_logs")
    .update(updateData)
    .eq("id", logId)
    .eq("user_id", userId)
    .select(SELECT_COLUMNS)
    .single();

  if (error) {
    logger.error("patch_log", "Failed to patch monthly execution log", {
      userId,
      logId,
      error: error.message,
      requestId,
    });
    throw internalError("ERR_INTERNAL", "Failed to update log");
  }

  // Mark simulations stale if overpayment transitioned to skipped or backfilled
  let staleSimulation = false;
  if (
    cmd.overpaymentStatus === "skipped" ||
    cmd.overpaymentStatus === "backfilled"
  ) {
    await markActiveSimulationStale(userId, supabase);
    staleSimulation = true;
  }

  logger.info("patch_log", "Monthly execution log patched", {
    userId,
    logId,
    requestId,
    staleSimulation,
  });

  // Invalidate dashboard cache since execution log data changed
  invalidateDashboardCache(userId);

  const dto = toDto(data);
  dto.staleSimulation = staleSimulation;

  return dto;
};

/**
 * Ensures monthly execution logs exist for all months from simulation start
 * to current month for all active loans. Backfills past months as "backfilled"
 * and creates current month as "pending"/"scheduled".
 */
export const ensureMonthlyExecutionLogs = async (
  supabase: SupabaseClient<Database>,
  userId: string,
  options?: { requestId?: string; now?: Date },
): Promise<{ created: number; months: string[] }> => {
  const now = options?.now || new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthStr = currentMonthStart.toISOString().split("T")[0];

  // 1. Fetch active simulation
  const { data: activeSim, error: simError } = await supabase
    .from("simulations")
    .select("id, created_at, started_at, strategy, reinvest_reduced_payments, monthly_overpayment_limit")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (simError) {
    if (simError.code === "PGRST116") {
      // No active simulation, nothing to do
      logger.info(
        "ensure_monthly_logs",
        "No active simulation found, skipping log creation",
        {
          userId,
          ...(options?.requestId ? { requestId: options.requestId } : {}),
        },
      );
      return { created: 0, months: [] };
    }
    throw internalError("DB_ERROR", "Failed to fetch active simulation", {
      cause: simError,
    });
  }

  // 2. Determine simulation start month
  const simStartDate = new Date(activeSim.started_at || activeSim.created_at);
  const simStartMonth = new Date(
    simStartDate.getFullYear(),
    simStartDate.getMonth(),
    1,
  );

  // 3. Fetch all active (not closed) loans for this user with full details
  const { data: loans, error: loansError } = await supabase
    .from("loans")
    .select("id, principal, remaining_balance, annual_rate")
    .eq("user_id", userId)
    .eq("is_closed", false);

  if (loansError) {
    throw internalError("DB_ERROR", "Failed to fetch loans", {
      cause: loansError,
    });
  }

  if (!loans || loans.length === 0) {
    logger.info(
      "ensure_monthly_logs",
      "No active loans found, skipping log creation",
      {
        userId,
        ...(options?.requestId ? { requestId: options.requestId } : {}),
      },
    );
    return { created: 0, months: [] };
  }

  // 4. Fetch simulation loan snapshots - these are the initial states
  const { data: snapshots, error: snapshotsError } = await supabase
    .from("simulation_loan_snapshots")
    .select("loan_id, starting_balance, starting_rate, remaining_term_months, starting_month")
    .eq("simulation_id", activeSim.id)
    .eq("user_id", userId);

  if (snapshotsError) {
    throw internalError("DB_ERROR", "Failed to fetch simulation snapshots", {
      cause: snapshotsError,
    });
  }

  if (!snapshots || snapshots.length === 0) {
    logger.warn(
      "ensure_monthly_logs",
      "No simulation snapshots found, cannot create logs accurately",
      {
        userId,
        simulationId: activeSim.id,
        ...(options?.requestId ? { requestId: options.requestId } : {}),
      },
    );
    return { created: 0, months: [] };
  }

  // 5. Get simulation parameters
  const strategy = activeSim.strategy || "equal";
  const baseOverpayment = activeSim.monthly_overpayment_limit || 0;
  const reinvestEnabled = activeSim.reinvest_reduced_payments || false;

  // 6. Run projection from simulation start to current month
  // This gives us accurate overpayment allocations for each month
  const { generateStrategyProjection } = await import("./simulationSharedService.ts");
  
  // Convert snapshots to projection loans
  const projectionLoans = snapshots.map((snapshot) => ({
    id: snapshot.loan_id,
    principal: snapshot.starting_balance, // Use starting balance as "principal" for projection
    remaining_balance: snapshot.starting_balance,
    annual_rate: snapshot.starting_rate,
    term_months: snapshot.remaining_term_months,
    monthly_payment: 0, // Will be calculated
  }));

  // Run projection from simulation start
  const startYear = simStartMonth.getFullYear();
  const startMonth = simStartMonth.getMonth();
  const monthsToProject = Math.ceil(
    (currentMonthStart.getTime() - simStartMonth.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
  ) + 1; // +1 to include current month

  const projection = generateStrategyProjection(
    projectionLoans,
    strategy,
    null, // fastest payoff goal
    baseOverpayment,
    reinvestEnabled,
    startYear,
    startMonth,
    monthsToProject,
  );

  logger.info(
    "ensure_monthly_logs",
    "Generated projection for overpayment allocation",
    {
      userId,
      simulationId: activeSim.id,
      strategy,
      baseOverpayment,
      reinvestEnabled,
      monthsProjected: projection.length,
      ...(options?.requestId ? { requestId: options.requestId } : {}),
    },
  );

  // 7. Build overpayment map from projection
  // For each month in the projection, calculate overpayment per loan
  // by re-running the allocation algorithm with the correct budget
  const { allocateOverpayment, deriveStandardMonthlyPayment } = await import("./simulationSharedService.ts");
  
  // Track loan balances and payments as we iterate through projection
  const loanBalances = new Map<string, number>();
  const loanTerms = new Map<string, number>();
  snapshots.forEach(s => {
    loanBalances.set(s.loan_id, s.starting_balance);
    loanTerms.set(s.loan_id, s.remaining_term_months);
  });

  // Calculate initial standard payments
  let previousStandardPaymentTotal = 0;
  snapshots.forEach(s => {
    previousStandardPaymentTotal += deriveStandardMonthlyPayment(
      s.starting_balance,
      s.starting_rate,
      s.remaining_term_months
    );
  });

  // Create map: "YYYY-MM-DD:loanId" -> overpaymentAmount
  const overpaymentByMonthAndLoan = new Map<string, number>();

  projection.forEach((monthData, monthIndex) => {
    // Update balances from this month's data
    monthData.loanData.forEach(loanData => {
      loanBalances.set(loanData.loanId, loanData.remaining);
      const currentTerm = loanTerms.get(loanData.loanId) || 1;
      loanTerms.set(loanData.loanId, Math.max(1, currentTerm - 1));
    });

    // Calculate current standard payment total
    let currentStandardPaymentTotal = 0;
    monthData.loanData.forEach(loanData => {
      const balance = loanBalances.get(loanData.loanId) || 0;
      const rate = snapshots.find(s => s.loan_id === loanData.loanId)?.starting_rate || 0;
      const term = loanTerms.get(loanData.loanId) || 1;
      if (balance > 0.01) {
        currentStandardPaymentTotal += deriveStandardMonthlyPayment(balance, rate, term);
      }
    });

    // Calculate available overpayment budget for this month
    const paymentReduction = reinvestEnabled 
      ? Math.max(0, previousStandardPaymentTotal - currentStandardPaymentTotal)
      : 0;
    const monthOverpaymentBudget = baseOverpayment + paymentReduction;

    // Build projection loans for allocation
    const monthLoans = monthData.loanData
      .filter(ld => ld.remaining > 0.01)
      .map(loanData => ({
        id: loanData.loanId,
        principal: loanData.loanAmount,
        remaining_balance: loanData.remaining,
        annual_rate: snapshots.find(s => s.loan_id === loanData.loanId)?.starting_rate || 0,
        term_months: loanTerms.get(loanData.loanId) || 1,
        monthly_payment: 0,
      }));

    // Allocate overpayment for this month
    if (monthLoans.length > 0) {
      const allocations = allocateOverpayment(monthLoans, strategy, monthOverpaymentBudget);
      monthLoans.forEach((loan, idx) => {
        const key = `${monthData.month}:${loan.id}`;
        overpaymentByMonthAndLoan.set(key, allocations[idx] || 0);
      });
    }

    // Update previous payment total for next iteration
    previousStandardPaymentTotal = currentStandardPaymentTotal;
  });

  // 8. Generate list of months from simulation start to current month
  const monthsToEnsure: Date[] = [];
  let iterMonth = new Date(simStartMonth);
  while (iterMonth <= currentMonthStart) {
    monthsToEnsure.push(new Date(iterMonth));
    iterMonth.setMonth(iterMonth.getMonth() + 1);
  }

  // 6. For each month and loan, check if log exists, create if missing
  const logsToInsert: MonthlyExecutionLogInsert[] = [];

  for (const month of monthsToEnsure) {
    const monthStr = month.toISOString().split("T")[0];
    const isPastMonth = month < currentMonthStart;

    for (const loan of loans) {
      // Check if log already exists
      const { data: existing, error: checkError } = await supabase
        .from("monthly_execution_logs")
        .select("id")
        .eq("user_id", userId)
        .eq("loan_id", loan.id)
        .eq("month_start", monthStr)
        .maybeSingle();

      if (checkError) {
        logger.warn(
          "ensure_monthly_logs",
          "Error checking existing log",
          {
            userId,
            loanId: loan.id,
            monthStart: monthStr,
            error: checkError.message,
            ...(options?.requestId ? { requestId: options.requestId } : {}),
          },
        );
        continue;
      }

      if (existing) {
        // Log already exists, skip
        continue;
      }

      // Get strategy-allocated overpayment for this loan and month from projection
      const overpaymentKey = `${monthStr}:${loan.id}`;
      const loanOverpayment = overpaymentByMonthAndLoan.get(overpaymentKey) || 0;

      // Create log entry
      if (isPastMonth) {
        // Past month: mark as backfilled
        logsToInsert.push({
          user_id: userId,
          loan_id: loan.id,
          month_start: monthStr,
          payment_status: "backfilled",
          overpayment_status: "backfilled",
          scheduled_overpayment_amount: loanOverpayment,
          actual_overpayment_amount: null,
          payment_executed_at: month.toISOString(),
          overpayment_executed_at: month.toISOString(),
          reason_code: "Automatically backfilled on dashboard load",
        });
      } else {
        // Current month: mark as pending/scheduled
        logsToInsert.push({
          user_id: userId,
          loan_id: loan.id,
          month_start: monthStr,
          payment_status: "pending",
          overpayment_status: "scheduled",
          scheduled_overpayment_amount: loanOverpayment,
          actual_overpayment_amount: null,
        });
      }
    }
  }

  // 7. Bulk insert missing logs
  if (logsToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("monthly_execution_logs")
      .insert(logsToInsert);

    if (insertError) {
      logger.error(
        "ensure_monthly_logs",
        "Failed to insert monthly execution logs",
        {
          userId,
          count: logsToInsert.length,
          error: insertError.message,
          ...(options?.requestId ? { requestId: options.requestId } : {}),
        },
      );
      throw internalError("DB_ERROR", "Failed to create monthly execution logs", {
        cause: insertError,
      });
    }

    logger.info(
      "ensure_monthly_logs",
      "Created monthly execution logs",
      {
        userId,
        created: logsToInsert.length,
        months: monthsToEnsure.map((m) => m.toISOString().split("T")[0]),
        ...(options?.requestId ? { requestId: options.requestId } : {}),
      },
    );
  }

  return {
    created: logsToInsert.length,
    months: monthsToEnsure.map((m) => m.toISOString().split("T")[0]),
  };
};

