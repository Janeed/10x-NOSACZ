-- migration: create core nosacz domain schema (types, tables, indexes, rls policies)
-- timestamp (utc): 2025-11-05 12:15:30
-- description:
--   establishes enumerated types and all mvp tables for loan management, simulations,
--   execution logging, metrics, and user settings. applies row level security (rls)
--   and granular policies per supabase role (anon vs authenticated) and per command
--   category (select / insert / update / delete). policies restrict access to owning
--   user via auth.uid(). anon role is explicitly denied via policies returning false.
-- special considerations:
--   - uses gen_random_uuid() -> requires pgcrypto extension (enabled by supabase by default, but guarded here).
--   - partial unique index to guarantee single active simulation per user.
--   - simulation_loan_snapshots & simulation_history_metrics inserts may be intended for service role only;
--     revokes from public included; service role bypasses rls.
--   - all monetary numeric columns sized NUMERIC(14,2); annual rates NUMERIC(7,5) with 0<rate<1.
--   - month granular dates normalized to first day of month.
--   - destructive operations (revokes) are documented thoroughly.
-- rollback guidance (manual): dropping types requires first dropping dependent objects; not automated here.

-- ensure required extension for uuid generation
create extension if not exists pgcrypto with schema public;

-- =============================================================
-- 1. enumerated types
-- =============================================================
create type simulation_status as enum ('running','active','completed','stale','cancelled');
create type goal_type as enum ('fastest_payoff','payment_reduction');
create type payment_status as enum ('pending','paid','backfilled');
create type overpayment_status as enum ('scheduled','executed','skipped','backfilled');
create type loan_change_type as enum ('rate_change','balance_adjustment','term_adjustment','principal_correction');

-- =============================================================
-- 2. tables
-- =============================================================
-- user_settings: per-user configuration influencing simulation parameters.
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_overpayment_limit numeric(14,2) not null default 0 check (monthly_overpayment_limit >= 0),
  reinvest_reduced_payments boolean not null default false,
  updated_at timestamptz not null default now()
);

-- loans: base loan registration and status tracking.
create table public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  principal numeric(14,2) not null check (principal > 0),
  remaining_balance numeric(14,2) not null check (remaining_balance >= 0 and remaining_balance <= principal),
  annual_rate numeric(7,5) not null check (annual_rate > 0 and annual_rate < 1),
  term_months int not null check (term_months > 0),
  start_month date not null default date_trunc('month', now()),
  original_term_months int not null check (original_term_months > 0),
  is_closed boolean not null default false,
  closed_month date null,
  unique (user_id, id)
);

-- loan_change_events: append-only audit trail of loan mutations.
create table public.loan_change_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete cascade,
  created_at timestamptz not null default now(),
  effective_month date not null,
  change_type loan_change_type not null,
  old_principal numeric(14,2) null,
  new_principal numeric(14,2) null,
  old_remaining_balance numeric(14,2) null,
  new_remaining_balance numeric(14,2) null,
  old_annual_rate numeric(7,5) null,
  new_annual_rate numeric(7,5) null,
  old_term_months int null,
  new_term_months int null,
  notes text null,
  check (effective_month = date_trunc('month', effective_month)),
  check ((new_annual_rate is null) or (new_annual_rate > 0 and new_annual_rate < 1)),
  check ((new_principal is null) or (new_principal > 0)),
  check ((new_remaining_balance is null) or (new_remaining_balance >= 0)),
  check ((new_term_months is null) or (new_term_months > 0))
);

-- simulations: represents a simulation run across user loans.
create table public.simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null,
  cancelled_at timestamptz null,
  strategy text not null, -- application layer enum ('avalanche','snowball','equal','ratio')
  goal goal_type not null,
  payment_reduction_target numeric(14,2) null check ((payment_reduction_target is null) or payment_reduction_target > 0),
  status simulation_status not null default 'running',
  is_active boolean not null default false,
  stale boolean not null default false,
  total_interest_saved numeric(14,2) null,
  projected_months_to_payoff int null,
  projected_payoff_month date null,
  reinvest_reduced_payments boolean not null default false,
  monthly_overpayment_limit numeric(14,2) not null check (monthly_overpayment_limit >= 0),
  baseline_interest numeric(14,2) null,
  notes text null
);

