# API Endpoint Implementation Plan: Simulations Suite

## 1. Endpoint Overview
Implements the lifecycle and retrieval of multi-loan optimization simulations. A simulation represents a computed payoff projection given a chosen strategy and goal. Endpoints cover: listing simulations, queueing a new run, fetching details (optionally loan snapshots), activating a completed simulation (making it the current plan), cancelling a running simulation, and retrieving the active simulation for dashboard use. Core invariants: at most one active simulation per user; a running simulation can be cancelled when a new one is queued; stale flag marks invalidation due to domain edits (loans, user settings, change events, skipped overpayments).

### Endpoints Covered
1. GET `/api/simulations`
2. POST `/api/simulations`
3. GET `/api/simulations/{simulationId}`
4. POST `/api/simulations/{simulationId}/activate`
5. POST `/api/simulations/{simulationId}/cancel`
6. GET `/api/simulations/active`

## 2. Request Details

### Shared
- Authentication: `Authorization: Bearer <jwt>` required (validated earlier in middleware via Supabase). `locals.userId` and `locals.supabase` provided.
- Observability: Middleware supplies `locals.requestId`; each successful response sets `X-Request-Id` header; errors echo requestId.
- Content-Type: `application/json; charset=utf-8` for all JSON responses.

### 2.1 GET /api/simulations
- Method: GET
- Path: `/api/simulations`
- Query Params (all optional):
  - `status`: enum `simulation_status` ('running','active','completed','stale','cancelled')
  - `isActive`: boolean
  - `stale`: boolean
  - `page`: number (default 1, >0)
  - `pageSize`: number (default 20, 1..100)
  - `sort`: `created_at | completed_at` (default `created_at`)
  - `order`: `asc | desc` (default `desc`)
- Validation: Type coercion from query strings; reject unknown enum values or out-of-range pagination.
- Response: `SimulationListResponse` (paginated list of `SimulationDto`).

### 2.2 POST /api/simulations
- Method: POST
- Path: `/api/simulations`
- Body (JSON):
  - Required: `strategy` (string enum), `goal` (goal_type), `reinvestReducedPayments` (boolean)
  - Conditional: `paymentReductionTarget` (NUMERIC >0) required if `goal = payment_reduction`
  - Optional: `monthlyOverpaymentLimit` (>=0), `notes` (trimmed, <=500 chars)
- Process:
  1. Validate body (Zod).
  2. If existing simulation with status `running` for user: cancel it (set status=cancelled, `cancelled_at` timestamp) per US-047 before queuing new; or treat as part of the new queue transaction.
  3. Insert new simulation row with: status=`running`, is_active=false, stale=false, capturing current user settings (fallback to `user_settings.monthly_overpayment_limit` and `reinvest_reduced_payments` if not provided). Set `created_at` now; optionally set `started_at` if immediate computation begins.
  4. Enqueue background job (out-of-scope—stub or log event).
- Response: 202 Accepted, body `SimulationQueuedResponse`.
- Errors: 409 (if conflict cancel fails), 422 (missing `paymentReductionTarget` when goal requires), 400 (other validation).

### 2.3 GET /api/simulations/{simulationId}
- Method: GET
- Path: `/api/simulations/{simulationId}`
- Path Param: `simulationId` UUID
- Query Param Optional: `include=loanSnapshots` (comma-separated; currently only `loanSnapshots` recognized)
- Process: Fetch simulation row ensuring ownership (RLS). If include includes `loanSnapshots`, fetch snapshots. Optionally aggregate last history metric (projected payoff, interest saved) if not stored.
- Response: `SimulationDetailDto` (may include `loanSnapshots`).
- Errors: 404 (not found or not owned), 400 (invalid UUID), 400 (invalid include value).

