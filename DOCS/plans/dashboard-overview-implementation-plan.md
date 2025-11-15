# API Endpoint Implementation Plan: GET /api/dashboard/overview

## 1. Endpoint Overview
Aggregates a consolidated dashboard view for the authenticated user by composing:
1) Active simulation summary (must exist or return 404) 2) Per-loan derived metrics 3) Current month payment / overpayment schedule 4) Graph datasets (optional, controlled by `include`) 5) Adherence metrics (execution quality of payments/overpayments).

Primary goal: Provide a single, efficiently cached read model for the UI home/dashboard without forcing many client round trips. All business logic lives in a dedicated service layer to keep the Astro route lean.

## 2. Request Details
- HTTP Method: GET
- Route: `/api/dashboard/overview`
- Authentication: Required (Bearer Supabase JWT). Reject missing/invalid token with 401.
- Headers consumed: `Authorization: Bearer <jwt>`, optional `X-Request-Id` (injected by middleware via `locals.requestId`).
- Query Parameters:
  - `include` (optional string): comma-separated values allowing: `interestBreakdown`, `monthlyTrend`.
    - `interestBreakdown` enables `graphs.interestVsSaved`.
    - `monthlyTrend` enables `graphs.monthlyBalances`.
- Required Params: none.
- Optional Params: `include`.
- Request Body: none.

### Parameter Validation Rules
- `include` → split by comma, trim. Reject if any token not in allowed set. Return 400 with machine code `ERR_INVALID_INCLUDE`.
- Empty string after trim yields no optional graphs.

## 3. Used Types
Leverage existing DTOs in `src/types.ts`:
- `ActiveSimulationSummary` (subset of `SimulationDto`).
- `DashboardOverviewLoanItem`, `DashboardOverviewCurrentMonthEntry`, `DashboardOverviewCurrentMonth`.
- `DashboardOverviewGraphMonthlyBalancePoint`, `DashboardOverviewGraphInterestPoint`, `DashboardOverviewGraphData`.
- `DashboardOverviewAdherence` (mapped from `AdherenceMetricDto`).
- `DashboardOverviewDto` final envelope.

Additional internal (non-export) helper shapes inside service (not added to `types.ts` unless reused elsewhere):
```ts
interface LoanDerivedMetrics { // computed from loan row & schedule formula
  loanId: string;
  remainingBalance: number;
  monthlyPayment: number; // amortization or last execution log payment portion
  interestSavedToDate: number; // baseline vs actual aggregated
  monthsRemaining: number; // derived from remaining balance / rate / term
  progress: number; // paid principal / original principal
  isClosed: boolean;
}
```

## 4. Response Details
- Success: 200 OK with `DashboardOverviewDto`.
- Not Found: 404 if no active simulation exists (no record where `is_active = true`). Body contains error response shape from shared `responses.ts` (likely `{ error: { code, message } }`).
- Unauthorized: 401 for missing/invalid token.
- Bad Request: 400 for invalid `include` parameter.
- Server Error: 500 for unexpected failures (unhandled exceptions, DB connectivity issues). Log error and return generic message.

### Response Construction
```json
{
  "activeSimulation": { /* ActiveSimulationSummary */ },
  "loans": [ /* LoanDerivedMetrics[] */ ],
  "currentMonth": { /* DashboardOverviewCurrentMonth */ },
  "graphs": { /* optional based on include */ },
  "adherence": { /* mapped counters & ratio */ }
}
```
- `activeSimulation` never null on success; endpoint returns 404 instead of 200/null.
- If user has zero loans: `loans: []`.
- If no execution logs for current month: `currentMonth.entries: []` with `monthStart` = first day of current month. If determining schedule requires simulation-derived plan but missing -> safe empty list.
- If adherence metrics missing: omit `adherence` or supply zero counters + ratio=0 (choose: supply zeros for consistency). Documented below.
- Graphs omitted entirely if neither include flag present.

## 5. Data Flow
1. Authenticate: Use `locals.supabase.auth.getUser()` (already done in middleware) to obtain `userId`. If absent → 401.
2. Fetch Active Simulation:
   - Query `simulations` where `user_id = userId AND is_active = true` select needed columns.
   - If none → 404.
3. Fetch Loans:
   - Query `loans` for user. Compute derived metrics per loan.
     - `monthlyPayment`: If formula needed: standard amortization `P = r * B / (1 - (1+r)^-n)` where `r = annual_rate/12`. If loan closed use 0.
     - `monthsRemaining`: Recompute with remaining balance & rate (cap at originalTermMonths - elapsed months). Edge case: zero balance → 0.
     - `progress`: `(original_principal - remaining_balance) / original_principal` (use principal as baseline). Clamp [0,1].
     - `interestSavedToDate`: If active simulation has `baseline_interest` and `total_interest_saved`, allocation per loan may need historical snapshots. MVP: 0 until metric calculation implemented OR approximate using difference between scheduled interest vs recorded `interest_portion` in logs. Document fallback.
