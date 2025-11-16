# View Implementation Plan Run Simulation Wizard

## 1. Overview
The Run Simulation Wizard (`/wizard`) guides a user (who currently has no active simulation) through selecting a repayment strategy and goal configuration, validating required inputs, and triggering an asynchronous simulation job. It surfaces strategy descriptions, goal modes (Fastest Payoff vs Payment Reduction), an optional payment reduction threshold, the user’s current settings (overpayment limit, reinvest toggle), a loan preview, and submission status with cancellation/retry for concurrency conflicts. Upon completion the user is redirected to the dashboard and may activate the simulation if not auto-activated.

## 2. View Routing
- Route Path: `/wizard`
- Guard Conditions:
  - Only accessible if there is no active simulation OR an active simulation exists but is flagged stale and user opts to start a new one (business decision: default block when active unless stale; prompt redirect to dashboard).
  - Requires authenticated session.
- Navigation Outcomes:
  - Successful submission → poll until completed → redirect `/dashboard` (auto-activation or show activation prompt via follow-up API call `POST /api/simulations/{id}/activate`).
  - Cancellation returns user to `/dashboard` or stays in wizard with reset state.

## 3. Component Structure
```
WizardPage
  ├─ WizardStepper
  ├─ StrategyList (Step 1)
  ├─ GoalSelector (Step 2)
  │    └─ ThresholdInput (conditional for payment reduction)
  ├─ SettingsSummary (read-only; link to /settings)
  ├─ LoansPreview
  ├─ SubmitControls
  │    ├─ Primary Submit Button
  │    └─ Cancel Button (during running state)
  └─ StatusBanner (queued/running/cancelled/completed/error/conflict)
```
Supporting Hooks/Util:
- `useStrategies()`
- `useUserSettings()`
- `useLoansPreview()`
- `useSimulationWizard()` (core state + validation + submit)
- `useSimulationPolling(simulationId)` (status polling, cancellation handling)

## 4. Component Details
### WizardPage
- Description: Container page orchestrating wizard steps, data fetching, validation, and submission flow.
- Main elements: layout wrapper (`<main>`), header, step content region, side panels (SettingsSummary, LoansPreview), footer SubmitControls, StatusBanner above or below content.
- Handled interactions: step navigation (next/back), submit, cancel, retry on conflict, redirect after completion.
- Validation: orchestrates aggregated validation from child components before enabling submit (strategy selected, goal selected, threshold > 0 when payment reduction goal).
- Types: `WizardState`, `StrategyOptionVM`, `GoalSelectionState`, `ThresholdFieldState`, `SimulationSubmitResult`, `SimulationStatusVM`.
- Props: none (page-level), internal composition.

### WizardStepper
- Description: Visual progress indicator and navigation control between steps (Strategy, Goal & Threshold, Review & Submit).
- Main elements: list of step indicators (buttons or non-focusable markers), accessible labeling, current step highlight.
- Handled interactions: click step (if prior step valid), keyboard navigation (arrow keys), optional next/back buttons.
- Validation: blocks navigation to forward steps unless previous step valid (Strategy selected; Goal chosen + threshold valid if needed).
- Types: `WizardStep` enum, `WizardNavigationState`.
- Props: `currentStep: WizardStep`, `canGoToStep(step): boolean`, `onStepChange(step): void`.

### StrategyList
- Description: Displays strategy catalog from `/api/strategies`, allows single selection.
- Main elements: list/grid of cards (name, description), radio-like selection behavior, loading skeleton, error retry.
- Handled interactions: click/select strategy card, keyboard focus + Enter, retry fetch.
- Validation: require one selected before proceeding; ensure strategy id is in fetched list.
- Types: `StrategyDto` (existing), `StrategyOptionVM` (adds `selected: boolean`).
- Props: `strategies: StrategyOptionVM[]`, `loading: boolean`, `error?: string`, `onSelect(id: string)`.

### GoalSelector
- Description: Choose between `fastest_payoff` and `payment_reduction`; enables threshold input when payment reduction selected.
- Main elements: radio group for goals, description tooltips, threshold sub-section conditional.
- Handled interactions: select goal, toggle reinvest toggle read-only hint (not editable here; link to settings), focus/blur events.
- Validation: goal must be chosen; if payment reduction then threshold field must pass > 0 numeric validation; also reinvest toggle contextual info only.
- Types: `GoalType` (existing), `GoalSelectionState`.
- Props: `goal?: GoalType`, `onChange(goal: GoalType)`.

