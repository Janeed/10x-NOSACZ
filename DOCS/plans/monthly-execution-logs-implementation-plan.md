# API Endpoint Implementation Plan: Monthly Execution Logs

## 1. Endpoint Overview
Implements CRUD-lite operations for tracking the execution of scheduled loan payments and overpayments per (loan, month). Provides:
- GET /api/monthly-execution-logs — paginated filterable listing for dashboard & history views.
- POST /api/monthly-execution-logs — create a log row for current or past (non-future) month for a loan.
- PATCH /api/monthly-execution-logs/{logId} — partial update of payment and overpayment statuses, execution timestamps, realized amounts, and reason codes. Skipped overpayment marks active simulation stale.

Business goals: supply adherence metrics sources, enable user backfilling historical months, and track real vs scheduled overpayment execution to influence simulation staleness.

## 2. Request Details

### GET /api/monthly-execution-logs
HTTP Method: GET
URL: `/api/monthly-execution-logs`
Authentication: Required (Bearer JWT); middleware injects `locals.userId`, `locals.supabase`, `locals.requestId`.
Query Parameters:
- Required: none.
- Optional filters:
  - `loanId: UUID`
  - `monthStart: YYYY-MM-01` (must be first day of month; normalized)
  - `paymentStatus: pending|paid|backfilled`
  - `overpaymentStatus: scheduled|executed|skipped|backfilled`
  - `page: int` (>=1, default 1)
  - `pageSize: int` (>=1, default 20, max 100)
  - `sort: "month_start"` (optional; default month_start)
  - `order: asc|desc` (optional; default desc)

### POST /api/monthly-execution-logs
HTTP Method: POST
URL: `/api/monthly-execution-logs`
Body (JSON):
```
{
  "loanId": "uuid",               // required
  "monthStart": "YYYY-MM-01",      // required, current or past month
  "paymentStatus": "pending"|"backfilled", // initial status (usually pending; backfilled allowed for past month creation)
  "overpaymentStatus": "scheduled"|"backfilled", // initial overpayment status
  "scheduledOverpaymentAmount": number >=0 (optional)
  "actualOverpaymentAmount": number >=0 (optional; only if executed/backfilled)
  "interestPortion": number >=0 (optional)
  "principalPortion": number >=0 (optional)
  "remainingBalanceAfter": number >=0 (optional; allowed when payment executed/backfilled)
  "reasonCode": string (<=500 chars, trimmed; required if status is backfilled)
}
```
Notes:
- Reject future monthStart (> first day of current month) with 400.
- Enforce uniqueness (loanId, monthStart) → 409 on duplicate.

### PATCH /api/monthly-execution-logs/{logId}
HTTP Method: PATCH
URL: `/api/monthly-execution-logs/{logId}`
Path Parameter: `logId: UUID`
Body (JSON) — at least one field:
```
{
  "paymentStatus": "paid"|"backfilled",          // forward-only
  "paymentExecutedAt": "timestamp",               // only if paymentStatus=paid/backfilled
  "overpaymentStatus": "executed"|"skipped"|"backfilled", // forward-only from scheduled
  "overpaymentExecutedAt": "timestamp",           // only if overpaymentStatus=executed/backfilled
  "actualOverpaymentAmount": number >=0,           // if executed/backfilled
  "scheduledOverpaymentAmount": number >=0,        // adjust schedule
  "remainingBalanceAfter": number >=0,             // if payment executed/backfilled
  "reasonCode": "string"                          // required if status set to skipped/backfilled
}
```
Validation specifics:
- Cannot revert statuses (e.g., paid→pending, executed→scheduled).
- Cannot set timestamps or actualOverpaymentAmount without appropriate executed/backfilled status.
- Skipping overpayment requires reasonCode non-empty (<=500 chars).
- If loan is closed (`is_closed=true`) deny mutation (409).

