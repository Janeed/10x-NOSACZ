# View Implementation Plan: Dashboard (Active Simulation)

## 1. Overview
The Dashboard view presents the currently active simulation (or an empty state when none), surfaces per-loan metrics, current month execution actions, cumulative and per-month interest savings, adherence indicators, and two graphs (monthly remaining balances & interest vs interest saved). It enables users to mark payment/overpayment statuses, handle skipped overpayments with undo and re-simulation prompts, and visually distinguish closed loans. It reacts to simulation stale/running states and supports accessible chart alternatives.

## 2. View Routing
Path: `/dashboard` (default post-auth redirect). Guarded by `AuthGuard`. If no active simulation (404 from `GET /api/dashboard/overview` with `activeSimulation=null` or 404 active simulation endpoint), show Empty State CTA to `/wizard`.

## 3. Component Structure
```
DashboardPage (island)
  ├─ DashboardDataProvider (queries + context)
  │   ├─ SimulationStatusBanner
  │   ├─ SimulationStaleBanner
  │   ├─ EmptyStateCTA (conditional when activeSimulation === null)
  │   ├─ OverviewCards
  │   │    ├─ OverviewCard (Strategy)
  │   │    ├─ OverviewCard (Goal)
  │   │    ├─ OverviewCard (Projected Payoff / Months Remaining)
  │   │    ├─ OverviewCard (Total Interest Saved)
  │   ├─ LoansSection
  │   │    ├─ LoansTable (responsive -> Cards on narrow)
  │   │    │    ├─ LoanRow / LoanCard
  │   │    │         ├─ LoanProgressBar
  │   │    │         └─ LoanStatusBadge
  │   ├─ CurrentMonthPanel
  │   │    ├─ CurrentMonthRow
  │   │    │    ├─ PaymentStatusControl
  │   │    │    ├─ OverpaymentStatusControl
  │   │    │    └─ SkipUndoControls
  │   ├─ ChartsSection
  │   │    ├─ BalancesChart
  │   │    │    └─ BalancesAccessibleTable
  │   │    ├─ InterestVsSavedChart
  │   │    │    └─ InterestAccessibleTable
  │   ├─ AdherenceSummary (optional include)
  │   ├─ ToastHost (already exists globally)
  │   ├─ ConfirmSkipDialog (portal)
  │   └─ ErrorBoundary (wrapper)
  └─ LoadingSkeletons (while initial queries load)
```

## 4. Component Details
### DashboardPage
- Description: Top-level Astro/React island entry for `/dashboard`. Mounts React tree and triggers TanStack Query providers.
- Main elements: `<main>` landmark, sections for overview, loans, current month, charts.
- Interactions: None directly; delegates to children.
- Validation: Ensures authenticated (guard before render). Redirect logic if 401.
- Types: Uses `DashboardOverviewDto` & `ActiveSimulationDashboardDto` via provider.
- Props: None (route-level).

### DashboardDataProvider
- Description: Fetches data (`GET /api/dashboard/overview?include=graphs,adherence` optionally) and active simulation details (`GET /api/simulations/active`) combining into context. Provides loading/error states, cached for 5m.
- Elements: React context provider.
- Interactions: Refetch on visibilitychange, on successful mutation (execution log patch), on simulation stale cleared.
- Validation: Handles 404 (no active simulation) gracefully.
- Types: `DashboardOverviewDto`, `ActiveSimulationDashboardDto`, `DashboardContextValue` (new).
- Props: `{ children: ReactNode }`.

### SimulationStatusBanner
- Description: Shows running/cancelled/queued states for active simulation; disable actionable controls while running.
- Elements: Banner with icon, status text, optional cancel button (if API exposes cancel).
- Interactions: Cancel simulation (pending future endpoint reuse); triggers toast + refetch.
- Validation: Only render if `status !== 'COMPLETED' && activeSimulation`.
- Types: `ActiveSimulationSummary`.
- Props: `{ simulation: ActiveSimulationSummary | null }`.

