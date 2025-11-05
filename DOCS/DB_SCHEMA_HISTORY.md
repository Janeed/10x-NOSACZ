jsmieszek: You are a database architect whose task is to create a PostgreSQL database schema based on information provided from planning sessions, a Product Requirements Document (PRD), and the tech stack. Your goal is to design an efficient and scalable database structure that meets project requirements.

1. <prd>
@PRD.md
</prd>

This is the Product Requirements Document that specifies features, functionalities, and project requirements.

2. <session_notes>
DB_PLANNING_SUMMARY.md
</session_notes>

These are notes from the database schema planning session. They may contain important decisions, considerations, and specific requirements discussed during the meeting.

3. <tech_stack>
TECHSTACK.md
</tech_stack>

Describes the technology stack that will be used in the project, which may influence database design decisions.

Follow these steps to create the database schema:

1. Carefully analyze session notes, identifying key entities, attributes, and relationships discussed during the planning session.
2. Review the PRD to ensure that all required features and functionalities are supported by the database schema.
3. Analyze the tech stack and ensure that the database design is optimized for the chosen technologies.

4. Create a comprehensive database schema that includes:
   a. Tables with appropriate column names and data types
   b. Primary keys and foreign keys
   c. Indexes to improve query performance
   d. Any necessary constraints (e.g., uniqueness, not null)

5. Define relationships between tables, specifying cardinality (one-to-one, one-to-many, many-to-many) and any junction tables required for many-to-many relationships.

6. Develop PostgreSQL policies for row-level security (RLS), if applicable, based on requirements specified in session notes or the PRD.

7. Ensure the schema follows database design best practices, including normalization to the appropriate level (typically 3NF, unless denormalization is justified for performance reasons).

The final output should have the following structure:
```markdown
1. List of tables with their columns, data types, and constraints
2. Relationships between tables
3. Indexes
4. PostgreSQL policies (if applicable)
5. Any additional notes or explanations about design decisions
```

Your response should provide only the final database schema in markdown format, which you will save in the file .ai/db-plan.md without including the thinking process or intermediate steps. Ensure the schema is comprehensive, well-organized, and ready to use as a basis for creating database migrations.

GitHub Copilot: Planning todos for database schema creation and then creating the schema file. Outcome: structured plan tracked before writing the markdown file.

Created 6 todos

Starting (2/6) *Draft table definitions*

Starting (3/6) *Define relationships*

Starting (4/6) *Plan indexes*

Starting (5/6) *RLS policies*

Starting (6/6) *Compose markdown schema*

