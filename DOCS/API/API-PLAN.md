# REST API Plan

## 1. Resources

- `UserSettings` → `user_settings`
- `Loan` → `loans`
- `LoanChangeEvent` → `loan_change_events`
- `Simulation` → `simulations`
- `SimulationLoanSnapshot` → `simulation_loan_snapshots`
- `MonthlyExecutionLog` → `monthly_execution_logs`
- `SimulationHistoryMetric` → `simulation_history_metrics`
- `AdherenceMetric` → `adherence_metrics`
- `Strategy` (registry, configuration-driven)
- `DashboardOverview` (aggregated read model spanning active simulation, metrics, logs)
- `AuthSession` (Supabase Auth integration)

## 2. Endpoints

### 2.1 Authentication (Supabase Auth Gateway)

#### POST /auth/signup

Description: Register new user via Supabase Auth (delegated to Supabase REST).
Query Parameters: none
Request Body:

```json
{
  "email": "user@example.com",
  "password": "string"
}
```

Response:

```json
{
  "user": { "id": "uuid", "email": "string" },
  "session": { "access_token": "jwt", "refresh_token": "string" }
}
```

Success: 201 Created — account registered.
Errors: 400 Bad Request (validation), 409 Conflict (email exists).

#### POST /auth/signin

Description: Authenticate user and obtain session tokens.
Query Parameters: none
Request Body and Response: same structure as signup.
Success: 200 OK — session issued.
Errors: 400 Bad Request (invalid input), 401 Unauthorized (invalid credentials).

#### POST /api/auth/signout

Description: Invalidate current refresh token.
Success: 204 No Content — session terminated.
Errors: 401 Unauthorized (missing/expired token).

#### POST /api/auth/reset-password

Description: Trigger password reset email via Supabase.
Request Body:

```json
{
  "email": "user@example.com"
}
```

Success: 202 Accepted — reset email sent.
Errors: 404 Not Found (email not registered).

### 2.2 User Settings

#### GET /api/user-settings

Description: Retrieve authenticated user's loan overpayment preferences.
Query Parameters: none.
Response:

```json
{
  "userId": "uuid",
  "monthlyOverpaymentLimit": "decimal",
  "reinvestReducedPayments": true,
  "updatedAt": "timestamp"
}
```

Success: 200 OK — settings returned.
Errors: 404 Not Found (settings not initialized).
Observability: Reuse middleware-provided requestId for structured logs and mirror it in the `X-Request-Id` response header.

#### PUT /api/user-settings

Description: Create or update settings (upsert single row).
Request Body:

```json
{
  "monthlyOverpaymentLimit": "decimal",
  "reinvestReducedPayments": true
}
```

Response: same as GET.
Success: 200 OK — settings updated; 201 Created — first-time creation.
Errors: 400 Bad Request (negative limit), 409 Conflict (optimistic locking violation).
Observability: Apply the same logging pattern as GET, ensuring requestId is propagated to logs and response headers. If row with settings does not exist then it should be created (acts as POST)

### 2.3 Loans

#### GET /api/loans

Description: List loans owned by authenticated user with pagination and filters.
Query Parameters: `page` (default 1), `pageSize` (default 20, max 100), `isClosed` (optional Boolean), `sort` (`created_at`, `start_month`, `remaining_balance`), `order` (`asc`|`desc`).
Response:

```json
{
  "items": [
    {
      "id": "uuid",
      "principal": "decimal",
      "remainingBalance": "decimal",
      "annualRate": "decimal",
      "termMonths": 360,
      "originalTermMonths": 360,
      "startMonth": "YYYY-MM-01",
      "isClosed": false,
      "closedMonth": null,
      "createdAt": "timestamp"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 1,
  "totalPages": 1
}
```

Success: 200 OK — loans listed.
Errors: 400 Bad Request (invalid pagination args).

#### POST /api/loans

Description: Create a new loan record.
Request Body:

```json
{
  "principal": "decimal",
  "remainingBalance": "decimal",
  "annualRate": "decimal",
  "termMonths": 360,
  "startMonth": "YYYY-MM-01",
  "originalTermMonths": 360
}
```