### SimulationStaleBanner
- Description: Visible when `activeSimulation?.stale === true`; CTA button to `/wizard` or re-run panel.
- Elements: Banner with message, button.
- Interactions: Navigate to wizard.
- Validation: None beyond stale flag.
- Types: `ActiveSimulationSummary`.
- Props: `{ stale: boolean }`.

### EmptyStateCTA
- Description: Shown when `activeSimulation === null`; encourages creating simulation (link to `/wizard`).
- Elements: Card with explanation, primary button.
- Interactions: Navigate.
- Validation: None.
- Types: None (conditional render only).
- Props: None.

### OverviewCards & OverviewCard
- Description: Grid of summary metrics from active simulation.
- Elements: `<section>` containing cards (Strategy, Goal, Projected Payoff, Total Interest Saved; plus optional Months To Payoff).
- Interactions: None (read-only).
- Validation: If simulation running, show spinner for projected metrics not yet computed.
- Types: `ActiveSimulationSummary`, `OverviewCardVM` (new).
- Props (OverviewCards): `{ simulation: ActiveSimulationSummary | null }`.
- Props (OverviewCard): `{ title: string; value: ReactNode; icon?: ReactNode; tooltip?: string; status?: 'loading'|'ok'; }`.

### LoansSection / LoansTable / LoanRow / LoanCard
- Description: Table or responsive cards listing per-loan metrics (remaining balance, monthly payment, interest saved, months remaining, progress, status).
- Elements: `<table>` with header columns; each row with progress bar and status badge. On mobile, stacked cards.
- Interactions: Row hover; click might future-link to `/loans?loanId=...` (optional subtle link). No edits here.
- Validation: Distinguish closed loans visually (greyed progress bar = 100%, badge "Closed").
- Types: `DashboardOverviewLoanItem`, `DashboardLoanVM` (new).
- Props (LoansSection): `{ loans: DashboardOverviewLoanItem[] }`.
- Props (LoansTable): same.
- Props (LoanRow): `{ loan: DashboardLoanVM }`.

### LoanProgressBar
- Description: Visual progress of principal paid vs original principal.
- Elements: `<div role="progressbar">` with ARIA attributes labeling percentage.
- Interactions: None.
- Validation: 0–100 range clamp.
- Types: uses numeric fields.
- Props: `{ progress: number; isClosed: boolean }`.

### CurrentMonthPanel
- Description: Displays current month schedule entries with action controls for payment & overpayment statuses + skip with undo.
- Elements: `<section>` with table listing loans and scheduled amounts; status controls.
- Interactions: Mark payment done, mark overpayment executed, mark skipped (requires ConfirmSkipDialog), undo skip (within 10s), backfill payment (if missing).
- Validation: Prevent executing actions if simulation running or stale not re-run yet (except viewing). Disallow skip if already executed or closed.
- Types: `DashboardOverviewCurrentMonth`, `CurrentMonthEntryVM` (new), `MonthlyExecutionLogDto` (partial), `PatchMonthlyExecutionLogCommand`.
- Props: `{ currentMonth: DashboardOverviewCurrentMonth | null }`.

### CurrentMonthRow (with PaymentStatusControl / OverpaymentStatusControl / SkipUndoControls)
- Description: Row-level UI mapping statuses to buttons or badges.
- Elements: Buttons: "Mark Paid", "Execute Overpayment", "Skip"; Undo button inside toast after skip.
- Interactions: On button click -> optimistic mutation of `PATCH /api/monthly-execution-logs/{logId}`; on undo -> revert prior statuses.
- Validation: Transition rules:
  - PaymentStatus: PENDING → PAID or BACKFILLED; cannot revert once PAID unless within undo window (optional future scope).
  - OverpaymentStatus: PENDING → EXECUTED or SKIPPED; after SKIPPED triggers stale simulation flag.
  - Skip requires confirmation dialog.
- Types: enumerations `PaymentStatus`, `OverpaymentStatus`.
- Props: `{ entry: CurrentMonthEntryVM; onStatusChange: (update) => void }`.