-- simulation_loan_snapshots: frozen loan state at simulation start.
create table public.simulation_loan_snapshots (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.simulations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete cascade,
  starting_balance numeric(14,2) not null,
  starting_rate numeric(7,5) not null check (starting_rate > 0 and starting_rate < 1),
  remaining_term_months int not null check (remaining_term_months > 0),
  starting_month date not null,
  unique (simulation_id, loan_id)
);

-- monthly_execution_logs: captures execution of regular and overpayments per loan/month.
create table public.monthly_execution_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete cascade,
  month_start date not null,
  payment_status payment_status not null default 'pending',
  payment_executed_at timestamptz null,
  overpayment_status overpayment_status not null default 'scheduled',
  overpayment_executed_at timestamptz null,
  scheduled_overpayment_amount numeric(14,2) null check (scheduled_overpayment_amount is null or scheduled_overpayment_amount >= 0),
  actual_overpayment_amount numeric(14,2) null check (actual_overpayment_amount is null or actual_overpayment_amount >= 0),
  interest_portion numeric(14,2) null check (interest_portion is null or interest_portion >= 0),
  principal_portion numeric(14,2) null check (principal_portion is null or principal_portion >= 0),
  remaining_balance_after numeric(14,2) null check (remaining_balance_after is null or remaining_balance_after >= 0),
  reason_code text null,
  created_at timestamptz not null default now(),
  unique (loan_id, month_start)
);

-- simulation_history_metrics: immutable snapshot metrics for historical comparisons.
create table public.simulation_history_metrics (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.simulations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  captured_at timestamptz not null default now(),
  total_interest_saved numeric(14,2) null,
  baseline_interest numeric(14,2) null,
  months_to_payoff int null,
  payoff_month date null,
  monthly_payment_total numeric(14,2) null,
  strategy text not null,
  goal goal_type not null
);

-- adherence_metrics: aggregated adherence counters per user.
create table public.adherence_metrics (
  user_id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  overpayment_executed_count int not null default 0,
  overpayment_skipped_count int not null default 0,
  paid_payment_count int not null default 0,
  backfilled_payment_count int not null default 0
);

-- =============================================================
-- 3. indexes
-- =============================================================
-- loans
create index idx_loans_user_id on public.loans(user_id);
create index idx_loans_is_closed on public.loans(is_closed) where is_closed = true;

-- loan_change_events
create index idx_loan_change_events_loan_month on public.loan_change_events(loan_id, effective_month);
create index idx_loan_change_events_user_id on public.loan_change_events(user_id);

-- simulations
create index idx_simulations_user_id on public.simulations(user_id);
create index idx_simulations_status on public.simulations(status);
create unique index ux_simulations_user_active on public.simulations(user_id) where is_active = true;
create index idx_simulations_stale on public.simulations(user_id) where stale = true;

-- simulation_loan_snapshots
create index idx_sim_loan_snapshots_simulation on public.simulation_loan_snapshots(simulation_id);
create index idx_sim_loan_snapshots_user on public.simulation_loan_snapshots(user_id);

-- monthly_execution_logs
create index idx_monthly_logs_user_month on public.monthly_execution_logs(user_id, month_start);
create index idx_monthly_logs_loan_month on public.monthly_execution_logs(loan_id, month_start);
create index idx_monthly_logs_payment_status on public.monthly_execution_logs(payment_status);
create index idx_monthly_logs_overpayment_status on public.monthly_execution_logs(overpayment_status);

-- simulation_history_metrics
create index idx_sim_history_user on public.simulation_history_metrics(user_id);

-- adherence_metrics (pk covers user_id)

-- =============================================================
-- 4. row level security enablement
-- =============================================================
alter table public.user_settings enable row level security;
alter table public.loans enable row level security;
alter table public.loan_change_events enable row level security;
alter table public.simulations enable row level security;
alter table public.simulation_loan_snapshots enable row level security;
alter table public.monthly_execution_logs enable row level security;
alter table public.simulation_history_metrics enable row level security;
alter table public.adherence_metrics enable row level security;

