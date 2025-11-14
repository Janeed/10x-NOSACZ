<api_analysis>

1. Main database entities (with schema quotes)
   1.1. `user_settings`: “CREATE TABLE user_settings (...) monthly_overpayment_limit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (monthly_overpayment_limit >= 0), reinvest_reduced_payments BOOLEAN NOT NULL DEFAULT FALSE...” (`.ai/db-plan.md`, lines 33-38).
   1.2. `loans`: “CREATE TABLE loans (... principal NUMERIC(14,2) NOT NULL CHECK (principal > 0), remaining_balance NUMERIC(14,2) NOT NULL CHECK (remaining_balance >= 0 AND remaining_balance <= principal), annual_rate NUMERIC(7,5) NOT NULL CHECK (annual_rate > 0 AND annual_rate < 1), term_months INT NOT NULL CHECK (term_months > 0)... is_closed BOOLEAN NOT NULL DEFAULT FALSE, closed_month DATE NULL” (lines 46-60).
   1.3. `loan_change_events`: “CREATE TABLE loan_change_events (... effective_month DATE NOT NULL... change_type loan_change_type NOT NULL... CHECK ((new_annual_rate IS NULL) OR (new_annual_rate > 0 AND new_annual_rate < 1))...” (lines 70-91).
   1.4. `simulations`: “CREATE TABLE simulations (... strategy TEXT NOT NULL... goal goal_type NOT NULL... status simulation_status NOT NULL DEFAULT 'running', is_active BOOLEAN NOT NULL DEFAULT FALSE, stale BOOLEAN NOT NULL DEFAULT FALSE...” (lines 99-119).
   1.5. `simulation_loan_snapshots`: “CREATE TABLE simulation_loan_snapshots (... starting_balance NUMERIC(14,2) NOT NULL, starting_rate NUMERIC(7,5) NOT NULL CHECK (starting_rate > 0 AND starting_rate < 1), remaining_term_months INT NOT NULL CHECK (remaining_term_months > 0)...” (lines 127-138).
   1.6. `monthly_execution_logs`: “CREATE TABLE monthly_execution_logs (... payment_status payment_status NOT NULL DEFAULT 'pending', overpayment_status overpayment_status NOT NULL DEFAULT 'scheduled', ... UNIQUE (loan_id, month_start)” (lines 145-162).
   1.7. `simulation_history_metrics`: “CREATE TABLE simulation_history_metrics (... total_interest_saved NUMERIC(14,2) NULL, ... strategy TEXT NOT NULL, goal goal_type NOT NULL)” (lines 170-182).
   1.8. `adherence_metrics`: “CREATE TABLE adherence_metrics (... overpayment_executed_count INT NOT NULL DEFAULT 0...” (lines 190-197).
   1.9. Enumerated types `simulation_status`, `goal_type`, `payment_status`, `overpayment_status`, `loan_change_type` (lines 17-22) support business logic.

2. Key business logic features from PRD (with quotes)
   2.1. Loan lifecycle management: “Add loan... Edit loan... Delete loan... Update remaining balance... Change interest rate...” (PRD lines 47-72).
   2.2. Overpayment strategies & settings: “User sets a single monthly overpayment limit... Supported predefined strategies... Toggle reinvest reduced payments...” (lines 56-104).
   2.3. Simulation workflow: “Single active simulation... Simulation algorithm produces per-month schedule... Async simulation completion notification...” (lines 63-118).
   2.4. Dashboard updates & adherence tracking: “Monthly update workflow: user marks payment done... skipped... backfill...” (lines 75-112, 390-449).
   2.5. Authentication & access control: “User registration... login... authorization: user can only access own loans/simulations.” (lines 87-146, 458-495).
   2.6. Metrics tracking: “Track number of simulations generated per user... re-simulations... overpayment adherence.” (lines 118-124, 540-565).
   2.7. Notifications and performance: “If simulation exceeds defined time threshold... run asynchronously... Queue simulations...” (lines 104-112).

3. Mapping features to potential endpoint designs
   3.1. Loan CRUD (Feature 2.1): Option A - `/api/loans` with RESTful endpoints; Option B - `/api/users/{userId}/loans`. Chosen: Option A with authenticated user context because Supabase RLS enforces ownership and user id derived from session, reducing path complexity for multi-tenant access.
   3.2. Overpayment settings (Feature 2.2): Option A - embed in `/user-settings`; Option B - incorporate in `/users/me/settings`. Chosen Option A `/api/user-settings` leveraging single-row per user, aligning with table and enabling PUT semantics.
   3.3. Strategy registry view (Feature 2.2): Option A - static JSON accessible via `/api/strategies`; Option B - include within simulations endpoint. Chosen Option A to support future extension registry (PRD US-054).
   3.4. Simulation workflow (Feature 2.3): Option A - `/api/simulations` with POST to trigger new run; Option B - `/api/simulation-run` specialized action. Chose Option A for REST alignment and to allow list/history retrieval (supports US-019 comparison).
   3.5. Async notifications (Feature 2.3): Option A - rely on websockets; Option B - poll `/api/simulations/{id}` or `/status`. Chose Option B (polling endpoints) per MVP; websockets not mentioned in tech stack.
   3.6. Monthly execution updates (Feature 2.4): Option A - endpoints per loan: `/api/loans/{loanId}/monthly-logs`; Option B - aggregated `/api/monthly-execution-logs`. Chose Option B to align with table and allow filtering by loan/month.
   3.7. Dashboard metrics (Feature 2.4 & 2.6): Option A - compute on client by fetching logs; Option B - provide dedicated read endpoints like `/api/dashboard` summarizing active simulation, adherence. Chose combination: `/api/dashboard/overview` for aggregated metrics using `adherence_metrics` and `simulation_history_metrics` because PRD requires quick view.
   3.8. Metrics tracking (Feature 2.6): Option A - direct resource endpoints for metrics; Option B - part of admin analytics. Chose limited user-level retrieval via `/api/metrics/adherence` etc., admin endpoints optional.
   3.9. Authentication (Feature 2.5): Option A - rely entirely on Supabase Auth restful endpoints; Option B - custom endpoints. Chose Option A referencing Supabase's built-in auth, but plan includes integration documentation. Provide API middleware to enforce tokens.

4. Security and performance requirements with supporting quotes
   4.1. Authorization & isolation: “Authorization: user can only access own loans/simulations (US-041).” (PRD lines 491-495).
   4.2. Confirmation for destructive actions: “System asks for confirmation on destructive tasks.” (PRD lines 450-455) → implies API should require idempotency or multi-step? Document structure.
   4.3. Async threshold and queueing: “If simulation exceeds defined time threshold... run asynchronously... Queue simulations if another is running; inform user (US-047).” (lines 108-112).
   4.4. Validation constraints: multiple checks in schema (principal >0, etc.) ensuring API validation prior to DB.
   4.5. RLS policies: “Enable RLS on all user-owned domain tables... CREATE POLICY ... USING (user_id = auth.uid()).” (`.ai/db-plan.md`, lines 253-295) ensures row-level protection.
   4.6. Security assumptions: “Basic authentication and authorization (single-user data isolation).” (PRD lines 134-147).
   4.7. Performance indexes: e.g., “CREATE INDEX idx_loans_user_id ON loans(user_id);” (schema lines 219-249) supporting query design; also partial unique index for active simulation.

5. Business logic to endpoint mapping
   5.1. Loan modifications (US-003, US-006): handled by `PUT /api/loans/{id}` with logic to mark associated active simulations stale via service orchestrating updates to `simulations.stale=true`.
   5.2. Overpayment limit updates (US-007/US-008): `PUT /api/user-settings` updates `monthly_overpayment_limit` and triggers `simulations` stale flag.
   5.3. Simulation run (US-017/US-047): `POST /api/simulations` triggers job; `POST /api/simulations/{id}/cancel` handles queue/cancel; `GET /api/simulations/active` for dashboard (US-023).
   5.4. Monthly logs updates (US-030-033): `POST /api/monthly-execution-logs` for new logs/backfill; `PATCH /api/monthly-execution-logs/{id}` to mark statuses and triggers stale when skipping overpayments.
   5.5. Metrics retrieval (US-034-035, US-053): `GET /api/dashboard/overview`, `GET /api/metrics/adherence`.
   5.6. Strategy registry (US-009, US-054): `GET /api/strategies`.

6. Validation conditions integration
   6.1. `loans` endpoints enforce `principal > 0`, `remaining_balance >=0 && <= principal`, `annual_rate` range, `term_months > 0`, `start_month` first of month.
   6.2. `loan_change_events` endpoints require `effective_month` at month start, enumerated `change_type`, optional new values must respect constraints.
   6.3. `simulations` creation requires `goal` in enum, `strategy` in supported list, payment reduction goal must include `payment_reduction_target >0`.
   6.4. `monthly_execution_logs` ensure statuses use enumerations, amounts non-negative, `month_start` normalized to first day.
   6.5. `user_settings` enforce non-negative `monthly_overpayment_limit`.
   6.6. `simulation_history_metrics` and `adherence_metrics` endpoints enforce integer counters >=0.

Assumptions:

- Supabase auth supplies JWT with `user_id` embedded; API service uses Supabase client verifying tokens.
- Background simulation processing performed via Supabase edge function or serverless worker; API triggers job and stores status in `simulations`.
- Notifications delivered via polling endpoints; websockets optional future upgrade.
  </api_analysis>
