# UI Architecture for NOSACZ

## 1. UI Structure Overview
- Application shell: Left sidebar navigation with top header. Primary routes: `/dashboard` (default for authenticated users), `/loans`, `/settings`, and `/wizard` (guarded; only when there is no active simulation). Auth pages live under `/auth/*`.
- Session & auth: httpOnly cookie sessions. UI mirrors minimal session state to `window.__session` via `GET /api/session`, refreshes on `visibilitychange`, and syncs across tabs with `BroadcastChannel('session')`. On 401, redirect to `/auth/signin` and clear mirrored state.
- Server state management: TanStack Query for API data; optimistic updates for monthly execution logs; selective invalidations on mutations. UI reads standardized error schema `{ code, message, fieldErrors?, requestId? }` and displays inline field errors + toasts with `requestId`.
- Performance & async: Lazy-load charts; cache dashboard queries for ~5 minutes; poll long-running simulations with modest backoff; cancel prior simulation on new run (US-047). Use streaming/islands for above-the-fold content.
- Accessibility & i18n: Keyboard navigable components, ARIA semantics for dialogs/forms, focus management on route change and modals. Text alternatives for charts (US-049). Currency and numbers formatted using `pl-PL` with PLN (US-048).
- Security: Same-origin requests; httpOnly cookies; optional CSRF header `X-CSRF-Token` if required via `GET /api/csrf`. Destructive actions require confirmation and `X-Client-Confirmation` header (API plan). Enforce user data isolation via backend RLS and per-request token verification.
- Observability: Propagate and render `X-Request-Id` on error UIs and toast “View details”.

## 2. View List

- Auth: Sign In (done)
  - Path: `/auth/signin`
  - Main purpose: Authenticate and establish a session.
  - Key information: Email, password; sign-up and reset links; error messages.
  - Key components: Form (email/password), Submit button, Link buttons, ErrorSummary, Toasts.
  - UX/accessibility/security:
    - Submit disabled during request; keyboard accessible; label+description for fields.
    - On 401 show error; on success redirect to `/dashboard`.
    - Never reveal whether email exists; show generic error.
  - API endpoints: `POST /auth/signin`, `GET /api/session`.
  - PRD stories: US-037, US-040.

- Auth: Sign Up (done)
  - Path: `/auth/signup`
  - Main purpose: Register a new user.
  - Key information: Email, password; minimal requirements per MVP.
  - Key components: Form, Submit button, Link to sign-in, ErrorSummary, Toasts.
  - UX/accessibility/security:
    - Inline error messages from `fieldErrors`.
    - Post-success direct sign-in or redirect to `/dashboard`.
  - API endpoints: `POST /auth/signup`, `GET /api/session`.
  - PRD stories: US-036.

- Auth: Reset Password
  - Path: `/auth/reset-password`
  - Main purpose: Trigger password reset email.
  - Key information: Email input, confirmation messaging.
  - Key components: Form, Submit button, Link to sign-in, ErrorSummary.
  - UX/accessibility/security:
    - Neutral confirmation copy; API may return 202 or 404 (MVP tolerance).
  - API endpoints: `POST /api/auth/reset-password`.
  - PRD stories: US-039.

- Dashboard (Active Simulation) (done)
  - Path: `/dashboard` (default after sign-in)
  - Main purpose: Present active simulation summary, per-loan metrics, current month actions, and graphs.
  - Key information:
    - Active simulation summary: strategy, goal, projected payoff, total interest saved.
    - Per-loan metrics: remaining principal, monthly payment, months remaining, progress, interest saved to date.
    - Current Month panel: per-loan scheduled payment and overpayment with statuses/actions.
    - Graphs: full timespan monthly remaining balances; interest vs interest saved (monthly breakdown).
    - Stale simulation banner + CTA to re-run when applicable.
  - Key components: OverviewCards, LoansTable/Cards, CurrentMonthPanel (row actions), BalancesChart, InterestVsSavedChart, SimulationStaleBanner, EmptyState CTA to `/wizard`.
  - UX/accessibility/security:
    - Empty state: show CTA to `/wizard` when no active simulation.
    - Row actions with optimistic updates and 10s undo for “Skip”.
    - Charts include accessible table/text summaries.
    - Read-only controls while simulation is running; show job status banner.
  - API endpoints: `GET /api/dashboard/overview`, `GET /api/simulations/active`, `PATCH /api/monthly-execution-logs/{logId}`.
  - PRD stories: US-023, US-024, US-029, US-030, US-031, US-032, US-033, US-034, US-035, US-027, US-028.