### ConfirmSkipDialog
- Description: Modal dialog confirming skip action.
- Elements: Accessible dialog with focus trap, text, confirm/cancel.
- Interactions: Confirm triggers mutation; Cancel closes.
- Validation: None beyond accessible requirements.
- Types: None.
- Props: `{ open: boolean; onConfirm: () => void; onCancel: () => void }`.

### BalancesChart + BalancesAccessibleTable
- Description: Line chart of total remaining balance over months; accessible table alternative.
- Elements: Canvas/SVG (chart lib), summary caption, toggle for table view.
- Interactions: Hover tooltips; toggle accessible table; responsive resizing.
- Validation: Points sorted by month; handle empty dataset.
- Types: `DashboardOverviewGraphMonthlyBalancePoint`.
- Props: `{ data: DashboardOverviewGraphMonthlyBalancePoint[] }`.

### InterestVsSavedChart + InterestAccessibleTable
- Description: Bar/area chart overlay: interest vs interest saved monthly.
- Elements: Chart with two series; accessible table.
- Interactions: Hover, focusable points (keyboard), table toggle.
- Validation: Sum interestSaved ≤ interest baseline for each month.
- Types: `DashboardOverviewGraphInterestPoint`.
- Props: `{ data: DashboardOverviewGraphInterestPoint[] }`.

### AdherenceSummary
- Description: Shows adherence metrics (counts + ratio).
- Elements: Card with executed vs skipped count, ratio badge.
- Interactions: Tooltip explaining ratio formula.
- Validation: Ratio displayed with one decimal; avoid division by zero.
- Types: `DashboardOverviewAdherence`.
- Props: `{ adherence?: DashboardOverviewAdherence }`.

### ToastHost (existing) / UndoToast
- Description: Global toast area; UndoToast ephemeral after skip action.
- Elements: Toast message "Overpayment skipped" + Undo button (10s timer).
- Interactions: Undo triggers restore mutation.
- Validation: Timer clears automatically.
- Types: internal ephemeral state.
- Props: Provided by context.

### ErrorBoundary
- Description: Catches rendering errors inside dashboard subtree; shows fallback with requestId if available.
- Elements: Fallback UI.
- Interactions: Retry button (refetch queries).
- Validation: None.
- Types: `ErrorBoundaryProps`.

### LoadingSkeletons
- Description: Placeholder skeletons while queries are loading.
- Elements: Skeleton components using Tailwind animation.
- Interactions: None.
- Validation: None.
- Types: None.

## 5. Types
New view-specific types (augment existing DTOs):
- `DashboardContextValue`:
  - `overview: DashboardOverviewDto | undefined`
  - `activeSimulation: ActiveSimulationSummary | null`
  - `isLoading: boolean`
  - `error: Error | null`
  - `refetch: () => void`
- `OverviewCardVM`:
  - `title: string`
  - `value: string | number | ReactNode`
  - `tooltip?: string`
  - `status?: 'loading' | 'ok'`
- `DashboardLoanVM`:
  - `loanId: string`
  - `remainingBalance: number`
  - `monthlyPayment: number`
  - `interestSavedToDate: number`
  - `monthsRemaining: number`
  - `progressPercent: number` (0–100)
  - `isClosed: boolean`
- `CurrentMonthEntryVM`:
  - `logId: string` (from execution log or synthetic composite key loanId+month)
  - `loanId: string`
  - `scheduledPayment: number`
  - `scheduledOverpayment: number`
  - `paymentStatus: PaymentStatus`
  - `overpaymentStatus: OverpaymentStatus`
  - `isClosed: boolean`
  - `canMarkPaid: boolean`
  - `canExecuteOverpayment: boolean`
  - `canSkip: boolean`
- `MutationResult`:
  - `previous: CurrentMonthEntryVM`
  - `updated: CurrentMonthEntryVM`
  - `requestId?: string`
- `ChartBalancePointVM` maps `DashboardOverviewGraphMonthlyBalancePoint` direct.
- `ChartInterestPointVM` maps `DashboardOverviewGraphInterestPoint` direct.