### ThresholdInput
- Description: Numeric input for payment reduction target (PLN). Visible only when goal is payment reduction.
- Main elements: label, currency input (type number), helper/error text.
- Handled interactions: change, blur (trigger validation), paste.
- Validation: required when visible, must be a positive number > 0, optional upper bound rule (not in PRD; omit), server cross-check pre-submit.
- Types: `ThresholdFieldState` ({ value: number | '', valid: boolean, error?: string }).
- Props: `value`, `onChange(value)`, `error?`.

### SettingsSummary
- Description: Read-only snapshot of user settings: Monthly Overpayment Limit, Reinvest Reduced Payments (toggle state). Link to `/settings` for edits.
- Main elements: definition list or cards; a link/button to settings.
- Interactions: navigate to `/settings` (opens in same tab); no state changes.
- Validation: none (display only); highlight if overpayment limit is 0 (informational warning).
- Types: `UserSettingsDto` (existing), `SettingsSummaryVM`.
- Props: `settings: UserSettingsDto`, `loading: boolean`.

### LoansPreview
- Description: Shows current loans to inform strategy choice (principal, remaining balance, rate, term remaining, closed indicator).
- Main elements: table or compact list, maybe sorting by remaining balance or rate.
- Interactions: none required beyond scroll; optional expand details.
- Validation: none; if zero loans show an empty state with link to `/loans/new` (cannot proceed until at least one loan exists).
- Types: `LoanDto` (existing), `LoanPreviewVM` (adds computed `remainingTermMonths`, `highlight` flags).
- Props: `loans: LoanPreviewVM[]`, `loading: boolean`, `error?: string`.

### SubmitControls
- Description: Footer actions: Submit (Run Simulation) and Cancel (if running or queued). Disabled states reflect validation or in-progress.
- Main elements: primary button, secondary button, optional tooltip for disabled reason.
- Interactions: click submit, click cancel, attempt retry on conflict/resolution.
- Validation: references aggregated wizard validity; disabled if invalid or running.
- Types: `SubmitState` ({ canSubmit: boolean; submitting: boolean; conflict: boolean }).
- Props: `canSubmit`, `submitting`, `onSubmit()`, `onCancel()`, `conflict`.

### StatusBanner
- Description: Displays status: idle, queued, running (with spinner/time estimate), cancelled, completed, conflict (409), validation error, network error.
- Main elements: role="status" region with ARIA live updates, color-coded alert variants.
- Interactions: For conflict include action button "Cancel & Retry"; for error include "Retry".
- Validation: none; reactive to `SimulationStatusVM`.
- Types: `SimulationStatusVM` ({ phase: 'idle'|'queued'|'running'|'completed'|'cancelled'|'error'|'conflict'; simulationId?: string; startedAt?: string; message?: string }).
- Props: `status: SimulationStatusVM`, `onRetry?()`, `onCancelAndRetry?()`.

## 5. Types
New / ViewModel Types:
- `WizardStep` = 'strategy' | 'goal' | 'review'
- `WizardState` {
  step: WizardStep;
  selectedStrategyId?: string;
  goal?: GoalType;
  threshold?: number; // required if goal === 'payment_reduction'
  thresholdValid: boolean;
  canSubmit: boolean;
}
- `StrategyOptionVM` = StrategyDto & { selected: boolean }
- `GoalSelectionState` { goal?: GoalType }
- `ThresholdFieldState` { value: number | ''; touched: boolean; valid: boolean; error?: string }
- `LoanPreviewVM` = LoanDto & { remainingTermMonths: number; highlight?: 'highRate' | 'smallBalance' }
- `SettingsSummaryVM` { overpaymentLimit: number; reinvestReducedPayments: boolean }
- `SubmitState` { canSubmit: boolean; submitting: boolean; conflict: boolean }
- `SimulationSubmitResult` { simulationId: string; status: SimulationStatus }
- `SimulationStatusVM` { phase: 'idle'|'queued'|'running'|'completed'|'cancelled'|'error'|'conflict'; simulationId?: string; startedAt?: string; completedAt?: string; message?: string; errorCode?: string }
- `WizardValidationErrors` { strategy?: string; goal?: string; threshold?: string; loans?: string }
- `CancellationResult` { previousCancelled: boolean; newStarted: boolean; previousId?: string; newId?: string }

Reuse existing DTOs: `StrategyDto`, `UserSettingsDto`, `LoanDto`, `CreateSimulationCommand`, `SimulationQueuedResponse`, `SimulationDto`.