## 3. Used Types
Existing domain-aligned types from `src/types.ts`:
- `MonthlyExecutionLogDto`
- `MonthlyExecutionLogListQuery`
- `MonthlyExecutionLogListResponse` (`PaginatedResult<MonthlyExecutionLogDto>`) 
- `CreateMonthlyExecutionLogCommand`
- `PatchMonthlyExecutionLogCommand`

New internal types (service-layer, not necessarily exported globally):
- `CreateMonthlyExecutionLogResult = { log: MonthlyExecutionLogDto; created: true }`
- `PatchMonthlyExecutionLogResult = { log: MonthlyExecutionLogDto; staleSimulation?: boolean }`
- `StatusTransitionContext = { currentPaymentStatus; currentOverpaymentStatus; incomingPaymentStatus?; incomingOverpaymentStatus? }`

Zod Schemas (to add in `src/lib/validation/monthlyExecutionLog.ts`):
- `monthlyExecutionLogQuerySchema`
- `createMonthlyExecutionLogSchema`
- `patchMonthlyExecutionLogSchema`

## 4. Response Details

### GET Success (200)
```
{
  "items": MonthlyExecutionLogDto[],
  "page": number,
  "pageSize": number,
  "totalItems": number,
  "totalPages": number
}
```

### POST Success (201)
`MonthlyExecutionLogDto` (no staleSimulation flag on create; always false initially unless immediate skip/backfill logic is allowed — we will set `staleSimulation: true` only if overpaymentStatus is backfilled or skipped during creation).

### PATCH Success (200)
`MonthlyExecutionLogDto` plus `staleSimulation: true` when `overpaymentStatus` transitioned to `skipped` (or from scheduled→backfilled). Include header `X-Request-Id` echoing middleware.

### Error Responses
Consistent shape (align with existing `responses.ts`):
```
{
  "error": {
    "code": "ERR_VALIDATION"|"ERR_UNIQUE_CONSTRAINT"|"ERR_NOT_FOUND"|"ERR_INVALID_STATUS_TRANSITION"|"ERR_CLOSED_LOAN"|"ERR_INTERNAL",
    "message": string,
    "requestId": string
  }
}
```
Status codes: 400, 401, 404, 409, 500 per scenario.