### 2.4 POST /api/simulations/{simulationId}/activate
- Method: POST
- Path: `/api/simulations/{simulationId}/activate`
- Preconditions: Target simulation status must be `completed` and not stale.
- Process (transaction):
  1. Select simulation by id & user.
  2. Validate status completed; if not → 400.
  3. Clear previous active simulation: update simulations set `is_active=false`, possibly leave status as its prior (if `active`, revert to `completed`) or keep `status` unchanged—decision: set previous `status` to `completed` if it was `active` for consistency.
  4. Set target: `is_active=true`, `status='active'`.
  5. Return summary of active simulation.
- Response: 200 OK → `SimulationActivationResponse`.
- Errors: 400 (not completed), 409 (unique index conflict/race), 404 (not found).

### 2.5 POST /api/simulations/{simulationId}/cancel
- Method: POST
- Path: `/api/simulations/{simulationId}/cancel`
- Headers: Requires `X-Client-Confirmation` (non-empty) for destructive action.
- Preconditions: status must be `running` (cannot cancel completed/cancelled/active/stale).
- Process: Update status to `cancelled`, set `cancelled_at` timestamp.
- Response: 200 OK → `SimulationCancelResponse` (detail of cancelled simulation).
- Errors: 404 (not found), 409 (already completed or not running), 400 (missing confirmation header).

### 2.6 GET /api/simulations/active
- Method: GET
- Path: `/api/simulations/active`
- Process: Fetch simulation where `is_active=true` and optionally ensure not stale—if stale treat as 404 (forces re-run). Build lightweight dashboard view: summary + current month schedule (algorithmic; may require schedule service stub). Month schedule derived from loan snapshots & user settings.
- Response: 200 OK (active simulation summary + schedule) or 404 if none (or stale active).
- Errors: 404 (no active or stale), 500 (schedule compute failure).

## 3. Used Types
- From `src/types.ts`:
  - `SimulationDto`, `SimulationListResponse`, `SimulationQueuedResponse`, `CreateSimulationCommand`, `SimulationDetailDto`, `SimulationActivationResponse`, `SimulationCancelResponse`, `SimulationLoanSnapshotDto`.
  - `SimulationListQuery` (mirrors GET list filters).
  - `GoalType`, `SimulationStatus` enums.