## 6. State Management
Local page-level state via React hooks; no global store required.
- `wizardState` (useSimulationWizard): manages selected strategy, goal, threshold field, step navigation, aggregated validation.
- `strategiesState` (useStrategies): fetch status, list, error, refetch.
- `userSettingsState` (useUserSettings): fetch settings for summary.
- `loansState` (useLoansPreview): fetch loans; gate submit if empty.
- `submitState`: derived from validation & action status.
- `simulationStatus` (useSimulationPolling): after submit begins polling `GET /api/simulations/{id}` until `status === 'completed' | 'cancelled' | 'failed'`.
Side Effects:
- On completion: optionally call `POST /api/simulations/{id}/activate` if auto-activate chosen (configurable flag) then redirect `/dashboard`.
- On 409 conflict submit: set status phase 'conflict' and present Cancel & Retry.

## 7. API Integration
Required Endpoints:
1. `GET /api/strategies` → returns `StrategyDto[]` used in StrategyList.
2. `GET /api/user-settings` → returns `UserSettingsDto` for SettingsSummary.
3. `GET /api/loans` → returns `LoanListResponse`; transform items to `LoanPreviewVM`.
4. `POST /api/simulations` with body `CreateSimulationCommand`:
   - Body mapping: strategy, goal, reinvestReducedPayments (from settings), paymentReductionTarget (threshold), monthlyOverpaymentLimit (optional if needed override). Response `SimulationQueuedResponse`.
5. `GET /api/simulations/{id}` polling every 1–2s until `status` transitions.
6. `POST /api/simulations/{id}/cancel` used when user presses Cancel mid-run.
7. `POST /api/simulations/{id}/activate` if activation not automatic.
Concurrency Handling (US-047): If `POST /api/simulations` returns 409, previous running simulation is cancelled server-side; UI receives conflict state. Provide user action "Start New Simulation" which re-attempts submission once conflict resolution confirmed (optionally call `POST /api/simulations/{previousId}/cancel` before retry if server needs explicit cancellation).

Request/Response Type Mapping:
- Submit Request: `CreateSimulationCommand`
- Submit Response (202): `SimulationQueuedResponse`
- Poll Response: `SimulationDto` (status field) or extended detail structure with schedule (not required for wizard completion—only status).
- Cancel Response: `SimulationCancelResponse`
- Activate Response: `SimulationActivationResponse`

## 8. User Interactions
1. Select Strategy Card → updates `selectedStrategyId`, clears strategy validation error.
2. Choose Goal → updates `goal`; if payment reduction show ThresholdInput and mark threshold required; else clear threshold errors.
3. Enter Threshold → updates numeric value; on blur triggers validation (>0); errors shown inline.
4. Navigate Steps → Stepper checks prior step validity.
5. Submit Simulation → validates all; sends POST; enters queued/running phases; disables form.
6. Cancel Running Simulation → calls cancel endpoint; updates StatusBanner to cancelled; user may adjust inputs and resubmit.
7. Conflict (409) → StatusBanner shows conflict message; action button cancels previous and retries POST automatically.
8. Completion → automatic activate (optional) or show activate prompt; redirect to `/dashboard`.
9. Retry Fetch (strategies/loans/settings) on error → refetch.
10. Access Settings via link → possible leaving wizard; returning refetches reinvest flag / overpayment limit.

## 9. Conditions and Validation
- Strategy selected: required (StrategyList). Error if missing on attempt to move to goal step or submit.
- Goal selected: required (GoalSelector). Error if not chosen.
- Threshold: required and >0 only when goal === 'payment_reduction' (ThresholdInput). Client-side numeric parse + server 422 handling fallback.
- Loans exist: must have at least one open loan (LoanPreview). If none, disable submit; show message.
- Reinvest flag: displayed read-only; if true and goal === payment_reduction influences submit command.
- Conflict state: if 409 on submit, require user acknowledgment to retry.
- Cancel permitted only while `phase === 'queued' | 'running'`.
- Accessibility: Stepper buttons must have `aria-current` for active step; StatusBanner uses `aria-live="polite"`.

## 10. Error Handling
Error Categories:
- Network errors: show generic retry message; keep previous valid selections.
- Validation errors (client): inline field errors; prevent submit.
- Server 422 (missing threshold): map to threshold error label.
- Server 409 (conflict): set phase 'conflict', show explanation and action to cancel previous & retry.
- Poll timeout (e.g., > configurable max duration): show error state with retry poll / cancel.
- Unauthorized (401): redirect to login with return URL `/wizard`.
- Empty strategies list: treat as fatal; show descriptive message (should not occur in prod).
- Cancel failure (409 already completed): update status to 'completed' and proceed redirect.
Fallbacks:
- Defensive null checks when dependent data not loaded; skeleton placeholders.

