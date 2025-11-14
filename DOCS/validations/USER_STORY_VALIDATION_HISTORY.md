jsmieszek: You are experienced senior software engineer who is always very aware of potential issues with DB integration and endpoints specification.

Based on PRD.md, DB_SCHEMA.md, API-PLAN.md i want you to plan implementation of a concrete user story (below). I want you to focus purely on data flow and validity of suggested implementation. implementation has to be in form of block schema that will present it without neccesity to dig into pure code. I want to have description of:
- endpoint used from the schema
- DB tables that will be affected by each call
- if applicable, DB tables from which data will be retrieved

The story is:
user sets up his global preferences, adds two loans and then runs simulation. After that user enters dashboard to preview the simulation

GitHub Copilot: Block schema for the story:

````text
[1] Configure Preferences
  Endpoint: PUT /api/user-settings
  Writes: user_settings (upsert user row)
  Reads: auth.users (RLS validation), optional existing user_settings for optimistic checks

[2] Create Loan A
  Endpoint: POST /api/loans
  Writes: loans (new loan row)
  Reads: auth.users (RLS), optional user_settings for validation context

[3] Create Loan B
  Endpoint: POST /api/loans
  Writes: loans (second loan row)
  Reads: auth.users (RLS)

[4] Trigger Simulation
  Endpoint: POST /api/simulations
  Writes (request phase): simulations (queued record with status=running, is_active=false, stale=false)
  Reads (request phase): auth.users (RLS), user_settings (to capture limit, reinvest flag), loans (to snapshot eligible loans)
  Writes (background worker):
    - simulation_loan_snapshots (one per included loan)
    - simulations (updates status→completed, computed metrics: projected_months_to_payoff, totals, etc.)
    - simulation_history_metrics (optional snapshot insert)
    - adherence_metrics (no change unless recalculated elsewhere)
  Reads (background worker): loans, loan_change_events (for rate adjustments), monthly_execution_logs (for adherence context), existing simulations (to deactivate running ones if policy requires)

[5] View Dashboard
  Endpoint: GET /api/dashboard/overview
  Reads:
    - simulations (active or most recent complete for overview)
    - loans (remaining balances, status)
    - monthly_execution_logs (current month + history for adherence/progress)
    - simulation_loan_snapshots (baseline comparisons if required)
    - simulation_history_metrics (trend data)
    - adherence_metrics (aggregate counters)
  Writes: none
````