4. Current Month Schedule:
   - Determine `currentMonthStart = date_trunc('month', now())`.
   - Query `monthly_execution_logs` for `user_id` and `month_start = currentMonthStart` join loans to filter only active loans.
   - Map rows to entries. For loans without a log row, optionally create a synthetic scheduled payment estimate (discussed in performance section) but MVP returns only existing log entries.
5. Graph Data (conditional):
   - `monthlyBalances` (when `monthlyTrend`): Query recent N months (e.g., last 12) of `monthly_execution_logs` aggregate `SUM(remaining_balance_after)` grouped by `month_start`. If `remaining_balance_after` null (future/unscheduled), approximate using loan remaining balance at month boundary.
   - `interestVsSaved` (when `interestBreakdown`): For same months, aggregate `SUM(interest_portion)` and compute saved interest vs baseline (requires baseline monthly interest = from original schedule; fallback sets `interestSaved = 0` if baseline not available).
6. Adherence:
   - Query `adherence_metrics` row for user. If present compute `ratio = overpayment_executed_count / NULLIF(overpayment_executed_count + overpayment_skipped_count,0)` else ratio=0 with zero counts.
7. Assemble DTO and return.
8. Caching:
   - In `DashboardService`, maintain in-memory cache (Map) keyed `userId|includeFlags` storing `{ expiresAt, dto }`. TTL = 300s. On hit, return cached DTO (skip DB). Invalidate on events that could stale data (loan change, simulation activation/cancellation, monthly log mutation, adherence metrics update). Provide simple invalidation methods invoked by other services.

## 6. Security Considerations
- Authentication: Mandatory; rely on middleware verifying Supabase JWT -> userId.
- Authorization: RLS at Supabase ensures user isolation; all queries filtered by `user_id = auth.uid()`.
- Input Validation: Strict enumeration for `include` prevents injection in dynamic SQL. Use parameterized queries via Supabase or PostgREST.
- Data Leakage: Only aggregated data belonging to the requesting user; no cross-user aggregates.
- Denial of Service: Implement caching to reduce repeated heavy aggregation.
- Sensitive Data: No credentials or tokens returned; only simulation and loan financial metrics.
- Error Messages: Generic for server errors—avoid exposing internal SQL.

## 7. Error Handling
Use shared error utilities in `src/lib/errors.ts` & response helpers in `src/lib/http/responses.ts`.

| Scenario | Condition | Status | Code | Message | Notes |
|----------|-----------|--------|------|---------|-------|
| Unauthorized | Missing/invalid JWT | 401 | ERR_UNAUTHORIZED | Unauthorized | Middleware short-circuits. |
| Active Simulation Missing | No row with `is_active=true` | 404 | ERR_ACTIVE_SIMULATION_NOT_FOUND | Active simulation required for dashboard | Return before other queries. |
| Invalid Include | Unrecognized token in `include` | 400 | ERR_INVALID_INCLUDE | Invalid include parameter | Provide list of allowed values. |
| DB Failure | Supabase error | 500 | ERR_DB | Internal server error | Log error object with requestId. |
| Unexpected | Uncaught exception | 500 | ERR_UNEXPECTED | Internal server error | Catch-all. |

Logging: For each error include structured log `{ level: 'error', requestId, endpoint: 'GET /api/dashboard/overview', userId, code, detail }`. Success log at debug level with timings.

## 8. Performance Considerations
- N+1 Avoidance: Fetch all loans in single query; no need for per-loan additional queries if amortization formula computed in memory.
- Graph Aggregations: Limit months (e.g., last 12). Consider adding materialized view later for monthly trend.
- Caching: 5-minute TTL reduces repeated heavy aggregates.
- Index Usage: `idx_simulations_user_id`, `ux_simulations_user_active`, `idx_monthly_logs_user_month`, `idx_monthly_logs_loan_month` support queries. Ensure filter uses leading indexed columns.
- Computation: Amortization formulas are O(1) per loan—cheap.
- Payload Size: Potentially large arrays; cap months to 12; cap loans to active ones (all) - fine.
- Lazy Graphs: Only include graphs if requested to reduce load & serialization cost.