Response: loan object (see GET).
Success: 201 Created — loan stored.
Errors: 400 Bad Request (violates validation), 409 Conflict (duplicate client-generated id if provided).

#### GET /api/loans/{loanId}

Description: Retrieve specific loan by id.
Success: 200 OK — loan returned.
Errors: 404 Not Found (loan absent or not owned).

#### PUT /api/loans/{loanId}

Description: Replace loan fields (excluding immutable id/user).
Request Body: same as POST; optional `isClosed`, `closedMonth` for mark-closed flow.
Response: updated loan; includes `staleSimulation` flag when active plan invalidated.
Success: 200 OK — loan updated.
Errors: 400 Bad Request (validation), 409 Conflict (closedMonth without isClosed true), 412 Precondition Failed (ETag mismatch).

#### PATCH /api/loans/{loanId}

Description: Partial update (e.g., remaining balance adjustment).
Request Body example:

```json
{
  "remainingBalance": "decimal"
}
```

Response: updated loan with `staleSimulation` indicator.
Success: 200 OK.
Errors: 400 Bad Request (balance > principal).

#### DELETE /api/loans/{loanId}

Description: Delete loan and cascade associated data (DB cascade).
Success: 204 No Content — loan removed, active simulation flagged stale.
Errors: 404 Not Found, 409 Conflict (loan part of running simulation job).

### 2.4 Loan Change Events

#### GET /api/loan-change-events

Description: List change events with filters.
Query Parameters: `loanId` (required), `page`, `pageSize`, `effectiveMonthFrom`, `effectiveMonthTo`, `changeType`.
Response: paginated list mirroring schema fields.
Success: 200 OK.
Errors: 400 Bad Request (missing loanId).

#### POST /api/loan-change-events

Description: Append new change event.
Request Body:

```json
{
  "loanId": "uuid",
  "effectiveMonth": "YYYY-MM-01",
  "changeType": "rate_change",
  "oldAnnualRate": "decimal",
  "newAnnualRate": "decimal",
  "notes": "string"
}
```

Response: created event object.
Success: 201 Created.
Errors: 400 Bad Request (effective month not normalized or new values invalid).

### 2.5 Simulations

#### GET /api/simulations

Description: List simulations for user (history) with filters.
Query Parameters: `status`, `isActive`, `stale`, `page`, `pageSize`, `sort` (`created_at`, `completed_at`).
Response: paginated simulation list including derived metrics.
Success: 200 OK.
Errors: 400 Bad Request (invalid filters).

#### POST /api/simulations

Description: Trigger new simulation run; enqueues background job.
Request Body:

```json
{
  "strategy": "avalanche",
  "goal": "fastest_payoff",
  "paymentReductionTarget": "decimal?",
  "reinvestReducedPayments": true
}
```

Response:

```json
{
  "simulationId": "uuid",
  "status": "running",
  "isActive": false,
  "queuedAt": "timestamp"
}
```

Success: 202 Accepted — simulation queued.
Errors: 409 Conflict (another simulation running; previous cancelled per US-047), 422 Unprocessable Entity (missing target for payment reduction goal).

#### GET /api/simulations/{simulationId}

Description: Fetch simulation details including results when complete.
Response includes schedule summary, aggregated metrics, `loanSnapshots` (optional embed via `include=loanSnapshots` query parameter).
Success: 200 OK.
Errors: 404 Not Found.

#### POST /api/simulations/{simulationId}/activate

Description: Mark completed simulation as active plan.
Success: 200 OK — returns active simulation summary.
Errors: 400 Bad Request (simulation not completed), 409 Conflict (another active simulation; resolved by clearing previous per partial unique index).

#### POST /api/simulations/{simulationId}/cancel

Description: Cancel running simulation and mark status `cancelled`.
Success: 200 OK.
Errors: 404 Not Found, 409 Conflict (simulation already completed).

#### GET /api/simulations/active

Description: Retrieve active simulation details for dashboard.
Success: 200 OK — includes per-loan schedule for current month.
Errors: 404 Not Found (no active simulation).

### 2.6 Simulation Loan Snapshots

#### GET /api/simulation-loan-snapshots

