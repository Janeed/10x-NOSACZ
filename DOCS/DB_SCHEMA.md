# NOSACZ PostgreSQL Database Schema

## 1. Tables

> Conventions
>
> - Monetary amounts: NUMERIC(14,2)
> - Annual interest rates (fractional): NUMERIC(7,5) with 0 < rate < 1 (e.g. 0.07250 = 7.250%)
> - Month granularity: DATE representing first day of month (YYYY-MM-01)
> - Timestamps: TIMESTAMPTZ
> - UUID primary keys (Supabase default) unless noted.
> - All user-owned tables include `user_id UUID NOT NULL` with RLS enforcing ownership.

### 1.1 Enumerated Types

```sql
CREATE TYPE simulation_status AS ENUM ('running','active','completed','stale','cancelled');
CREATE TYPE goal_type AS ENUM ('fastest_payoff','payment_reduction');
CREATE TYPE payment_status AS ENUM ('pending','paid','backfilled');
CREATE TYPE overpayment_status AS ENUM ('scheduled','executed','skipped','backfilled');
CREATE TYPE loan_change_type AS ENUM ('rate_change','balance_adjustment','term_adjustment','principal_correction');
```

### 1.2 users (Auth Provided by Supabase)

Not created manually (uses `auth.users`). Referenced by `user_id` in all domain tables.

### 1.3 user_settings

Stores per-user mutable configuration driving simulations (single overpayment limit & preferences).

```sql
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_overpayment_limit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (monthly_overpayment_limit >= 0),
  reinvest_reduced_payments BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.4 loans

Original loan registration data; baseline interest calculations derive from these + change events.

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
  -- Derived convenience fields (optional for faster queries)
  original_term_months INT NOT NULL CHECK (original_term_months > 0),
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  closed_month DATE NULL,
  UNIQUE (user_id, id)
);
```

`original_term_months` duplicates `term_months` at creation to track initial term length if term edits occur later.

### 1.5 loan_change_events

Append-only audit of loan mutations with effective period.

```sql
CREATE TABLE loan_change_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_month DATE NOT NULL, -- first month this change applies
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

Single multi-loan simulation runs per user; one active at a time.

```sql
CREATE TABLE simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  strategy TEXT NOT NULL, -- application-level enum: 'avalanche','snowball','equal','ratio'
  goal goal_type NOT NULL,
  payment_reduction_target NUMERIC(14,2) NULL CHECK ((payment_reduction_target IS NULL) OR payment_reduction_target > 0),
  status simulation_status NOT NULL DEFAULT 'running',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  stale BOOLEAN NOT NULL DEFAULT FALSE, -- quick flag separate from status
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

Frozen loan state at simulation start for deterministic recomputation & comparison.

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

Tracks execution of scheduled regular payments and overpayments per loan per month.

```sql
CREATE TABLE monthly_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  month_start DATE NOT NULL, -- first day of month
  payment_status payment_status NOT NULL DEFAULT 'pending',
  payment_executed_at TIMESTAMPTZ NULL,
  overpayment_status overpayment_status NOT NULL DEFAULT 'scheduled',
  overpayment_executed_at TIMESTAMPTZ NULL,
  scheduled_overpayment_amount NUMERIC(14,2) NULL CHECK (scheduled_overpayment_amount IS NULL OR scheduled_overpayment_amount >= 0),
  actual_overpayment_amount NUMERIC(14,2) NULL CHECK (actual_overpayment_amount IS NULL OR actual_overpayment_amount >= 0),
  interest_portion NUMERIC(14,2) NULL CHECK (interest_portion IS NULL OR interest_portion >= 0),
  principal_portion NUMERIC(14,2) NULL CHECK (principal_portion IS NULL OR principal_portion >= 0),
  remaining_balance_after NUMERIC(14,2) NULL CHECK (remaining_balance_after IS NULL OR remaining_balance_after >= 0),
  reason_code TEXT NULL, -- explanation for skipped / backfilled
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (loan_id, month_start)
);
```

### 1.9 simulation_history_metrics (optional aggregate summaries per simulation)

Stores immutable snapshot metrics to enable historical comparison without full recompute.

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

### 1.10 adherence_metrics (optional, materialized summary for quick dashboard)

Could be a materialized view or table; here as a table for MVP recalculation.

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

