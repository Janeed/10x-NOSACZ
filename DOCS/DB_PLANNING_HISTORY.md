\jsmieszek: You are an AI assistant whose task is to help plan a PostgreSQL database schema for an MVP (Minimum Viable Product) based on the provided information. Your goal is to generate a list of questions and recommendations that will be used in subsequent prompting to create the database schema, relationships, and row-level security (RLS) policies.

Please carefully review the following information:

<product_requirements>
PRD.md
</product_requirements>

<tech_stack>
TECHSTACK.md
</tech_stack>

Analyze the provided information, focusing on aspects relevant to database design. Consider the following issues:

1. Identify key entities and their attributes based on product requirements.
2. Determine potential relationships between entities.
3. Consider data types and constraints that may be necessary.
4. Think about scalability and performance impact.
5. Assess security requirements and their impact on database design.
6. Consider any specific PostgreSQL features that might be beneficial for the project.

Based on your analysis, generate a list of 10 questions and recommendations in a combined form (question + recommendation). These should address any ambiguities, potential issues, or areas where more information is needed to create an effective database schema. Consider questions regarding:

1. Entity relationships and cardinality
2. Data types and constraints
3. Indexing strategies
4. Partitioning (if applicable)
5. Row-level security requirements
6. Performance considerations
7. Scalability concerns
8. Data integrity and consistency

The output should have the following structure:

<questions>
List your questions and recommendations here, numbered for clarity:

For example:

1. Should the `users` entity have a relationship with `posts`?

Recommendation: Yes, the `users` entity should have a relationship with `posts` because users can create posts.
</questions>

Remember that your goal is to provide a comprehensive list of questions and recommendations that will help create a solid PostgreSQL database schema for the MVP. Focus on clarity, relevance, and accuracy of your outputs. Do not include any additional comments or explanations beyond the specified output format.

Continue this process, generating new questions and recommendations based on the provided context and user responses, until the user explicitly requests a summary.

Remember to focus on clarity, relevance, and accuracy of outputs. Do not include any additional comments or explanations beyond the specified output format.

GitHub Copilot: <questions>

1. How should simulations relate to users—one-to-many or allow shared simulations later?  
   Recommendation: Model `simulations` as many-to-one with `users` now (foreign key user_id, ON DELETE CASCADE) while reserving a nullable unique public_share_token for future sharing without schema rewrite.

2. Do we need a separate `loans` history table for interest rate and balance changes?  
   Recommendation: Yes—create `loan_rate_changes` (loan_id, effective_month, annual_rate) and optionally `loan_balance_adjustments` to preserve auditability and enable correct backdated simulations instead of overwriting current values.

3. Should monthly schedule output be stored denormalized or recomputed on demand?  
   Recommendation: Store simulation results in a `simulation_monthly_entries` table (simulation_id, loan_id, month_start_date, scheduled_payment, overpayment, interest_accrued, principal_applied, remaining_balance, interest_saved_cumulative) with composite unique constraint (simulation_id, loan_id, month_start_date) to avoid expensive recompute for dashboard loads.

4. How to represent “active” vs “stale” simulation state?  
   Recommendation: Add `status` ENUM ('active','completed','stale','running','cancelled') plus `is_active boolean` (partial unique index where is_active = true) on `simulations` to enforce single active simulation per user and enable async transitions.

5. What’s the best structure for tracking monthly user confirmations (payments/overpayments)?  
   Recommendation: Create `monthly_execution_logs` (user_id, loan_id, month_start_date, payment_status ENUM, overpayment_status ENUM, timestamps) with a unique (user_id, loan_id, month_start_date) and partial indexes filtering NULL statuses to speed adherence metrics.

6. How to store strategy definitions for extensibility (registry) vs hard-coded enums?  
   Recommendation: Use a `strategies` table (id, code UNIQUE, name, description, is_active) seeded with initial four; reference strategy_id in `simulations` to allow future additions without migrations; retain a deterministic allocation version field in `simulations` for reproducibility.

7. What RLS granularity is needed across related tables?  
   Recommendation: Enable RLS on all user-owned tables (`loans`, `simulations`, `simulation_monthly_entries`, `monthly_execution_logs`, analytics event tables) with policies referencing `auth.uid() = user_id` or via joining through `simulation_id` -> `simulations.user_id` to prevent cross-user leakage.

8. Do we need specialized indexing for performance on timeline queries?  
   Recommendation: Yes—add composite btree indexes: (user_id, is_active) on `simulations`; (simulation_id, loan_id, month_start_date) on `simulation_monthly_entries`; (user_id, loan_id, month_start_date) on `monthly_execution_logs`; plus (loan_id, effective_month) on `loan_rate_changes` for range scans.

9. Should large simulation result sets be partitioned by user or date?  
   Recommendation: Not initially—projected MVP volume is likely low; defer native partitioning, but design month_start_date as DATE (first-of-month) to allow future LIST/RANGE partitioning on year or user_id if row counts exceed performance thresholds.