-- =============================================================
-- 5. privilege adjustments (optional restrictions for service-managed tables)
-- =============================================================
-- revoke default public privileges (select/insert/update/delete) on snapshot & history metrics tables.
-- this is a defensive hardening measure; service role (via supabase backend) bypasses rls.
revoke all on public.simulation_loan_snapshots from public;
revoke all on public.simulation_history_metrics from public;

-- =============================================================
-- 6. rls policies
-- =============================================================
-- policy conventions:
--   - one policy per (role, command) for clarity and auditable intent.
--   - anon role is explicitly denied (using (false)); prevents accidental exposure.
--   - authenticated role restricted to rows where user_id = auth.uid().
--   - insert/update/delete require both using and with check clauses to enforce ownership.
--   - service role bypasses rls automatically; if broader system tasks needed, rely on service key.

-- helper comment: no generic policy re-use; verbosity favors security review.

-- ---------------------- user_settings ----------------------
create policy user_settings_select_authenticated on public.user_settings for select to authenticated using (user_id = auth.uid());
create policy user_settings_select_anon on public.user_settings for select to anon using (false);
create policy user_settings_insert_authenticated on public.user_settings for insert to authenticated with check (user_id = auth.uid());
create policy user_settings_insert_anon on public.user_settings for insert to anon with check (false);
create policy user_settings_update_authenticated on public.user_settings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_settings_update_anon on public.user_settings for update to anon using (false) with check (false);
create policy user_settings_delete_authenticated on public.user_settings for delete to authenticated using (user_id = auth.uid());
create policy user_settings_delete_anon on public.user_settings for delete to anon using (false);

-- ---------------------- loans ----------------------
-- create policy loans_select_authenticated on public.loans for select to authenticated using (user_id = auth.uid());
-- create policy loans_select_anon on public.loans for select to anon using (false);
-- create policy loans_insert_authenticated on public.loans for insert to authenticated with check (user_id = auth.uid());
-- create policy loans_insert_anon on public.loans for insert to anon with check (false);
-- create policy loans_update_authenticated on public.loans for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- create policy loans_update_anon on public.loans for update to anon using (false) with check (false);
-- create policy loans_delete_authenticated on public.loans for delete to authenticated using (user_id = auth.uid());
-- create policy loans_delete_anon on public.loans for delete to anon using (false);

-- ---------------------- loan_change_events ----------------------
-- create policy loan_change_events_select_authenticated on public.loan_change_events for select to authenticated using (user_id = auth.uid());
-- create policy loan_change_events_select_anon on public.loan_change_events for select to anon using (false);
-- create policy loan_change_events_insert_authenticated on public.loan_change_events for insert to authenticated with check (user_id = auth.uid());
-- create policy loan_change_events_insert_anon on public.loan_change_events for insert to anon with check (false);
-- create policy loan_change_events_update_authenticated on public.loan_change_events for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- create policy loan_change_events_update_anon on public.loan_change_events for update to anon using (false) with check (false);
-- create policy loan_change_events_delete_authenticated on public.loan_change_events for delete to authenticated using (user_id = auth.uid());
-- create policy loan_change_events_delete_anon on public.loan_change_events for delete to anon using (false);

-- ---------------------- simulations ----------------------
-- create policy simulations_select_authenticated on public.simulations for select to authenticated using (user_id = auth.uid());
-- create policy simulations_select_anon on public.simulations for select to anon using (false);
-- create policy simulations_insert_authenticated on public.simulations for insert to authenticated with check (user_id = auth.uid());
-- create policy simulations_insert_anon on public.simulations for insert to anon with check (false);
-- create policy simulations_update_authenticated on public.simulations for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- create policy simulations_update_anon on public.simulations for update to anon using (false) with check (false);
-- create policy simulations_delete_authenticated on public.simulations for delete to authenticated using (user_id = auth.uid());
-- create policy simulations_delete_anon on public.simulations for delete to anon using (false);