- Wizard (Run Simulation) (done)
  - Path: `/wizard` (guarded: visible only when there is no active simulation)
  - Main purpose: Guide user to select strategy and goal/parameters, then run a new simulation.
  - Key information:
    - Step 1: Strategy catalog (name/description) with selection.
    - Step 2: Goal selection (Fastest Payoff or Payment Reduction) and required parameters (threshold).
    - Read-only “Reinvest reduced payment” default from Settings with link to `/settings`.
    - Previews: current loans and user settings.
    - Post-submit: queued/running status with progress messaging; cancel option.
  - Key components: Stepper, StrategyList, GoalSelector, ThresholdInput, SettingsSummary, LoansPreview, Submit/Cancel controls, StatusBanner.
  - UX/accessibility/security:
    - Validate required fields (threshold > 0 if payment reduction goal).
    - On 409 (existing running job) offer cancel-then-retry.
    - After completion, redirect to `/dashboard`; optionally prompt “Activate” if not auto-activated.
  - API endpoints: `GET /api/strategies`, `POST /api/simulations`, `GET /api/simulations/{id}`, `POST /api/simulations/{id}/cancel`, `POST /api/simulations/{id}/activate` (if needed), `GET /api/loans`, `GET /api/user-settings`.
  - PRD stories: US-009, US-013, US-014, US-015, US-010, US-011, US-012, US-016, US-018, US-019 (optional), US-020 (optional), US-047.

- Loans (List + Sidebar Editor) (done)
  - Path: `/loans`
  - Main purpose: Manage loans with simple list and a sidebar editor using explicit Save/Cancel.
  - Key information:
    - Loans list: name/identifier, remaining balance, annual rate, term, start month, status (open/closed).
    - Sidebar: full editable fields except IDs. Quick remaining balance edit support.
    - Indicators: “simulation stale” banner after save/delete.
  - Key components: LoansList, LoanRowActions (Edit/Delete), LoanEditorSidebar (form), ConfirmDialog (destructive), EmptyState.
  - UX/accessibility/security:
    - Explicit Save/Cancel; validations with inline field errors.
    - Deleting or editing key fields shows stale simulation prompt.
    - Rate changes capture effective date (current vs next month) with clear helper text.
  - API endpoints: `GET /api/loans`, `POST /api/loans`, `PUT /api/loans/{loanId}`, `PATCH /api/loans/{loanId}`, `DELETE /api/loans/{loanId}`, `GET /api/loan-change-events` (optional).
  - PRD stories: US-001, US-002, US-003, US-004, US-005, US-006, US-025, US-021.

- Settings (User Defaults) (done)
  - Path: `/settings`
  - Main purpose: Configure monthly overpayment limit and “reinvest reduced payments” default.
  - Key information: Current values, last updated time; validation guidance.
  - Key components: SettingsForm (monthlyOverpaymentLimit, reinvestReducedPayments), Save/Cancel, SuccessToast.
  - UX/accessibility/security:
    - Non-negative limit validation; clear copy for reinvest semantics.
    - Saving sets simulations to stale; show banner with CTA to re-run.
  - API endpoints: `GET /api/user-settings`, `PUT /api/user-settings`.
  - PRD stories: US-007, US-008, US-011, US-012, US-021.

