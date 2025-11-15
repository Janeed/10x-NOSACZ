<conversation_summary>
<decisions>

1. Simulations are strictly owned by a single user (one-to-many: users → simulations); no sharing features in MVP.
2. Simulation recomputation will occur on demand; no persistent monthly schedule table for results in MVP.
3. Each simulation can restart from the change point (loan edits, etc.).
4. Add `status` (ENUM planned: active, completed, stale, running, cancelled) and `is_active` boolean columns to `simulations` to enforce a single active simulation per user.
5. Implement `monthly_execution_logs` table for tracking regular payment and overpayment execution statuses per loan per month.
6. Strategy type stored as a plain string column (hardcoded enum in application code) rather than a separate strategies registry table for MVP.
7. Enable Row Level Security (RLS) on all user-owned tables; policies will enforce `user_id = auth.uid()` directly.
8. Skip specialized / composite indexing for MVP due to minimal data volume (only essential implicit FK indexes if created automatically by Supabase/Postgres).
9. No table partitioning in MVP.
10. Skip atomic multi-step transaction optimization beyond basic Postgres transactions for MVP (simplify initial implementation).
11. Baseline interest saved calculations will rely on original loan registration data (principal, rate, term) rather than storing a separate baseline amortization JSON snapshot.
12. Store per-simulation loan snapshots (`simulation_loan_snapshots`) to capture starting balance, rate, and remaining term at simulation start.
13. Adopt precise numeric types: monetary amounts as NUMERIC(14,2); annual interest rates as NUMERIC(7,5) fractional (e.g., 0.07250 for 7.25%).
14. Include `loan_change_events` table to audit loan mutations (rate, balance, term, principal) with effective month.
15. No soft delete mechanism for loans; hard deletes are acceptable in MVP.
16. RLS will include `user_id` in dependent tables directly to avoid join-based policy complexity.
17. Concurrency/race mitigation (double-click actions) deferred to a UI debounce rather than optimistic locking/version columns for MVP.
    </decisions>

<matched_recommendations>

1. Simulations one-to-many with users (Recommendation adopted; sharing deferred).
2. Recalculate on demand instead of storing monthly entries (Recommendation modified: monthly table dropped; baseline snapshot proposal rejected in favor of original loan data baseline).
3. Store simulation loan snapshots (Recommendation adopted).
4. Use `status` ENUM + `is_active` flag on simulations (Recommendation adopted).
5. Implement `monthly_execution_logs` with payment and overpayment statuses plus timestamps (Recommendation adopted; exact ENUM values to finalize).
6. Strategy extensibility table deferred; simple string enum chosen (Recommendation partially rejected; simplified approach confirmed).
7. Enable RLS on all user-owned tables using direct `user_id` (Recommendation adopted, refined to avoid join policies).
8. Skip advanced indexing beyond minimal essentials (Recommendation rejected—performance indexes deferred entirely for MVP).
9. No partitioning; defer until scale increases (Recommendation adopted).
10. Atomic transaction + optimistic concurrency controls deferred (Recommendation rejected in favor of simple UI debounce).
11. Numeric precision for monetary/rate fields (Recommendation adopted).
12. Loan change auditing via `loan_change_events` (Recommendation adopted).
    </matched_recommendations>

<database_planning_summary>
The MVP database design centers on user-owned financial entities with minimal persistence complexity, prioritizing simplicity and correctness of recalculated simulations over precomputed storage.

Key Entities:

- users: Managed by Supabase auth; referenced via `user_id` (UUID) in all domain tables.
- loans: Core loan records holding original registration data (principal, remaining_balance at creation if mid-term, annual_rate, term_months, start_month). Serves as source for baseline interest calculations.
- loan_change_events: Append-only audit trail for loan mutations (rate changes, balance adjustments, term edits, principal corrections) with `effective_month` to support re-simulation triggers.
- simulations: Represents a single multi-loan run. Fields: id, user_id, created_at, strategy (string), goal_type (ENUM: fastest_payoff | payment_reduction), payment_reduction_target (NUMERIC, nullable), status (ENUM), is_active (boolean), started_at, completed_at, cancelled_at (nullable). Baseline interest saved will be computed dynamically using current loan originals and change events combined with overpayment configuration.
- simulation_loan_snapshots: Captures per-loan starting state for a simulation (simulation_id, loan_id, starting_balance, starting_rate, remaining_term_months) enabling deterministic recompute after changes.
- monthly_execution_logs: Tracks user-confirmed payment and overpayment actions per month per loan (user_id, loan_id, month_start_date, payment_status, payment_executed_at, overpayment_status, overpayment_executed_at, reason_code nullable). Drives adherence metrics and interest saved to date recalculation.