-- ---------------------- simulation_loan_snapshots ----------------------
-- create policy simulation_loan_snapshots_select_authenticated on public.simulation_loan_snapshots for select to authenticated using (user_id = auth.uid());
-- create policy simulation_loan_snapshots_select_anon on public.simulation_loan_snapshots for select to anon using (false);
-- create policy simulation_loan_snapshots_insert_authenticated on public.simulation_loan_snapshots for insert to authenticated with check (user_id = auth.uid());
-- create policy simulation_loan_snapshots_insert_anon on public.simulation_loan_snapshots for insert to anon with check (false);
-- create policy simulation_loan_snapshots_update_authenticated on public.simulation_loan_snapshots for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- create policy simulation_loan_snapshots_update_anon on public.simulation_loan_snapshots for update to anon using (false) with check (false);
-- create policy simulation_loan_snapshots_delete_authenticated on public.simulation_loan_snapshots for delete to authenticated using (user_id = auth.uid());
-- create policy simulation_loan_snapshots_delete_anon on public.simulation_loan_snapshots for delete to anon using (false);

-- ---------------------- monthly_execution_logs ----------------------
-- create policy monthly_execution_logs_select_authenticated on public.monthly_execution_logs for select to authenticated using (user_id = auth.uid());
-- create policy monthly_execution_logs_select_anon on public.monthly_execution_logs for select to anon using (false);
-- create policy monthly_execution_logs_insert_authenticated on public.monthly_execution_logs for insert to authenticated with check (user_id = auth.uid());
-- create policy monthly_execution_logs_insert_anon on public.monthly_execution_logs for insert to anon with check (false);
-- create policy monthly_execution_logs_update_authenticated on public.monthly_execution_logs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- create policy monthly_execution_logs_update_anon on public.monthly_execution_logs for update to anon using (false) with check (false);
-- create policy monthly_execution_logs_delete_authenticated on public.monthly_execution_logs for delete to authenticated using (user_id = auth.uid());
-- create policy monthly_execution_logs_delete_anon on public.monthly_execution_logs for delete to anon using (false);

-- ---------------------- simulation_history_metrics ----------------------
-- create policy simulation_history_metrics_select_authenticated on public.simulation_history_metrics for select to authenticated using (user_id = auth.uid());
-- create policy simulation_history_metrics_select_anon on public.simulation_history_metrics for select to anon using (false);
-- create policy simulation_history_metrics_insert_authenticated on public.simulation_history_metrics for insert to authenticated with check (user_id = auth.uid());
-- create policy simulation_history_metrics_insert_anon on public.simulation_history_metrics for insert to anon with check (false);
-- create policy simulation_history_metrics_update_authenticated on public.simulation_history_metrics for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- create policy simulation_history_metrics_update_anon on public.simulation_history_metrics for update to anon using (false) with check (false);
-- create policy simulation_history_metrics_delete_authenticated on public.simulation_history_metrics for delete to authenticated using (user_id = auth.uid());
-- create policy simulation_history_metrics_delete_anon on public.simulation_history_metrics for delete to anon using (false);

-- ---------------------- adherence_metrics ----------------------
-- create policy adherence_metrics_select_authenticated on public.adherence_metrics for select to authenticated using (user_id = auth.uid());
-- create policy adherence_metrics_select_anon on public.adherence_metrics for select to anon using (false);
-- create policy adherence_metrics_insert_authenticated on public.adherence_metrics for insert to authenticated with check (user_id = auth.uid());
-- create policy adherence_metrics_insert_anon on public.adherence_metrics for insert to anon with check (false);
-- create policy adherence_metrics_update_authenticated on public.adherence_metrics for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- create policy adherence_metrics_update_anon on public.adherence_metrics for update to anon using (false) with check (false);
-- create policy adherence_metrics_delete_authenticated on public.adherence_metrics for delete to authenticated using (user_id = auth.uid());
-- create policy adherence_metrics_delete_anon on public.adherence_metrics for delete to anon using (false);

-- =============================================================
-- 7. post-migration validation suggestions (manual follow-up)
-- =============================================================
--   - run: select * from pg_indexes where schemaname='public' and tablename='simulations'; verify partial unique index.
--   - attempt anon access (without auth header) to confirm denial.
--   - test service role inserts into simulation_loan_snapshots & simulation_history_metrics.
-- end of migration