- Errors & Status Pages
  - Paths: `/404`, inline error boundaries
  - Main purpose: Communicate missing content or permission issues.
  - Key information: Error code, friendly message, `requestId` when present, navigation options.
  - Key components: ErrorBoundary, RequestIdDetails, Retry/Back buttons.
  - UX/accessibility/security: Never expose sensitive details; focus returns to main landmark; keyboard accessible controls.
  - API interactions: Surfaces errors from other views.
  - PRD stories: US-043, US-046.

## 3. User Journey Map

- Onboarding and first simulation
  1. Sign up → sign in (US-036, US-037).
  2. Land on `/dashboard` → empty state CTA to `/wizard` (no active simulation).
  3. `/wizard` Step 1: Choose strategy from registry (US-009, US-010).
  4. `/wizard` Step 2: Choose goal (US-013 or US-014), enter threshold if needed (US-015); read-only reinvest default from Settings (US-011/US-012).
  5. Submit → `POST /api/simulations`; handle 409 by offering cancel (US-047). Show queued/running status (US-018).
  6. On completion → redirect to `/dashboard`, show schedule/metrics/graphs (US-017, US-034, US-035). Optionally “Activate” if not auto-activated (US-023).
  7. Current Month panel: mark payment done, overpayment executed, or skip (US-030–US-032); skipping triggers stale simulation prompt (US-021).

- Ongoing use
  - Edit loans in `/loans` (US-003–US-006, US-025) → stale banner shown (US-021) → re-run simulation via `/wizard`.
  - Adjust settings `/settings` (US-007, US-008) → stale banner (US-021) → re-run simulation.
  - Dashboard reflects payoffs and reallocations; closed loans visually distinct (US-026, US-027).
  - Backfill missed months via Current Month actions (US-033); graphs and metrics update after re-simulation (US-035).

- Error and edge handling
  - Session expiry prompts re-login (US-040).
  - Validation errors shown inline with field-level mapping (US-043); show `requestId` for support.
  - Concurrency: If ETag/If-Match is supported, forms send headers; on mismatch show retry guidance.

## 4. Layout and Navigation Structure

- Sidebar (persistent):
  - Dashboard
  - Loans
  - Settings
  - Sign out (in header user menu)
- Header: User email, environment/status badge, global toasts. “Run Simulation” CTA appears only when there is no active simulation (otherwise `/wizard` is hidden/guarded).
- Route guards:
  - AuthGuard: redirect unauthenticated users to `/auth/signin`.
  - WizardGuard: allow `/wizard` only when `GET /api/simulations/active` returns 404.
- Global banners:
  - Simulation stale banner with CTA to re-run (visible in Dashboard/Loans/Settings).
  - Simulation running banner with cancel/retry controls.
- Navigation patterns: Deep-linkable views; URL reflects state (e.g., `?loanId=` to open sidebar editor).

## 5. Key Components

- AppShell: Layout with Sidebar + Header + Content.
- AuthForms: SignInForm, SignUpForm, ResetPasswordForm with standardized error handling and `requestId` surfacing.
- Dashboard:
  - OverviewCards: strategy, goal, payoff projection, total interest saved.
  - LoansTable/Cards: per-loan metrics and progress.
  - CurrentMonthPanel: per-loan rows with actions (Paid/Executed/Skip) and optimistic updates + undo.
  - BalancesChart: remaining balances over full timespan; current month highlighted; accessible table alternative.
  - InterestVsSavedChart: monthly interest vs saved; accessible text summary.
  - SimulationStaleBanner & SimulationStatusBanner.
- Wizard:
  - Stepper, StrategyList (registry), GoalSelector, ThresholdInput, SettingsSummary, LoansPreview, Submit/Cancel, StatusBanner.
- Loans:
  - LoansList, LoanRowActions, LoanEditorSidebar (Save/Cancel), ConfirmDialog (delete), EffectiveDatePicker for interest changes.