## 6. State Management
- TanStack Query Keys:
  - `['dashboard','overview',{include:['graphs','adherence']}]`
  - `['simulations','active']`
- Query Options: `staleTime: 5 * 60 * 1000`, `refetchOnWindowFocus: false` (custom visibilitychange handler), `retry: 1`.
- Local Component State:
  - `showAccessibleTableBalances: boolean`
  - `showAccessibleTableInterest: boolean`
  - `pendingUndo: { logId: string; timeoutId: number } | null`
  - `confirmSkipLogId: string | null`
- Hooks:
  - `useDashboardData()` returns `DashboardContextValue`.
  - `useExecutionLogMutations()` provides mutation functions with optimistic update logic & undo support.
  - `useVisibilityRefetch()` attaches `visibilitychange` listener to refetch overview query.
- Optimistic Updates:
  - On skip: update entry statuses locally immediately, show undo toast, revert on undo or allow natural reconciliation on server response.

## 7. API Integration
Endpoints used:
1. `GET /api/dashboard/overview?include=graphs,adherence`
   - Response: `DashboardOverviewDto`.
   - Include handling: `parseInclude` on server expects comma-separated list; ensure encoding.
2. `GET /api/simulations/active`
   - Response: `ActiveSimulationDashboardDto` (superset of summary including current month schedule; may overlap with overview; treat activeSimulation from overview as source of metrics, fallback to this endpoint for schedule if overview returns null schedule).
3. `PATCH /api/monthly-execution-logs/{logId}`
   - Request: `PatchMonthlyExecutionLogCommand` (subset of statuses & timestamps).
   - Response: `MonthlyExecutionLogDto`.
Request Flow:
- Initial mount: fire parallel queries (overview + active). Merge results: prefer overview's `currentMonth` if present; else derive from active.
- Mutation Flow:
  - `markPaymentPaid(logId)` -> PATCH `{ paymentStatus: 'PAID', paymentExecutedAt: now }`.
  - `markOverpaymentExecuted(logId, actualAmount?)` -> PATCH `{ overpaymentStatus: 'EXECUTED', overpaymentExecutedAt: now, actualOverpaymentAmount: actualAmount || scheduled }`.
  - `markOverpaymentSkipped(logId)` -> PATCH `{ overpaymentStatus: 'SKIPPED', reasonCode: 'USER_SKIPPED' }`.
  - Undo skip -> PATCH revert to `{ overpaymentStatus: 'PENDING', reasonCode: null }`.
Caching & Invalidation:
- On any successful execution log mutation: invalidate `['dashboard','overview']` & `['simulations','active']` after optimistic update.
- If overpayment skipped: also surface stale banner; optionally mark simulation stale locally until backend recomputes.
Headers: propagate `X-Request-Id` when provided; include `credentials: 'same-origin'`.

## 8. User Interactions
- View dashboard: Data loads; if no simulation -> EmptyState CTA.
- Mark payment paid: Button click triggers optimistic status change, disabled while mutation in flight. Success: toast "Payment marked".
- Mark overpayment executed: Similar flow; may collect actual amount (future enhancement); toast.
- Skip overpayment: Opens ConfirmSkipDialog; confirm triggers optimistic skip + Undo toast with 10s countdown.
- Undo skip: Reverts status; hides stale banner if skip was only stale trigger (re-fetch to confirm).
- Hover chart points: Tooltip shows month & value; accessible via keyboard focus.
- Toggle accessible table: Replaces chart with table view (maintain data order, caption summarizing series).
- Visibility change: If tab becomes visible & data older than `staleTime` -> refetch.
- Encounter error (network/API): Show inline error component with retry button.