10. How to ensure atomic updates when loan edits trigger stale simulation flags?  
    Recommendation: Use a server-side transaction (RPC or Postgres function) that updates `loans`, inserts history row, and sets all user `simulations.status = 'stale'` where status IN ('active','completed')—guard with CHECK constraints and a deferred unique partial index for single active simulation to preserve integrity under concurrency.
    </questions>

jsmieszek: 1. where is 1? 2. yes, in order to keep track of past progress, the simulation starts from the change point always. 3. let's recalculate on demand for now 4. good idea, let's add status and isActive columns 5. your idea with monthly_execution_logs sounds ok

GitHub Copilot:

jsmieszek: 1. where is 1? 2. yes, in order to keep track of past progress, the simulation starts from the change point always. 3. let's recalculate on demand for now 4. good idea, let's add status and isActive columns 5. your idea with monthly_execution_logs sounds ok 6. let's assume strategy type will be string column which will be represented as enum on code-side. so hardcoded for now for simplicity 7. enable RLS 8. no, keep it simple 9. no 10. let's not worry about it for MVP

GitHub Copilot: <questions>

1. Clarify simulations ownership: Are simulations strictly owned by a single user with no sharing or cross-user visibility?  
   Recommendation: Confirm a simple one-to-many (users → simulations) with `simulations.user_id` (FK ON DELETE CASCADE) and no sharing fields now; reserve future extensibility via optional `shared_at` / `public_share_token` columns later if needed.

2. How will we persist a “baseline snapshot” for interest-saved calculations when results are recalculated on demand (no monthly results table)?  
   Recommendation: Add `baseline_amortization JSONB` (or compressed) to `simulations` containing per-loan baseline monthly interest totals to enable deterministic “interest_saved” without fully storing each simulated month.

3. Do we need a lightweight loan snapshot at each simulation start (since simulation restarts from change point)?  
   Recommendation: Store `simulation_loan_snapshots` (simulation_id, loan_id, starting_balance, starting_rate, remaining_term_months) to anchor recomputation and simplify diffing when later changes occur.

4. What numeric precision should we adopt for monetary and rate fields to avoid rounding drift?  
   Recommendation: Use `NUMERIC(14,2)` for monetary (PLN) amounts and `NUMERIC(7,5)` (or basis points integer) for annual_rate; enforce CHECK (annual_rate > 0 AND annual_rate < 1) if stored as fractional (e.g., 0.0725 for 7.25%).

5. How should we represent monthly execution statuses to balance flexibility and analytics?  
   Recommendation: Use `monthly_execution_logs` with columns: payment_status ENUM('pending','done','missed'), overpayment_status ENUM('scheduled','executed','skipped'), plus `reason_code TEXT NULL` for skipped and unique (user_id, loan_id, month_start_date); include `executed_at timestamptz` fields for each action.

6. Do we need soft deletes to preserve historical analytics when a loan is removed?  
   Recommendation: Replace hard delete with `deleted_at timestamptz NULL` and partial index WHERE deleted_at IS NULL; RLS should exclude soft-deleted rows while simulations referencing them remain auditable.

7. How will we audit sensitive loan mutations (rate changes, balance adjustments) for correctness and rollback?  
   Recommendation: Implement `loan_change_events` (id, loan_id, user_id, change_type ENUM('rate','balance','term','principal'), old_value JSONB, new_value JSONB, effective_month, created_at) and use it as the source of truth instead of overwriting fields directly; maintain current values via triggers or application logic.

8. Which minimal indexes (despite “keep it simple”) are still required to avoid obvious performance issues?  
   Recommendation: Add: (user_id, is_active) on `simulations`; (loan_id) FK indexes; (user_id, month_start_date) on `monthly_execution_logs`; (loan_id, effective_month) on `loan_change_events`; avoid premature composite bloat beyond these.

9. How will RLS handle indirect access (e.g., selecting snapshots or change events joined through simulations)?  
   Recommendation: Define RLS policies on each table enforcing `user_id = auth.uid()` directly (add user_id to dependent tables) rather than relying on join-based policies, simplifying Supabase policy definitions and reducing risk of accidental leakage.

10. How do we prevent race conditions between marking monthly execution and triggering a re-simulation (e.g., user clicks twice fast)?  
    Recommendation: Use an optimistic concurrency column (`version INT` or updated_at check) on `loans` and `simulations`; wrap mutation + stale-flagging in a transaction and enforce a unique partial index on `simulations(user_id) WHERE is_active = true` to abort conflicting updates gracefully.
    </questions>

jsmieszek: 2. each loan row should contain data from first register (amounts, interest, payments remaining) and based on that we can simulate baseline. would that be enough? 3. let's store the simulation snapshots 4. proceed with the recommendation 5. recommendation sounds about right! 6. no need for soft delete 7. sounds good, let's keep loan change events 8. there will be minimal amount of data for MVP, let's skip indexes 9. enforce user_id = auth.uid() 10. let's just implement debounce on UI for now in such cases