- Settings:
  - SettingsForm (monthlyOverpaymentLimit, reinvestReducedPayments), Save/Cancel, SuccessToast.
- Shared:
  - Fetch wrapper with standardized error mapping; Toast system; ErrorBoundary; ConfirmDialog; Skeletons; Accessible FormField components; RequestIdDetails.

---

Appendix: Compatibility and Mapping

- API compatibility summary (per view)
  - Auth: `POST /auth/signup`, `POST /auth/signin`, `POST /api/auth/reset-password`, `GET /api/session`.
  - Dashboard: `GET /api/dashboard/overview`, `GET /api/simulations/active`, `PATCH /api/monthly-execution-logs/{logId}`.
  - Wizard: `GET /api/strategies`, `POST /api/simulations`, `GET /api/simulations/{id}`, `POST /api/simulations/{id}/cancel`, `POST /api/simulations/{id}/activate`, `GET /api/loans`, `GET /api/user-settings`.
  - Loans: `GET /api/loans`, `POST /api/loans`, `PUT /api/loans/{loanId}`, `PATCH /api/loans/{loanId}`, `DELETE /api/loans/{loanId}`, `GET /api/loan-change-events`.
  - Settings: `GET /api/user-settings`, `PUT /api/user-settings`.

- PRD user stories → UI elements
  - Loan Management: US-001/002 add loan → `/loans` Add + Sidebar; US-003 edit → Save/Cancel; US-004 delete → ConfirmDialog; US-005 balance adjust → Quick edit/Sidebar; US-006/025 rate change/effective date → Sidebar; US-026/027 payoff/dashboard → Dashboard reallocation and status.
  - Overpayment & Strategies: US-007/008 limit → `/settings`; US-009 strategies list → `/wizard` Step 1; US-010 apply strategy → Wizard submit; US-011/012 reinvest toggle → `/settings` default + read-only in wizard.
  - Goals & Simulation: US-013/014 goal select → Wizard Step 2; US-015 threshold → ThresholdInput; US-016 single active → activation flow; US-017 schedule output → Dashboard; US-018 async → Wizard StatusBanner; US-019/020 history/compare → deferred; US-021 stale → global banner; US-022 ad hoc overpayment → `/loans` PATCH; US-028 baseline → Dashboard tooltip; US-047 limit parallel → cancel-and-retry.
  - Dashboard & Updates: US-023 activate → post-run action; US-024 per-loan metrics → LoansTable/Cards; US-029 monthly schedule → CurrentMonthPanel; US-030/031/032 actions → row actions; US-033 backfill → logs/actions; US-034 interest saved → overview/breakdown; US-035 graphs → charts with alternatives; US-046 confirmations → ConfirmDialog.
  - Auth & Access: US-036/037/038/039 register/login/logout/change password → Auth pages/user menu; US-040 session expiry → global 401 handling; US-041 data isolation → enforced server-side; UI surfaces 403/404.
  - Data & Integrity: US-042 persist → via API; US-043 validate → inline errors; US-044 sanitize → safe display; US-045 atomic update → consistent feedback.
  - Accessibility: US-048 contrast → design tokens; US-049 text alternatives → chart tables.
  - Metrics & Analytics: US-050–US-053 tracking → backend; dashboard may surface adherence aggregates.

- Edge cases covered
  - No loans and/or no settings → `/dashboard` empty → CTA to `/wizard` and links to `/loans` and `/settings`.
  - Simulation running → Status banner; disable duplicate runs; cancel available.
  - Stale simulation → Persistent banner with CTA to re-run.
  - Closed loans → visually distinct; excluded from future allocations.
  - Concurrency conflicts (ETag) → prompt to refresh and retry.
  - Duplicate monthly log entry → inline error with guidance.
  - Session expired mid-action → save-safe handling and redirect to sign-in.