Created [](file:///Users/j.smieszek/Documents/Courses/10x-NOSACZ/.ai)

Created [](file:///Users/j.smieszek/Documents/Courses/10x-NOSACZ/.ai/db-plan.md)

Completed (6/6) *Compose markdown schema*

# NOSACZ PostgreSQL Database Schema

## 1. Tables

> Conventions  
> - Monetary amounts: NUMERIC(14,2)  
> - Annual interest rates (fractional): NUMERIC(7,5) with 0 < rate < 1 (e.g. 0.07250 = 7.250%)  
> - Month granularity: DATE representing first day of month (YYYY-MM-01)  
> - Timestamps: TIMESTAMPTZ  
> - UUID primary keys unless noted  
> - All user-owned tables include `user_id UUID NOT NULL` with RLS enforcing ownership

### 1.1 Enumerated Types
```sql
CREATE TYPE simulation_status AS ENUM ('running','active','completed','stale','cancelled');
CREATE TYPE goal_type AS ENUM ('fastest_payoff','payment_reduction');
CREATE TYPE payment_status AS ENUM ('pending','paid','backfilled');
CREATE TYPE overpayment_status AS ENUM ('scheduled','executed','skipped','backfilled');
CREATE TYPE loan_change_type AS ENUM ('rate_change','balance_adjustment','term_adjustment','principal_correction');
```

### 1.2 users
Managed by Supabase (`auth.users`). Referenced via `user_id`.

### 1.3 user_settings
```sql
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_overpayment_limit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (monthly_overpayment_limit >= 0),
  reinvest_reduced_payments BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.4 loans
```sql
CREATE TABLE loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  principal NUMERIC(14,2) NOT NULL CHECK (principal > 0),
  remaining_balance NUMERIC(14,2) NOT NULL CHECK (remaining_balance >= 0 AND remaining_balance <= principal),
  annual_rate NUMERIC(7,5) NOT NULL CHECK (annual_rate > 0 AND annual_rate < 1),
  term_months INT NOT NULL CHECK (term_months > 0),
  start_month DATE NOT NULL DEFAULT date_trunc('month', now()),
  original_term_months INT NOT NULL CHECK (original_term_months > 0),
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  closed_month DATE NULL,
  UNIQUE (user_id, id)
);
```

### 1.5 loan_change_events
```sql
CREATE TABLE loan_change_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_month DATE NOT NULL,
  change_type loan_change_type NOT NULL,
  old_principal NUMERIC(14,2) NULL,
  new_principal NUMERIC(14,2) NULL,
  old_remaining_balance NUMERIC(14,2) NULL,
  new_remaining_balance NUMERIC(14,2) NULL,
  old_annual_rate NUMERIC(7,5) NULL,
  new_annual_rate NUMERIC(7,5) NULL,
  old_term_months INT NULL,
  new_term_months INT NULL,
  notes TEXT NULL,
  CHECK (effective_month = date_trunc('month', effective_month)),
  CHECK ((new_annual_rate IS NULL) OR (new_annual_rate > 0 AND new_annual_rate < 1)),
  CHECK ((new_principal IS NULL) OR (new_principal > 0)),
  CHECK ((new_remaining_balance IS NULL) OR (new_remaining_balance >= 0)),
  CHECK ((new_term_months IS NULL) OR (new_term_months > 0))
);
```

### 1.6 simulations
```sql
CREATE TABLE simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  strategy TEXT NOT NULL, -- 'avalanche','snowball','equal','ratio'
  goal goal_type NOT NULL,
  payment_reduction_target NUMERIC(14,2) NULL CHECK ((payment_reduction_target IS NULL) OR payment_reduction_target > 0),
  status simulation_status NOT NULL DEFAULT 'running',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  stale BOOLEAN NOT NULL DEFAULT FALSE,
  total_interest_saved NUMERIC(14,2) NULL,
  projected_months_to_payoff INT NULL,
  projected_payoff_month DATE NULL,
  reinvest_reduced_payments BOOLEAN NOT NULL DEFAULT FALSE,
  monthly_overpayment_limit NUMERIC(14,2) NOT NULL CHECK (monthly_overpayment_limit >= 0),
  baseline_interest NUMERIC(14,2) NULL,
  notes TEXT NULL
);
```

### 1.7 simulation_loan_snapshots
```sql
CREATE TABLE simulation_loan_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  starting_balance NUMERIC(14,2) NOT NULL,
  starting_rate NUMERIC(7,5) NOT NULL CHECK (starting_rate > 0 AND starting_rate < 1),
  remaining_term_months INT NOT NULL CHECK (remaining_term_months > 0),
  starting_month DATE NOT NULL,
  UNIQUE (simulation_id, loan_id)
);
```

### 1.8 monthly_execution_logs
```sql
CREATE TABLE monthly_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  month_start DATE NOT NULL,
  payment_status payment_status NOT NULL DEFAULT 'pending',
  payment_executed_at TIMESTAMPTZ NULL,
  overpayment_status overpayment_status NOT NULL DEFAULT 'scheduled',
  overpayment_executed_at TIMESTAMPTZ NULL,
  scheduled_overpayment_amount NUMERIC(14,2) NULL CHECK (scheduled_overpayment_amount IS NULL OR scheduled_overpayment_amount >= 0),
  actual_overpayment_amount NUMERIC(14,2) NULL CHECK (actual_overpayment_amount IS NULL OR actual_overpayment_amount >= 0),
  interest_portion NUMERIC(14,2) NULL CHECK (interest_portion IS NULL OR interest_portion >= 0),
  principal_portion NUMERIC(14,2) NULL CHECK (principal_portion IS NULL OR principal_portion >= 0),
  remaining_balance_after NUMERIC(14,2) NULL CHECK (remaining_balance_after IS NULL OR remaining_balance_after >= 0),
  reason_code TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (loan_id, month_start)
);
```

### 1.9 simulation_history_metrics
```sql
CREATE TABLE simulation_history_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_interest_saved NUMERIC(14,2) NULL,
  baseline_interest NUMERIC(14,2) NULL,
  months_to_payoff INT NULL,
  payoff_month DATE NULL,
  monthly_payment_total NUMERIC(14,2) NULL,
  strategy TEXT NOT NULL,
  goal goal_type NOT NULL
);
```

### 1.10 adherence_metrics
```sql
CREATE TABLE adherence_metrics (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  overpayment_executed_count INT NOT NULL DEFAULT 0,
  overpayment_skipped_count INT NOT NULL DEFAULT 0,
  paid_payment_count INT NOT NULL DEFAULT 0,
  backfilled_payment_count INT NOT NULL DEFAULT 0
);
```

## 2. Relationships

| Relationship | Cardinality | Notes |
|--------------|-------------|-------|
| users → user_settings | 1:1 | Per-user config |
| users → loans | 1:N | Cascade delete acceptable |
| loans → loan_change_events | 1:N | Audit mutations |
| users → simulations | 1:N | One active enforced |
| simulations → simulation_loan_snapshots | 1:N | Snapshot per loan |
| users → monthly_execution_logs | 1:N | Execution tracking |
| loans → monthly_execution_logs | 1:N | Per loan per month |
| simulations → simulation_history_metrics | 1:1 / 1:N | Typically one, allow many |
| users → adherence_metrics | 1:1 | Aggregated counters |

All FKs use `ON DELETE CASCADE` per MVP retention assumptions.

## 3. Indexes
```sql
-- loans
CREATE INDEX idx_loans_user_id ON loans(user_id);
CREATE INDEX idx_loans_is_closed ON loans(is_closed) WHERE is_closed = true;