## 11. Implementation Steps
1. Create route file `src/pages/wizard.astro` or `wizard.tsx` (Astro page with embedded React root) applying guard (fetch active simulation; redirect if active and not stale).
2. Implement base layout composing `WizardPage`.
3. Create types in a new file `src/lib/viewModels/wizardSimulation.ts` (define all view model + helper interfaces).
4. Implement `useStrategies` hook (fetch GET /api/strategies, map to `StrategyOptionVM`). Add loading/error states.
5. Implement `useUserSettings` hook (GET /api/user-settings) with caching (e.g., simple ref or context) and error fallback.
6. Implement `useLoansPreview` hook (GET /api/loans?page=1&pageSize=100&isClosed=false`) mapping to `LoanPreviewVM`.
7. Implement `useSimulationWizard` hook managing `wizardState`, step transitions, client validation aggregator returning `WizardValidationErrors`.
8. Build `WizardStepper` component (Shadcn/ui primitives) with keyboard navigation and validation gating.
9. Build `StrategyList` component (cards or list) using selection state; include aria role="radiogroup".
10. Build `GoalSelector` (radio group) and integrate `ThresholdInput` conditional rendering.
11. Build `SettingsSummary` (definition list) and link to `/settings`; show reinvest flag.
12. Build `LoansPreview` component (table) with empty state message if none; integrate disable submit logic.
13. Build `SubmitControls` referencing aggregated `canSubmit` and `simulationStatus.phase` for disabled state.
14. Implement `StatusBanner` with mapping from `SimulationStatusVM.phase` to UI variant messages.
15. Implement submit flow: construct `CreateSimulationCommand` from state + settings; call POST `/api/simulations`; handle responses (202 success, 409 conflict, 422 threshold error).
16. Implement conflict resolution path: on conflict show banner; on "Cancel & Retry" optionally call cancel endpoint for old simulation (if id known) then retry POST.
17. Implement `useSimulationPolling(simulationId)` (setInterval or recursive timeout) hitting `GET /api/simulations/{id}` until status in final set; handle cancellation.
18. On completion optionally call `POST /api/simulations/{id}/activate` (configurable); then redirect `/dashboard`.
19. Add accessibility attributes (aria-live, aria-current, roles) and ensure focus management (focus heading on step change / status update).
20. Integrate Tailwind + Shadcn/ui styling per design tokens; ensure responsive layout (two-column on desktop, stacked on mobile).

## 12. Mapping User Stories (Traceability Summary)
- US-009: StrategyList fetch + display.
- US-010: Initiates allocation indirectly by submitting strategy (server side); validated strategy selection.
- US-011/US-012: Reinvest flag displayed from settings; passed to CreateSimulationCommand.
- US-013/US-014: GoalSelector selection logic.
- US-015: ThresholdInput validation >0.
- US-016: Guard vs existing active simulation; activation call.
- US-018: StatusBanner shows async progress; polling.
- US-047: Conflict (409) handling with cancel & retry.

## 13. Potential Challenges & Solutions
- Concurrency Race (multiple rapid submits): lock submit button after first click; debounce.
- Poll Overload: implement exponential backoff after first few seconds; max duration safety (e.g., 60s) then prompt user.
- Stale Settings After Edit: listen to `visibilitychange` and refetch settings when user returns from `/settings` page.
- Large Loan List Performance: render virtualized list if >50 loans (future optimization, not MVP).
- Accessibility Announcements: ensure status messages update via `aria-live="polite"`; move focus to StatusBanner on error/conflict.
- Cancel Latency: show intermediate "Cancelling…" state while waiting for cancel response.

## 14. Security & Privacy Considerations
- Ensure all API requests include auth token (handled by existing middleware).
- Avoid exposing user IDs beyond needed DTO fields already defined.
- Input sanitation: numeric parsing for threshold; reject non-finite values before sending.
- Prevent replay/resubmit of identical command by disabling button and using idempotent detection (optional future: client-generated requestId header).

## 15. Performance Considerations
- Batch initial data fetch (strategies, settings, loans) in parallel Promise.all; show unified skeleton until all loaded.
- Minimize polling interval (start 1000ms then increase to 2000ms) to reduce server load.
- Lazy-load loan details expansions only when opened (future enhancement).

## 16. Testing Summary
- Hook unit tests: threshold validator, conflict handler, polling termination.
- Component tests: StrategyList selection, GoalSelector threshold appearance.
- Integration test: full wizard path including simulated 409 and retry.
- Accessibility test: tab order, aria attributes presence.

## 17. Deployment / Feature Flag (Optional)
- Consider flag `ENABLE_SIMULATION_WIZARD` to enable route once backend stable.
- If disabled, redirect `/wizard` to `/dashboard` with info toast.

---
End of Run Simulation Wizard Implementation Plan.