## 9. Conditions and Validation
- Auth required: If any fetch returns 401 -> redirect to `/auth/signin`.
- Active simulation presence: `overview.activeSimulation === null` => show EmptyStateCTA.
- Simulation stale: `activeSimulation?.stale` => show stale banner, disable action buttons THAT trigger long-term changes? (Payments allowed; skip still allowed but keeps stale state).
- Simulation running: `activeSimulation.status === 'RUNNING'| 'QUEUED'` => disable mutation buttons to prevent inconsistent state.
- Loan closed: Entry actions disabled; row styled as closed.
- Skip allowed only when `overpaymentStatus === 'PENDING'`.
- Undo window: 10s after skip; tracked via timestamp; outside window no undo button.
- Progress percent: Clamp to [0,100]; compute as `(originalPrincipal - remainingBalance)/originalPrincipal *100` (need originalPrincipal—if not in overview, may derive from snapshots or supplement query; assumption: provided via `progress` already).
- Chart data presence: Render fallback message if arrays empty or undefined.

## 10. Error Handling
Error categories:
- Network/API error (fetch fail): Show ErrorBoundary fallback; retry refetch.
- 404 Active Simulation: Convert to empty state (not a hard error).
- 422/Validation (PATCH): Show field-level or toast summarizing; revert optimistic change.
- 409 Concurrency (if statuses already updated server-side): Refetch & show info toast "Status already updated".
- 500 Internal: Display toast with `requestId` for support; keep previous UI state.
- Optimistic failure: Use stored `previous` state in mutation context to rollback.
- Graph data missing: Show placeholder card explaining unavailable metrics.
Accessibility errors: Provide `aria-live="polite"` region for toasts.

## 11. Implementation Steps
1. Create directory structure: `src/components/dashboard/` with subfolders (`overview`, `loans`, `currentMonth`, `charts`, `adherence`).
2. Define `types/dashboard.ts` with new ViewModel types & context interface.
3. Implement `DashboardDataProvider`: queries, merging logic, context export + hooks.
4. Add `useDashboardData` & `useExecutionLogMutations` hooks (in `src/lib/hooks/`). Include optimistic update & undo management.
5. Build `SimulationStatusBanner` & `SimulationStaleBanner` components.
6. Implement `EmptyStateCTA` with navigation link to `/wizard` (use existing button component).
7. Implement `OverviewCards` & generic `OverviewCard` with status loading states.
8. Build `LoansTable` with responsive design (Tailwind breakpoints) + `LoanRow`, `LoanProgressBar`, `LoanStatusBadge`.
9. Implement `CurrentMonthPanel`, `CurrentMonthRow`, and status controls; integrate mutation hook.
10. Add `ConfirmSkipDialog` (shadcn/ui dialog primitives) with focus management.
11. Integrate undo toast logic into global `ToastHost` (or create local ephemeral component hooking into existing system).
12. Implement `BalancesChart` & `InterestVsSavedChart` using chosen chart library (e.g. lightweight SVG or `recharts` if allowed—if not, custom). Provide accessible table toggles.
13. Implement `BalancesAccessibleTable` & `InterestAccessibleTable` with semantic `<table>` & captions.
14. Add `AdherenceSummary` card conditional on overview.adherence.
15. Add loading skeleton components for each section; display while queries pending.
16. Wire error handling: wrap main sections in `ErrorBoundary`; show fallback with retry calling `refetch()`.
17. Implement visibility refetch hook.
18. Add optimistic mutation + undo logic (context storing previous entry; set timeout to auto-clear undo window).
19. Ensure disabled states based on simulation running/stale conditions across controls.
20. Add ARIA attributes to progress bars, charts (role="img" with aria-label), dialog, and live region for toasts.
21. Write unit tests for view model mapping & mutation logic (if test harness available). Include edge: skip -> undo sequence.
22. Manual QA scenarios: No simulation, stale simulation, running simulation, closed loan, skip overpayment.
23. Performance check: Ensure queries cached; charts lazy-loaded below-the-fold (dynamic import with suspense).
24. Final review: Cross-reference PRD user stories (US-023..US-035, US-027, US-028) to confirm coverage; add any missing notes in code comments.
25. Update `README.md` (optional) with dashboard usage summary.

---
Assumptions: Enumerated status values exist and align with server; original principal available for progress already (if not, extend DTO). All PATCH mutations authorized. Chart library selection consistent with tech stack guidelines.