| Relationship                             | Cardinality | Notes                                                                             |
| ---------------------------------------- | ----------- | --------------------------------------------------------------------------------- |
| users → user_settings                    | 1:1         | One settings row per user.                                                        |
| users → loans                            | 1:N         | User owns multiple loans. Cascade delete acceptable.                              |
| loans → loan_change_events               | 1:N         | Audit trail of mutations.                                                         |
| users → simulations                      | 1:N         | Multiple simulations; only one active enforced via partial unique index.          |
| simulations → simulation_loan_snapshots  | 1:N         | Snapshot per included loan.                                                       |
| users → monthly_execution_logs           | 1:N         | Each month per loan row owned by user.                                            |
| loans → monthly_execution_logs           | 1:N         | Execution log per loan per month.                                                 |
| simulations → simulation_history_metrics | 1:1 or 1:N  | Typically 1 snapshot created post-completion; can allow N for milestone captures. |
| users → adherence_metrics                | 1:1         | Aggregated counters per user.                                                     |

All relationships are enforced with foreign keys including `ON DELETE CASCADE` to simplify cleanup (MVP assumption: historical retention after deletions not required).

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
-- Ensure only one active simulation per user
CREATE UNIQUE INDEX ux_simulations_user_active ON simulations(user_id) WHERE is_active = true;
-- Quickly find stale simulations needing recompute
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

-- adherence_metrics (PK already covers user_id)
```

## 4. Row-Level Security (RLS) Policies

Enable RLS on all user-owned domain tables after creation:

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

Policies (Supabase pattern using `auth.uid()`):

```sql
-- Generic SELECT policy template
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

Optionally, restrict INSERT on snapshots & metrics to service role if computation done server-side:

```sql
REVOKE ALL ON simulation_loan_snapshots FROM PUBLIC;
REVOKE ALL ON simulation_history_metrics FROM PUBLIC;
-- Then create more granular policies allowing only select; inserts via service role bypass RLS.
```

## 5. Additional Notes & Design Decisions

- Overpayment Limit Versioning: Each simulation stores `monthly_overpayment_limit` + `reinvest_reduced_payments` to preserve historical context even if `user_settings` later change.
- Staleness Handling: `stale` boolean allows quick flagging without forcing immediate status transition; application sets `status='stale'` or keeps last state until recompute requested.
- Baseline Interest: Stored optionally in `simulations` and `simulation_history_metrics` for caching; can be recomputed if null.
- Monthly Results Persistence: Not stored in separate schedule table per planning; execution logs provide realized actions, while future schedule is computed on demand.
- Interest Saved Precision: NUMERIC(14,2) sufficient for PLN currency; rounding occurs at computation layer (document rounding: standard bankers' rounding or ROUND(2)).
- Strategy Validation: Application-layer enum; optional CHECK constraint can be added later: `CHECK (strategy IN ('avalanche','snowball','equal','ratio'))`.
- Active Simulation Uniqueness: Partial unique index ensures at most one `is_active=true`. Switching active simulation requires explicit update clearing previous active flag.
- Closed Loans: `is_closed` + `closed_month` maintained by application logic when remaining balance reaches zero (detected during simulation or after execution log updates).
- Missing Month Detection: Absence of `monthly_execution_logs` row for a (loan, month_start) constitutes a missing month; UI can enumerate months between `start_month` and current month excluding existing rows.
- Backfill Support: Marking prior months inserts rows with `payment_status='backfilled'` / `overpayment_status='backfilled'` capturing historical adherence.
- Performance Considerations: Minimal indexing adheres to MVP scale; can add advanced indexes (e.g., partial indexes on unpaid months) later.
- Materialized View Option: `adherence_metrics` could be a materialized view refreshed on schedule; implemented as a table for simpler writes during MVP.
- Security: All tables rely on simple RLS policies; no cross-user sharing features, simplifying authorization logic.
- Future Extensibility: Adding a `strategies` registry table later would not break existing references—`strategy` remains a TEXT field.
- Concurrency: No optimistic locking columns; UI should debounce actions. If needed later, add `updated_at` + `version INT` to mutable tables.

---

Schema is aligned with PRD functional areas: loan CRUD, change events, simulation lifecycle, execution tracking, metrics & adherence, and user configuration while maintaining MVP simplicity and clear extension paths.