Description: List snapshots for a simulation.
Query Parameters: `simulationId` (required), pagination optional.
Success: 200 OK — returns snapshot array.
Errors: 400 Bad Request (missing simulationId).

### 2.7 Monthly Execution Logs

#### GET /api/monthly-execution-logs

Description: Retrieve paginated logs. Supports dashboard filters.
Query Parameters: `loanId`, `monthStart`, `status`, `overpaymentStatus`, `page`, `pageSize`, `sort` (`month_start`).
Success: 200 OK.
Errors: 400 Bad Request (invalid date).

#### POST /api/monthly-execution-logs

Description: Insert new log row (for current or past month).
Request Body:

```json
{
  "loanId": "uuid",
  "monthStart": "YYYY-MM-01",
  "paymentStatus": "pending",
  "overpaymentStatus": "scheduled",
  "scheduledOverpaymentAmount": "decimal",
  "actualOverpaymentAmount": "decimal",
  "interestPortion": "decimal",
  "principalPortion": "decimal",
  "remainingBalanceAfter": "decimal",
  "reasonCode": "string"
}
```

Response: created log with `id` and timestamps.
Success: 201 Created.
Errors: 400 Bad Request (amount negative), 409 Conflict (duplicate month per loan).

#### PATCH /api/monthly-execution-logs/{logId}

Description: Update statuses (mark payment done, overpayment executed/skipped, backfill).
Request Body example:

```json
{
  "paymentStatus": "paid",
  "paymentExecutedAt": "timestamp",
  "overpaymentStatus": "skipped",
  "reasonCode": "User deferred payment"
}
```

Response: updated log with `staleSimulation` flag when overpayment skipped.
Success: 200 OK.
Errors: 400 Bad Request (invalid status transition), 409 Conflict (log belongs to closed loan).

### 2.8 Simulation History Metrics

#### GET /api/simulation-history-metrics

Description: Paginated history snapshots for a simulation.
Query Parameters: `simulationId`, `page`, `pageSize`.
Success: 200 OK.
Errors: 400 Bad Request (missing simulationId).

#### POST /api/simulation-history-metrics

Description: Insert snapshot (service role only).
Request Body follows table structure.
Success: 201 Created.
Errors: 403 Forbidden (non-service role), 400 Bad Request (invalid values).

### 2.9 Adherence Metrics

#### GET /api/adherence-metrics

Description: Return aggregate adherence counters for user.
Success: 200 OK — single record.
Errors: 404 Not Found (no metrics yet).

#### PUT /api/adherence-metrics

Description: Service role endpoint to overwrite counters (batch recompute).
Success: 200 OK.
Errors: 403 Forbidden (user context), 400 Bad Request.

### 2.10 Strategy Registry

#### GET /api/strategies

Description: List available strategies with descriptions and required parameters.
Response example:

```json
[
  {
    "id": "avalanche",
    "name": "Debt Avalanche",
    "description": "Pay highest interest first"
  }
]
```

Success: 200 OK.
Errors: none (static dataset).

### 2.11 Dashboard Overview

#### GET /api/dashboard/overview

Description: Aggregate active simulation summary, per-loan metrics, current month schedule, adherence ratios, graph-ready data.
Query Parameters: `include` (comma-separated: `interestBreakdown`, `monthlyTrend`).
Response:

```json
{
  "activeSimulation": {
    "id": "uuid",
    "strategy": "avalanche",
    "goal": "fastest_payoff",
    "projectedPayoffMonth": "YYYY-MM-01",
    "totalInterestSaved": "decimal"
  },
  "loans": [
    {
      "loanId": "uuid",
      "remainingBalance": "decimal",
      "monthlyPayment": "decimal",
      "interestSavedToDate": "decimal",
      "monthsRemaining": 42,
      "progress": 0.68,
      "isClosed": false
    }
  ],
  "currentMonth": {
    "monthStart": "YYYY-MM-01",
    "entries": [
      {
        "loanId": "uuid",
        "scheduledPayment": "decimal",
        "scheduledOverpayment": "decimal",
        "paymentStatus": "pending",
        "overpaymentStatus": "scheduled"
      }
    ]
  },
  "graphs": {
    "monthlyBalances": [{ "month": "YYYY-MM-01", "totalRemaining": "decimal" }],
    "interestVsSaved": [
      {
        "month": "YYYY-MM-01",
        "interest": "decimal",
        "interestSaved": "decimal"
      }
    ]
  },
  "adherence": { "executed": 10, "skipped": 2, "ratio": 0.83 }
}
```