-- loan_change_events
CREATE INDEX idx_loan_change_events_loan_month ON loan_change_events(loan_id, effective_month);
CREATE INDEX idx_loan_change_events_user_id ON loan_change_events(user_id);

-- simulations
CREATE INDEX idx_simulations_user_id ON simulations(user_id);
CREATE INDEX idx_simulations_status ON simulations(status);
CREATE UNIQUE INDEX ux_simulations_user_active ON simulations(user_id) WHERE is_active = true;
CREATE INDEX idx_simulations_stale ON simulations(user_id) WHERE stale = true;

-- simulation_loan_snapshots
CREATE INDEX idx_sim_loan_snapshots_simulation ON simulation_loan_snapshots(simulation_id);
CREATE INDEX idx_sim_loan_snapshots_user ON simulation_loan_snapshots(user_id);

-- monthly_execution_logs
CREATE INDEX idx_monthly_logs_user_month ON monthly_execution_logs(user_id, month_start);
CREATE INDEX idx_monthly_logs_loan_month ON monthly_execution_logs(loan_id, month_start);
CREATE INDEX idx_monthly_logs_payment_status ON monthly_execution_logs(payment_status);
CREATE INDEX idx_monthly_logs_overpayment_status ON monthly_execution_logs(overpayment_status);

-- simulation_history_metrics
CREATE INDEX idx_sim_history_user ON simulation_history_metrics(user_id);
```

## 4. PostgreSQL Row-Level Security (RLS) Policies

Enable RLS:
```sql
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_change_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_loan_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_history_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE adherence_metrics ENABLE ROW LEVEL SECURITY;
```

Policies:
```sql
CREATE POLICY select_own_user_settings ON user_settings
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY modify_own_user_settings ON user_settings
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY select_own_loans ON loans FOR SELECT USING (user_id = auth.uid());
CREATE POLICY modify_own_loans ON loans FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY select_own_loan_change_events ON loan_change_events FOR SELECT USING (user_id = auth.uid());
CREATE POLICY modify_own_loan_change_events ON loan_change_events FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY select_own_simulations ON simulations FOR SELECT USING (user_id = auth.uid());
CREATE POLICY modify_own_simulations ON simulations FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY select_own_sim_loan_snapshots ON simulation_loan_snapshots FOR SELECT USING (user_id = auth.uid());
CREATE POLICY modify_own_sim_loan_snapshots ON simulation_loan_snapshots FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY select_own_monthly_logs ON monthly_execution_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY modify_own_monthly_logs ON monthly_execution_logs FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY select_own_sim_history_metrics ON simulation_history_metrics FOR SELECT USING (user_id = auth.uid());
CREATE POLICY modify_own_sim_history_metrics ON simulation_history_metrics FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY select_own_adherence_metrics ON adherence_metrics FOR SELECT USING (user_id = auth.uid());
CREATE POLICY modify_own_adherence_metrics ON adherence_metrics FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

Optional restriction for server-computed inserts:
```sql
REVOKE ALL ON simulation_loan_snapshots FROM PUBLIC;
REVOKE ALL ON simulation_history_metrics FROM PUBLIC;
```

## 5. Additional Notes

- Active Simulation: Enforced via partial unique index; switch requires clearing old active flag.
- Staleness: Separate `stale` boolean allows marking without immediate status change; status transitions managed by application logic.
- Baseline Interest: Cached optionally in simulations and history metrics; recompute if null.
- No monthly schedule persistence (per planning); future schedule generated on demand.
- Execution Logs: Presence defines recorded months; absence signals missing/backfill candidates.
- Adherence Metrics: Stored table simplifies quick dashboard rendering; could become a materialized view later.
- Strategy Validation: Application-level; optional future CHECK constraint is trivial.
- Loan Closure: Application sets `is_closed` and `closed_month` when balance hits zero.
- Extensibility: Adding strategy registry or monthly schedule table won’t require breaking existing schema.
- Concurrency: UI debouncing replaces optimistic locking; can add version columns later if needed.
- RLS Simplicity: Direct `user_id` columns remove need for join-based policies, easing maintenance.
- Performance: Index set minimal for MVP; scale adjustments (partitioning, advanced indexing) deferred.
- Backfill: Use `backfilled` statuses to distinguish retroactive entries from real-time logs.

--- 

This schema satisfies PRD requirements for loan management, simulation lifecycle, overpayment configuration, execution tracking, metrics, and user isolation while remaining lean and extensible for future iterations.

Made changes.