## 5. Data Flow
1. Middleware authenticates JWT, provides `supabase` client & `userId` & `requestId`.
2. GET handler:
   - Parse & validate query with Zod.
   - Build Supabase query `from('monthly_execution_logs')` filtered by `user_id = userId` plus optional filters; ordering by `month_start` with direction.
   - Execute count: either a second query or use RPC for total count (MVP: second query with same filters selecting `count` using Supabase's count option).
   - Map rows to `MonthlyExecutionLogDto`.
3. POST handler:
   - Validate body (normalize `monthStart` to first day-of-month).
   - Reject future month start / negative amounts.
   - Confirm loan existence & ownership: select `loans` with loanId & userId; if not found 404; if closed 409.
   - Attempt insert with `user_id = userId`; catch uniqueness violation (code 23505) -> 409.
   - If overpaymentStatus is backfilled or skipped on creation, mark simulations stale (update active simulation(s): set `stale=true` where `user_id=userId AND is_active=true`).
   - Return created DTO (201).
4. PATCH handler:
   - Validate body (at least one field).
   - Fetch existing log by id & userId; if not found 404.
   - If associated loan closed -> 409 (fetch loan or join). (Optimization: maintain `is_closed` flag on loan table; one extra query.)
   - Evaluate status transitions (guard function). Reject invalid transitions.
   - Compile update object (only whitelisted fields). Add executed timestamps only with executed/backfilled statuses.
   - Perform update via Supabase `update()` returning row.
   - If overpaymentStatus transitioned to skipped/backfilled -> set simulations stale (same update as POST) and set response `staleSimulation=true`.
   - Return DTO (200).
5. Shared logic extracted to `monthlyExecutionLogService.ts`:
   - `listLogs(query, supabase, userId)`
   - `createLog(cmd, supabase, userId, requestId)`
   - `patchLog(logId, cmd, supabase, userId, requestId)`
   - Helper functions: `normalizeMonthStart`, `validateStatusTransition`, `markActiveSimulationStale(userId, supabase)`, `trimReason(reasonCode)`.
6. API route files orchestrate validation + call service + shape HTTP responses.

## 6. Security Considerations
- Authentication via bearer token enforced by middleware; 401 if absent/invalid.
- Authorization & data isolation guaranteed by RLS (user_id match) AND explicit filter by userId in queries (defense in depth).
- Prevent IDOR: never query by logId without also scoping userId.
- Input validation with Zod prevents injection & unexpected types (numbers coerced or rejected; date format enforced).
- Rate limiting: (future) integrate IP/user request throttling; design accommodates with stateless handlers.
- Uniqueness constraint prevents spamming duplicate month rows; still consider adding rate limit on POST (not in MVP code path, note as follow-up).
- Mitigate overposting/mass assignment: define explicit field allowlist for PATCH updates.
- Validate timestamps to be reasonable (optional: must not be future beyond now; if provided and > now disregard with 400).
- Reason code length capped to avoid large payload causing log bloat.
- Do not expose internal simulation/stale logic except `staleSimulation` boolean.

## 7. Error Handling
Mapped scenarios:
| Scenario | HTTP | code | Notes |
|----------|------|------|-------|
| Invalid query/body (schema) | 400 | ERR_VALIDATION | Provide first issue message |
| Future monthStart create | 400 | ERR_VALIDATION | monthStart must be <= current month start |
| Invalid date format | 400 | ERR_VALIDATION | Regex + normalization fail |
| Negative amount | 400 | ERR_VALIDATION | All amount fields >= 0 |
| Empty PATCH body | 400 | ERR_VALIDATION | At least one field required |
| Invalid status transition | 400 | ERR_INVALID_STATUS_TRANSITION | Forward-only |
| Executed timestamp without executed/backfilled status | 400 | ERR_INVALID_STATUS_TRANSITION | Coupling rule |
| Loan not found / not owned | 404 | ERR_NOT_FOUND | POST pre-check |
| Log not found | 404 | ERR_NOT_FOUND | PATCH fetch |
| Duplicate (loanId, monthStart) | 409 | ERR_UNIQUE_CONSTRAINT | Detect via 23505 |
| Loan closed (mutation) | 409 | ERR_CLOSED_LOAN | POST or PATCH when loan is closed |
| Unauthorized (middleware) | 401 | ERR_UNAUTHORIZED | Middleware-generated |
| Unexpected DB failure | 500 | ERR_INTERNAL | Log stack, generic message |

Logging strategy:
- Use `logger.info|warn|error({ requestId, userId, endpoint, event, details })`.
- Log validation failures at warn level; server errors at error with stack.
- Mirror `requestId` in `X-Request-Id` response header (GET, POST, PATCH).

## 8. Performance Considerations
- Index leverage: queries primarily filter on user_id + optional loanId + month_start + statuses; existing indexes: `idx_monthly_logs_user_month`, `idx_monthly_logs_loan_month`, status indexes ensure fast filtering.
- Pagination: use `range((page-1)*pageSize, page*pageSize-1)`; avoid large pageSize (>100).
- Count strategy: Supabase `select('*', { count: 'exact', head: true })` to get totalItems with single round-trip (supported). If performance degrades, maintain precomputed counts or approximate.
- Minimize over-fetch: only needed columns returned. (All columns already small.)
- Stale marking: single update query on simulations table with partial index (user_id, is_active=true) — constant time.
- Future enhancement: caching GET results (dashboard) short-lived (e.g., 30s) if hotspot emerges.
- Avoid N+1 by not querying loans individually; only single existence check during POST.

## 9. Implementation Steps
1. Create `src/lib/validation/monthlyExecutionLog.ts` with Zod schemas:
   - Export parsed types aligning with existing command/query interfaces.
   - Include helpers `isFirstOfMonth(dateStr)`, `normalizeMonth(dateStr)`.
2. Add `src/lib/services/monthlyExecutionLogService.ts` implementing:
   - `listLogs(query, supabase, userId)` — compose filters; implement pagination + count.
   - `createLog(cmd, supabase, userId)` — loan existence, closed check, normalization, insert, uniqueness handling, potential stale marking.
   - `patchLog(logId, cmd, supabase, userId)` — fetch row, loan closed check, validate transitions, build update, perform update, stale marking logic.
   - Shared helpers: `validateAmountsNonNegative`, `validateStatusTransition(current, incoming)`, `requiresReason(status)`, `markActiveSimulationStale`.
3. Update `src/lib/errors.ts` (if needed) to add new error codes constants.
4. Implement route file `src/pages/api/monthly-execution-logs.ts`:
   - `export const GET` parse query via schema, call service, return 200 with paginated result.
   - `export const POST` parse body, call service, return 201.
   - Attach headers: `X-Request-Id`.
5. Implement route file `src/pages/api/monthly-execution-logs/[logId].ts`:
   - `export const PATCH` parse body, call service, return 200 with possible `staleSimulation`.
6. Reuse `responses.ts` helpers for shaping success and error responses; extend if needed for pagination.
7. Add unit tests (if testing infra present) for validation edge cases (negative amount, invalid status transition, skip sets stale flag). If no test harness yet, add TODO.
8. Manual verification script (optional) under `scripts/` to create a log then patch skip scenario.
9. Documentation: This plan file (done) — link from README or API docs index (future).
10. Observability: ensure logger emits structured logs for each operation with timing (wrap service calls measuring ms). Add TODO for metrics.
11. Future Enhancements (comment/TODO): rate limit POST, enforce timestamp <= now, record audit trail on status changes (separate table or events).

## 10. Status Transition Rules (Detail)
Payment Status Allowed transitions:
- pending → paid | backfilled
- backfilled is terminal
- paid is terminal
Overpayment Status Allowed transitions:
- scheduled → executed | skipped | backfilled
- executed is terminal
- skipped is terminal
- backfilled is terminal
Forbidden examples: paid→pending, executed→scheduled, skipped→executed.

## 11. Stale Simulation Logic
Trigger conditions:
- overpaymentStatus set to skipped OR backfilled (either on creation or patch) AND there exists an active simulation (`is_active=true`) for user.
Action:
- `update simulations set stale=true where user_id=$userId and is_active=true and stale=false`.
Response:
- Include `staleSimulation: true` in returned DTO wrapper (PATCH) or directly on DTO field.

## 12. Validation Rules Summary
- Dates: `monthStart` must equal first day-of-month after normalization; parse with `new Date(value)` and compare `date.getUTCDate()==1`.
- Amounts: all monetary fields numeric >=0; provide 2-decimal rounding (toFixed or Math.round(value*100)/100) before persistence if necessary (ensure consistent with other services).
- reasonCode: trimmed; required when statuses become skipped/backfilled; max length 500.
- Executed timestamps must not precede monthStart (reject 400) and must be <= now.
- At least one patch field present.

## 13. Concurrency & Idempotency
- POST: uniqueness ensures idempotency for same loanId + monthStart; repeat attempt returns 409.
- PATCH: single-row update; optimistic concurrency not used. Low risk of race; consider adding `updated_at` future if needed.

## 14. Security Follow-Ups (Future)
- Add abuse protection: limit number of backfilled months per minute.
- Maintain audit table for status transitions (for compliance) — not MVP.
- Potential validation of loan ownership via single joined query to reduce TOCTOU race (minor risk).

## 15. Testing Scenarios (Summary)
1. GET with no filters returns paginated items (happy path).
2. POST valid pending scheduled row returns 201.
3. POST duplicate month returns 409.
4. POST future month returns 400.
5. PATCH scheduled→skipped sets staleSimulation true & marks simulation stale.
6. PATCH invalid transition executed→scheduled returns 400.
7. PATCH closed loan returns 409.
8. PATCH with executed timestamps but status still scheduled returns 400.

---
Implementation guided by shared project rules (service extraction, guard clauses, early error returns, structured logging). All business logic isolated in service to keep route handlers thin and consistent.