## 9. Implementation Steps
1. Create `src/lib/services/dashboardService.ts`:
   - Export `getDashboardOverview(userId: string, include: string[], options?: { now?: Date })` returning `DashboardOverviewDto`.
   - Implement in-memory cache Map. Provide `invalidate(userId: string)` and granular invalidation exported for other services to call.
   - Helper functions: `computeLoanMetrics(loans, activeSimulation)`, `fetchGraphMonthlyBalances(userId)`, `fetchGraphInterestVsSaved(userId, baselineInterest)`, `fetchAdherence(userId)`.
2. Validation: Add new Zod schema in `src/lib/validation/dashboard.ts`:
   - `include?: string` → parse logic returning array of allowed tokens.
   - Provide function `parseInclude(q: string | undefined): DashboardIncludeFlags` where flags booleans.
3. Route Handler: Create `src/pages/api/dashboard/overview.ts`:
   - `export const GET: APIRoute = async ({ locals, request })`.
   - Extract `requestId` from locals, set on response header `X-Request-Id`.
   - Extract query param `include` via `new URL(request.url).searchParams.get('include')`.
   - Validate includes; on error respond 400 via `badRequest(requestId, code, message)`.
   - Acquire `userId` from `locals.userId` (assumed set by middleware). If missing, return 401.
   - Call service; if it throws `ActiveSimulationNotFoundError`, map to 404.
   - Return 200 with JSON body.
4. Error Types: In `src/lib/errors.ts` add `ActiveSimulationNotFoundError` & `InvalidIncludeError` (if not present). Ensure they extend base error with `code` field.
5. Logging: Use `logger.ts` with contextual `requestId`. Log start time, end time, duration ms.
6. Adherence Ratio: Implement ratio computed safely: `executed / (executed + skipped || 1)` to avoid divide-by-zero.
7. Graph Aggregations: Initial implementation may rely on monthly_execution_logs only. Mark TODO for interest saved baseline improvement (requires baseline schedule modeling).
8. Tests (if test setup exists—none visible): Add service unit tests covering:
   - Missing active simulation returns error.
   - Include parsing with both flags.
   - Adherence ratio calculation edge cases (zero denominator).
   - Caching returns same object reference within TTL.
9. Invalidation Hooks: In existing services (`loanService`, `simulationService`, `monthlyExecutionLogService`, `userSettingsService`), after mutating relevant state call `dashboardService.invalidate(userId)`.
10. Documentation: Reference this plan file from higher-level API plan index if needed.
11. Future Enhancements (document as comments): materialized views for graph data, per-loan interest allocation for `interestSavedToDate`.

## 10. Edge Cases & Decisions
- No loans: Return empty `loans` array; graphs may still show decreasing balances if logs exist.
- Closed loans: Appear with `isClosed=true`, monthlyPayment=0, monthsRemaining=0, progress=1.
- Partial months / newly activated simulation mid-month: `currentMonth.entries` may be sparse; no synthetic entries MVP.
- Missing adherence row: Provide zeros + ratio=0 to maintain stable shape (simpler for UI).
- Stale Simulation (flag set): Still treat as active; dashboard may display stale data; consider surfacing `stale` flag inside `activeSimulation` for UI indicator (extend `ActiveSimulationSummary`).
- Interest Saved Allocation: MVP sets 0; ensure UI labels handle this gracefully; improvement planned.

## 11. Pseudocode Sketch
```ts
export async function getDashboardOverview(userId: string, include: string[]): Promise<DashboardOverviewDto> {
  const cacheKey = makeKey(userId, include);
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.dto;

  const active = await fetchActiveSimulation(userId);
  if (!active) throw new ActiveSimulationNotFoundError();

  const loans = await fetchLoans(userId);
  const loanMetrics = computeLoanMetrics(loans, active);

  const currentMonth = await fetchCurrentMonthSchedule(userId, new Date());

  let graphs: DashboardOverviewGraphData | undefined;
  if (include.includes('monthlyTrend')) graphs = { ...graphs, monthlyBalances: await fetchGraphMonthlyBalances(userId) };
  if (include.includes('interestBreakdown')) graphs = { ...graphs, interestVsSaved: await fetchGraphInterestVsSaved(userId, active.baselineInterest) };

  const adherence = await fetchAdherence(userId); // zeros fallback

  const dto: DashboardOverviewDto = { activeSimulation: mapActive(active), loans: loanMetrics, currentMonth, graphs, adherence };
  cache.set(cacheKey, { expiresAt: Date.now() + 300_000, dto });
  return dto;
}
```

---
This plan aligns with existing project patterns (service layer + validation modules + error utilities) and adheres to clean code and security rules specified in `.ai` guidance.