Success: 200 OK.
Errors: 404 Not Found (no active simulation).

### 2.12 Admin & Monitoring (optional future scope)

#### GET /api/admin/metrics/resimulations

Description: Service role analytics for re-simulation tracking (US-052).
Success: 200 OK.
Errors: 403 Forbidden for non-admin.

## 3. Authentication and Authorization

- Supabase Auth supplies JWT access tokens; API validates using Supabase client (`supabase.auth.getUser`) on each request.
- Endpoints under `/api/*` require `Authorization: Bearer <token>` header; middleware injects `userId` from token.
- Row-level security is enforced at database level per policies; API ensures all mutations include `user_id = auth.uid()` to satisfy RLS checks.
- Service role operations (metrics aggregation, history inserts) require server-side key stored in secure environment and executed via backend jobs (not exposed to client).
- Rate limiting: apply IP + user-based throttling (e.g., 60 requests/min) using Astro middleware or edge function guard; stricter limits for simulation triggers (5 per user per hour) to prevent queue saturation.
- All destructive endpoints (DELETE loan, cancel simulation) require `X-Client-Confirmation` header token from UI confirmation flow to mitigate accidental calls.
- CSRF protection handled by using bearer tokens only (no cookies) for SPA; ensure HTTPS enforced.
- Email enumeration risk: `POST /api/auth/reset-password` returns 404 for unregistered emails, which may allow attackers to discover valid email addresses; accepted per specification for MVP, with future mitigation options (e.g., always return 202).

## 4. Validation and Business Logic

- `UserSettings`: `monthlyOverpaymentLimit >= 0`; `reinvestReducedPayments` boolean. Updating triggers background task to flag active simulations stale (`simulations.stale = true`).
- `Loan`: enforce `principal > 0`, `annualRate` range `(0,1)`, `termMonths > 0`, `remainingBalance` between 0 and principal, `startMonth` first day of month. Updates mark active simulations stale and may generate default `loan_change_event` entries for auditing.
- `LoanChangeEvent`: require `effectiveMonth` normalized to first day, `changeType` from enum, optional new values validated against schema constraints. Creating event automatically sets related `simulations.stale = true`.
- `Simulation`: `strategy` must exist in registry; `goal` limited to enum; if `goal = payment_reduction` then `paymentReductionTarget > 0`; only one active simulation allowed (unique index). API ensures new POST cancels existing running simulation per US-047 before enqueueing job. Completion persists metrics, optionally seeds history snapshot.
- `SimulationLoanSnapshot`: read-only from API except service jobs; ensures `startingRate` within `(0,1)`, `remainingTermMonths > 0`.
- `MonthlyExecutionLog`: `monthStart` normalized; statuses limited to enums; overpayment skip triggers stale flag; amounts non-negative. API prevents duplicate `(loanId, monthStart)` using transaction-level constraint handling.
- `SimulationHistoryMetric`: write access restricted; values (interest, payments) non-negative; `goal` and `strategy` mirror simulation values for consistency.
- `AdherenceMetric`: counters non-negative integers. `ratio` calculated API-side for responses.
- Business logic cross-resource flows:
  - Loan edits, loan change events, user settings, skipped overpayments call service to set `simulations.stale = true` and enqueue notification.
  - Activating simulation clears previous `is_active` via transaction to satisfy unique partial index.
  - Dashboard endpoint precomputes graph data by aggregating logs and history; caches results per user for 5 minutes to align with index support.
- Input sanitation: text fields (`notes`, `reasonCode`) sanitized/trimmed before storage; length limited (e.g., 500 chars).
- Error handling: database constraint violations mapped to HTTP 400 with machine-readable codes (`ERR_VALIDATION`, `ERR_UNIQUE_CONSTRAINT`).
- Observability: include `X-Request-Id` header in responses; log simulation job transitions for metrics (US-050-053).