Relationships:

- users → loans: one-to-many (cascade delete acceptable; historical analytics for deleted loans not required).
- users → simulations: one-to-many; a partial uniqueness constraint logic (application-level) on simulations enforces a single active simulation (is_active = true) per user.
- simulations → simulation_loan_snapshots: one-to-many.
- users → monthly_execution_logs and loans → monthly_execution_logs (dual FK for ownership and loan context).
- loans → loan_change_events: one-to-many; also includes user_id for direct RLS enforcement.

Data Types & Constraints:

- Monetary fields: NUMERIC(14,2).
- Annual interest rate: NUMERIC(7,5) with CHECK (annual_rate > 0 AND annual_rate < 1).
- Term: INTEGER > 0.
- Remaining balance validations on creation and mutation (0 <= remaining_balance <= principal).
- Month fields: Use DATE representing first day of month (e.g., YYYY-MM-01) for consistency.
- Status fields implemented as ENUMs (to define): simulation_status, payment_status, overpayment_status.

Security & RLS:

- All domain tables (`loans`, `loan_change_events`, `simulations`, `simulation_loan_snapshots`, `monthly_execution_logs`) include `user_id` for direct RLS policies: USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid()).
- No cross-user access paths; no public sharing tokens in MVP.
- Avoid join-dependent RLS complexity; each table stores user_id redundantly where needed.

Performance & Scalability:

- Recalculation on demand avoids storing large monthly result sets initially.
- Indexing intentionally minimal—rely on implicit primary keys and foreign keys; performance acceptable at low volume.
- Partitioning deferred; DATE model enables future range/list partitioning if needed.

Integrity & Consistency:

- `loan_change_events` ensures historical audit for rate and balance edits; application logic applies latest effective values for simulation recompute.
- Simulation staleness triggered when any relevant loan or configuration change occurs; `status` transitions managed by application (no concurrency optimization beyond UI debouncing).
- Snapshots provide frozen starting context per simulation to maintain reproducibility even as loans evolve afterward.

Interest Saved Calculation Approach:

- Baseline derived dynamically from original loan parameters (principal, rate, term) excluding overpayments, adjusted for mid-term starting balance and accumulated changes via events up to simulation start date.
- Cumulative interest saved computed during on-demand recalculation using current execution logs and baseline amortization math.

Strategy Handling:

- Strategy stored as string (e.g., 'avalanche', 'snowball', 'equal', 'ratio'); application-level enum ensures validity; DB CHECK could optionally enforce allowed set later.

Concurrency & UX:

- No versioning or optimistic locking columns; UI debounce prevents duplicate state mutations (e.g., double payment mark).

Omissions (Intentional for MVP):

- No monthly simulation results persistence table.
- No advanced indexing or partitioning.
- No soft deletes / historical retention after loan deletion.
- No sharing/public tokens for simulations.

This foundation supports incremental future additions (e.g., strategies registry, monthly results storage, baseline snapshot caching, performance indexes) without major schema rewrites thanks to explicit snapshot and event tables.
</database_planning_summary>

<unresolved_issues>

1. Precise ENUM value sets for `simulation.status`, `payment_status`, and `overpayment_status` need final confirmation.
2. Exact logic for deriving baseline interest when multiple `loan_change_events` precede first simulation requires specification (apply all changes effective before simulation start?).
3. Definition of what transitions a simulation into `completed` vs `stale` states (end condition rules) remains to be finalized.
4. Retention policy for simulations (limit N=10 or unlimited) not yet confirmed for MVP.
5. Handling of loan deletion while an active simulation references it (immediate staleness vs graceful archival) needs explicit rule.
6. Whether to add minimal indexes for FK columns explicitly (Supabase sometimes auto-creates) should be verified in environment.
7. Validation approach for strategy string (CHECK constraint vs application-only) undecided.
8. Effective date granularity for change events (support current month vs next month toggle) requires clear application of event order when multiple changes occur in same month.
9. Interest saved computation formula details (rounding rules, frequency of recompute on dashboard) need documentation.
10. Whether `simulation_loan_snapshots` should store payment_made_to_date or only structural fields is undecided.
    </unresolved_issues>
    </conversation_summary>