- New internal (service-layer, not exported to public types file initially):
  - `SimulationDetailQuery { include?: string[] }` (parsed version of include param)
  - `ActiveSimulationDashboardDto` (subset of `SimulationDetailDto` + `currentMonthSchedule: { monthStart: Date; entries: Array<{ loanId: string; scheduledPayment: number; scheduledOverpayment: number; paymentStatus: string; overpaymentStatus: string }>} )`
  - `SimulationScheduleEntry` (for internal schedule generation logic)
  - `CancelSimulationCommand { simulationId: string; confirmationToken: string }`
  - `ActivateSimulationCommand { simulationId: string }`

## 4. Response Details

### Standard Success Bodies
- List: `SimulationListResponse` structure `{ items: SimulationDto[]; page; pageSize; totalItems; totalPages }`.
- Queue: `SimulationQueuedResponse { simulationId, status:'running', isActive:false, queuedAt }`.
- Detail: `SimulationDetailDto` optionally enriched with `loanSnapshots`.
- Activate: `SimulationActivationResponse` identical to detail (may exclude snapshots unless previously requested—decision: return without snapshots for performance).
- Cancel: `SimulationCancelResponse` identical to detail.
- Active: `ActiveSimulationDashboardDto` tailored summary + schedule.

### Error Bodies
Follow `errorResponse` pattern: `{ error: { code, message }, requestId? }`.

### Status Codes
- 200: successful reads & activation/cancellation completion.
- 201: (None for simulations per plan; creations return 202).
- 202: simulation queued.
- 400: invalid input / preconditions (activate not completed; cancel missing header; malformed UUID; invalid include).
- 401: missing/invalid auth (middleware triggers).
- 404: simulation not found or active simulation absent/stale.
- 409: conflict (activation race, cancellation state conflict, prior running cancellation failure).
- 422: create simulation missing required conditional field `paymentReductionTarget` for `payment_reduction` goal (explicit spec).
- 429: rate limit (queue endpoint) – middleware.
- 500: internal server errors (DB/network/unexpected).

## 5. Data Flow
1. Middleware authenticates token, populates `locals.supabase`, `locals.userId`, `locals.requestId`.
2. Request enters route handler (Astro export const GET/POST). Query/body validated with Zod.
3. Handler delegates to simulation service functions: `listSimulations`, `queueSimulation`, `getSimulationDetail`, `activateSimulation`, `cancelSimulation`, `getActiveSimulation`.
4. Services interact with Supabase:
   - Filtering: `from('simulations').select(...).eq('user_id', userId)`; apply filters via `.eq`, `.in` or boolean logic; ordering via `.order(sort, { ascending })`; pagination via `.range(offsetStart, offsetEnd)`.
   - Queue: transaction pattern (Supabase lacks multi-statement transactions via JS SDK; fallback: sequential operations with conflict handling). If full atomicity required, consider Postgres RPC function later.
   - Activation: clear previous active then set new; rely on unique partial index `ux_simulations_user_active`—if conflict occurs on commit, re-fetch and retry once.
   - Cancellation: simple update predicate on status running.
   - Active: fetch single row; if `stale=true` return 404; compute schedule (algorithm stub uses loanSnapshots & interest math helpers); schedule not persisted.
5. Service returns domain DTO; route maps to response using `ok()` or custom `new Response()` for 202.
6. Errors thrown via `validationError`, `conflictError`, etc. converted by `errorResponse`.
7. Logging (via `logger.ts`—not yet extended): emit structured events with requestId before response send.
8. Background Job Enqueue (placeholder): push message to queue service (future) or log event `simulation_queue_requested`.

## 6. Security Considerations
- Auth & Ownership: RLS ensures user isolation; queries always filter by `user_id=locals.userId`.
- Input Validation: Strict Zod schemas prevent injection & mass assignment (only allowed fields). Reject unknown properties (use `.strict()`).
- Header Requirements: `X-Client-Confirmation` enforced for cancellation to mitigate accidental destructive calls.
- Simulation Activation Race: Unique partial index plus sequential updates; retry logic prevents duplicate active rows. After one retry failure → 409.
- Stale Active Simulation: Guard returns 404 to prevent using invalid plan; encourages re-run.
- Strategy Enum: Hard-coded whitelist to avoid arbitrary text; validation ensures only supported strategies.
- Notes Sanitization: Trim & length cap (<=500). Potential future HTML sanitization if UI ever sends rich text.
- Sensitive Data: None besides user simulation outcomes; ensure no leakage of other users’ IDs via RLS.
- Background Jobs: Only queue metadata (simulationId,userId,strategy,goal) – no PII beyond standard user id.

## 7. Error Handling
| Scenario | Code | HTTP Status | Notes |
|----------|------|-------------|-------|
| Invalid UUID path param | INVALID_ID | 400 | Regex UUID check before DB call |
| Unknown query enum | INVALID_QUERY | 400 | Zod refinement |
| Pagination out of bounds | INVALID_PAGINATION | 400 | page>=1, pageSize<=100 |
| Missing strategy/goal | MISSING_FIELD | 400 | Zod required |
| Missing paymentReductionTarget when goal requires | PAYMENT_TARGET_REQUIRED | 422 | Spec specific |
| paymentReductionTarget <=0 | PAYMENT_TARGET_INVALID | 400 | Numeric constraint |
| monthlyOverpaymentLimit <0 | OVERPAYMENT_LIMIT_INVALID | 400 | Constraint |
| Activation on non-completed | SIMULATION_NOT_COMPLETED | 400 | Precondition |
| Activation unique index race unresolved | ACTIVE_CONFLICT | 409 | After retry |
| Cancellation when not running | SIMULATION_CANCEL_CONFLICT | 409 | Status mismatch |
| Missing confirmation header | CONFIRMATION_HEADER_REQUIRED | 400 | Destructive guard |
| Simulation not found | SIMULATION_NOT_FOUND | 404 | Ownership filter yielded none |
| Active simulation not present | ACTIVE_NOT_FOUND | 404 | No is_active row |
| Active simulation stale | ACTIVE_SIMULATION_STALE | 404 | Force re-run |
| Existing running cancellation failed | PRIOR_SIMULATION_CANCEL_FAILED | 409 | Safeguard |
| Rate limit exceeded | RATE_LIMIT_EXCEEDED | 429 | Middleware |
| Supabase error (generic) | SUPABASE_ERROR | 500 | DB client error |
| Internal unexpected | INTERNAL_ERROR | 500 | Fallback |

Mapping: Use `validationError`, `conflictError`, `notFoundError`, `internalError`. 422 used only for conditional missing field per spec.

## 8. Performance Considerations
- Index Usage: Filters primarily on `user_id`, `status`, `is_active`, `stale`; existing indexes (`idx_simulations_user_id`, `idx_simulations_status`, `idx_simulations_stale`, unique active index) cover queries.
- Pagination: Use limit/page (range) rather than full dataset fetch; count via secondary query `.select('*', { count: 'exact', head: true })` for totalItems; estimate count fallback if high volume (future).
- N+1 Avoidance: For detail with snapshots, single extra query `simulation_loan_snapshots` filtered by `simulation_id`; metrics maybe from `simulation_history_metrics` using single query.
- Activation Transaction: Keep minimal operations (two updates). Consider RPC for atomic Postgres transaction later.
- Schedule Computation: For active simulation dashboard, implement caching layer (e.g. ephemeral in-memory per request or future KV) - documented but not implemented in MVP.
- Network Payload: Omit snapshots unless requested; limit note field length.
- Concurrency: Retry once on activation conflict; avoid spin loops.

## 9. Implementation Steps
1. Create/extend `src/lib/services/simulationService.ts` adding exported functions:
   - `listSimulations(supabase, userId, query: SimulationListQuery): Promise<SimulationListResponse>`
   - `queueSimulation(supabase, userId, cmd: CreateSimulationCommand): Promise<SimulationQueuedResponse>`
   - `getSimulationDetail(supabase, userId, id: string, include?: string[]): Promise<SimulationDetailDto>`
   - `activateSimulation(supabase, userId, id: string): Promise<SimulationActivationResponse>`
   - `cancelSimulation(supabase, userId, id: string): Promise<SimulationCancelResponse>`
   - `getActiveSimulationDashboard(supabase, userId): Promise<ActiveSimulationDashboardDto>`
2. Introduce `src/lib/validation/simulation.ts` with Zod schemas:
   - `simulationListQuerySchema`
   - `createSimulationSchema`
   - `simulationIdParamSchema`
   - `includeParamSchema`
3. Implement list service: build query with safe dynamic clauses, apply pagination and sorting; perform count query; map rows to `SimulationDto`.
4. Implement queue logic:
   - Fetch existing running simulation; if exists, attempt cancellation update.
   - Load user settings row if `monthlyOverpaymentLimit` not provided to embed snapshot values.
   - Validate goal-target rule; throw 422 if missing.
   - Insert new row (`status='running'`, `is_active=false`, `stale=false`).
   - Log enqueue event; return queued response.
5. Implement detail fetch with optional snapshots & latest history metric merge into projection.
6. Implement activation:
   - Ensure completed & not stale.
   - Update previous active (set `is_active=false`, `status='completed'` if currently `active`).
   - Set current simulation `is_active=true`, `status='active'`.
   - On unique index violation retry once; if still fails → conflict.
7. Implement cancellation:
   - Check header `X-Client-Confirmation` in route handler before service call.
   - Ensure status running; update status & `cancelled_at`.
8. Implement active simulation dashboard:
   - Fetch active simulation; if stale return not found.
   - Fetch loan snapshots; compute month schedule (placeholder algorithm: constant monthly payment from amortization formula or stub zeros until strategy engine integrated).
9. Add route handlers under `src/pages/api`:
   - `simulations.ts` (GET for list, POST for queue) using `export const GET`, `export const POST`.
   - `simulations/[simulationId].ts` (GET detail, POST sub-actions maybe split into dedicated files)
   - `simulations/[simulationId]/activate.ts` (POST activation)
   - `simulations/[simulationId]/cancel.ts` (POST cancellation)
   - `simulations/active.ts` (GET active dashboard)
10. In each handler: parse/validate, call service, return response using `ok()` or custom Response for 202.
11. Error handling: wrap handler logic in try/catch returning `errorResponse(error, requestId)`.
12. Logging: Use `logger.ts` (extend if necessary) to log structured events: { event, simulationId, userId, requestId } for queue, activate, cancel.
13. Update documentation (API plan referencing any subtle behavior differences, e.g., returning 404 for stale active).
14. Add unit tests (future): validation tests for create schema; service tests mocking Supabase client.
15. Add TODO notes for future improvements: RPC transactions, schedule caching, richer metrics embedding.

## 10. Validation Schemas (Outline)
```ts
const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const simulationListQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(SimulationStatus).optional(),
  isActive: z.coerce.boolean().optional(),
  stale: z.coerce.boolean().optional(),
  sort: z.enum(['created_at','completed_at']).optional().default('created_at'),
  order: z.enum(['asc','desc']).optional().default('desc'),
}).strict();

const strategyEnum = z.enum(['avalanche','snowball','equal','ratio']);

export const createSimulationSchema = z.object({
  strategy: strategyEnum,
  goal: z.nativeEnum(GoalType),
  reinvestReducedPayments: z.boolean(),
  monthlyOverpaymentLimit: z.number().min(0).optional(),
  paymentReductionTarget: z.number().positive().optional(),
  notes: z.string().trim().max(500).optional(),
}).superRefine((val, ctx) => {
  if (val.goal === 'payment_reduction' && (val.paymentReductionTarget == null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'paymentReductionTarget required for payment_reduction goal' });
  }
});

export const simulationIdParamSchema = z.string().uuid();
export const includeParamSchema = z.string().optional(); // parse to array, validate values
```

## 11. Logging Events (Reference)
- `simulation_queue_requested` { simulationId, userId, strategy, goal, requestId }
- `simulation_queue_cancel_previous` { previousSimulationId, cancelledBySimulationId, userId, requestId }
- `simulation_activate` { simulationId, userId, requestId }
- `simulation_cancel` { simulationId, userId, requestId }
- `simulation_active_fetch` { simulationId, userId, requestId }

## 12. Future Enhancements (Non-blocking)
- Replace sequential activation updates with Postgres RPC for atomicity.
- Implement real asynchronous job queue (e.g., Supabase functions / external worker) updating status to completed & metrics.
- Add caching for active simulation schedule (5 min TTL memory or KV store).
- Introduce `strategy` registry endpoint enrichment (human-readable descriptor).
- Expand include param to support `historyMetrics`.
- Additional status transitions (e.g., `failed`) on computation errors.

## 13. Completion Criteria
- All endpoints respond with correct status codes & headers.
- Validation rejects malformed input & conditional rules enforced (422 case).
- Activation enforces unique active simulation invariant.
- Cancellation respects destructive confirmation header.
- Stale active simulation returns 404.
- Logging includes requestId for all state-changing operations.
- List pagination and counts accurate.
- No leakage of other users’ data (RLS + user_id filters).

---
This plan provides the development team with concrete contracts, validation rules, service boundaries, and implementation sequencing to deliver robust simulation endpoints aligned with project architecture and database design.
