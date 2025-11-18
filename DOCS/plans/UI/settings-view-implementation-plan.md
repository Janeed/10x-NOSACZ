# View Implementation Plan: Settings

## 1. Overview
The Settings view (`/settings`) enables the user to configure two global defaults that influence simulation generation and dashboard behavior: (1) `monthlyOverpaymentLimit` (PLN amount applied across loans each month) and (2) `reinvestReducedPayments` (whether reductions in regular loan payments achieved under the payment-reduction goal are added back into the overpayment pool). Editing these settings marks the active simulation stale and prompts the user to re-run a simulation. The view supports initial creation (uninitialized state), update with optimistic locking (ETag), validation feedback, accessibility, and clear post-save success + re-simulation guidance.

## 2. View Routing
Path: `/settings` (Astro page with a React island for dynamic form logic).

## 3. Component Structure
Top-level hierarchy:
```
SettingsPage (Astro)
  └── <SettingsApp /> (React root island)
        ├── SettingsHeader
        ├── SettingsForm
        │     ├── MonthlyOverpaymentLimitField
        │     ├── ReinvestToggle (+ ReinvestTooltip)
        │     ├── FormActions (Save / Cancel)
        ├── LastUpdatedDisplay
        ├── StaleSimulationBanner (conditional)
        ├── ErrorAlert (conditional)
        └── SuccessToast (portal / overlay)
```

## 4. Component Details
### SettingsPage (Astro)
- Description: Astro route wrapper providing HTML shell, SEO meta, and hydration boundary for React island.
- Main elements: `<Layout>` wrapper, `<div id="settings-root">` mount point.
- Handled interactions: None (delegated to React island).
- Validation: None.
- Types: None beyond layout props.
- Props: None.

### SettingsApp (React root controller)
- Description: Orchestrates loading state, holds view model, composes child components, and triggers API interactions.
- Main elements: Container, conditional skeleton, children components.
- Handled interactions: Initial fetch, save submission, cancel action, conflict resolution, navigation to simulation re-run.
- Validation: Invokes form validation prior to PUT.
- Types: `UserSettingsDto`, `UpdateUserSettingsCommand`, `SettingsViewModel`.
- Props: None (root).

### SettingsHeader
- Description: Displays page title and concise descriptive copy.
- Main elements: `<header>` with `<h1>`, `<p>` explanatory text.
- Handled interactions: None.
- Validation: None.
- Types: None.
- Props: Optional `className`.

### SettingsForm
- Description: Editable form for `monthlyOverpaymentLimit` and `reinvestReducedPayments` with inline validation and dirty tracking.
- Main elements: `<form>`, field components, action buttons.
- Handled interactions: Input change, blur (sanitization), submit, cancel.
- Validation: Non-negative decimal; empty converted to `0` only on submit if initial creation? (Prefer explicit user input.) Prevent negative and non-numeric entries.
- Types: `SettingsFormValues`, `SettingsFormErrors`, `UpdateUserSettingsCommand`.
- Props: `{ values, errors, onChange, onSubmit, onCancel, saving, disabled }`.

### MonthlyOverpaymentLimitField
- Description: Controlled numeric input for monthly limit (PLN) with helper text and validation feedback.
- Main elements: `<label>`, `<input type="text">` (controlled), error `<p>`.
- Handled interactions: Change, blur (normalization: trim, convert comma to dot, parse float, flag error if NaN or <0).
- Validation: `value !== '' && parseFloat(value) >= 0`; disallow more than two decimal places (optional UX); highlight on error.
- Types: Uses `SettingsFormValues.monthlyOverpaymentLimit` string.
- Props: `{ value, error, onChange, onBlur, disabled }`.

### ReinvestToggle
- Description: Boolean switch controlling default reinvest behavior for payment reduction goal scenarios.
- Main elements: Shadcn `Switch`, descriptive label, tooltip trigger.
- Handled interactions: Toggle change.
- Validation: None (always boolean).
- Types: `SettingsFormValues.reinvestReducedPayments`.
- Props: `{ checked, onChange, disabled }`.

### ReinvestTooltip
- Description: Tooltip explaining: “If enabled, any monthly payment reductions achieved under the payment reduction goal are added to future overpayment allocation instead of lowering your ongoing monthly payment total.”
- Main elements: Trigger icon/button, accessible tooltip content.
- Handled interactions: Hover/focus.
- Validation: None.
- Types: None.
- Props: `{}`.

### FormActions
- Description: Save and Cancel buttons with disabled logic and progress feedback.
- Main elements: `<div>`, `<button type="submit">Save</button>`, `<button type="button">Cancel</button>`.
- Handled interactions: Submit (calls `onSubmit`), Cancel (resets form to last persisted dto).
- Validation: Save disabled if `saving`, not dirty, or has errors.
- Types: None.
- Props: `{ onCancel, saving, hasErrors, isDirty }`.

### LastUpdatedDisplay
- Description: Shows human-readable last updated timestamp or “Not set yet”.
- Main elements: `<time>` element.
- Handled interactions: None.
- Validation: None.
- Types: `UserSettingsDto.updatedAt`.
- Props: `{ updatedAt?: string }`.

### StaleSimulationBanner
- Description: Post-save banner informing user active simulation is stale with CTA button.
- Main elements: `<div role="alert">` copy + “Re-run Simulation” button.
- Handled interactions: CTA click (navigate to simulation creation or open modal).
- Validation: None.
- Types: None.
- Props: `{ visible: boolean, onRerun: () => void }`.

### SuccessToast
- Description: Toast message confirming settings saved (Created vs Updated) and reminding about re-run.
- Main elements: Shadcn `Toast` container.
- Handled interactions: Auto-dismiss timer, manual close.
- Validation: None.
- Types: None.
- Props: `{ variant: 'created' | 'updated', onDismiss }`.

### ErrorAlert
- Description: Displays API or validation errors (400, 409, network, unauthorized) with optional retry.
- Main elements: `<div role="alert">` error code/message + action buttons.
- Handled interactions: Retry fetch / dismiss.
- Validation: None.
- Types: `SettingsError`.
- Props: `{ error?: SettingsError, onRetry?: () => void, onDismiss?: () => void }`.

## 5. Types
### Existing DTO / Command (from `src/types.ts`)
- `UserSettingsDto`: `{ userId: string; monthlyOverpaymentLimit: number; reinvestReducedPayments: boolean; updatedAt: string; }`
- `UpdateUserSettingsCommand`: `{ monthlyOverpaymentLimit: number; reinvestReducedPayments: boolean; }`

### New ViewModel & Form Types
1. `SettingsFormValues`
```ts
interface SettingsFormValues {
  monthlyOverpaymentLimit: string; // raw input value for controlled field
  reinvestReducedPayments: boolean;
}
```
2. `SettingsFormErrors`
```ts
interface SettingsFormErrors {
  monthlyOverpaymentLimit?: string; // e.g. 'Must be a non-negative number'
}
```
3. `SettingsError`
```ts
type SettingsError = {
  type: 'validation' | 'conflict' | 'network' | 'unknown' | 'notFound' | 'unauthorized';
  code?: string; // API error code when present
  message: string;
};
```
4. `SettingsViewModel`
```ts
interface SettingsViewModel {
  dto?: UserSettingsDto;         // current persisted settings (undefined before fetch or if 404)
  eTag?: string;                 // same as dto.updatedAt, used for If-Match
  isInitialized: boolean;        // true if dto exists
  status: 'idle' | 'loading' | 'saving' | 'error';
  error?: SettingsError;
  form: SettingsFormValues;
  formErrors: SettingsFormErrors;
  dirty: boolean;
  staleBannerVisible: boolean;   // toggled true after successful save
  saveResult?: 'created' | 'updated';
}
```

## 6. State Management
Use React state + custom hooks:
- `useUserSettings()` performs initial GET. On 404 sets `isInitialized=false` without error.
- `useSettingsForm(dto)` initializes form values from dto or defaults (`''` for limit until user types, `false` for reinvest). Tracks dirty by comparing current values to dto snapshot.
- `useSaveUserSettings()` sends PUT with body and conditional `If-Match` header (`eTag`) if `isInitialized` true. Returns promise resolving to `{ dto, created }`.
- `useSettingsController()` combines above, exposes `viewModel` and handlers: `handleChange`, `handleBlur`, `handleSubmit`, `handleCancel`, `handleRerunSimulation`.
State transitions: `loading` → `idle` after fetch; `saving` during PUT; on success update dto, eTag, set `staleBannerVisible=true`, show toast; on error set `error` and `status='error'` then revert to `idle` after dismissal.

## 7. API Integration
### Fetch Existing Settings
```http
GET /api/user-settings
Authorization: Bearer <token>
```
Responses:
- 200: `UserSettingsDto` JSON; capture `updatedAt` as ETag.
- 404: treat as uninitialized (create mode).

### Save (Create or Update)
```http
PUT /api/user-settings
Authorization: Bearer <token>
Content-Type: application/json
If-Match: <previous updatedAt>   // only when updating existing settings
Body: {
  "monthlyOverpaymentLimit": number,
  "reinvestReducedPayments": boolean
}
```
Responses:
- 201 Created: first-time creation; headers: `ETag: <updatedAt>` (store).
- 200 OK: updated; headers: `ETag: <updatedAt>`.
- 400 Bad Request: validation (negative number) → show inline error.
- 409 Conflict: optimistic locking violation → auto-refetch GET then surface message.
Add `X-Request-Id` from response (optional: log / debugging only; not needed for UI state).

### Mapping to Commands
Build `UpdateUserSettingsCommand` from sanitized form: parse `monthlyOverpaymentLimit` (`parseFloat`), ensure non-negative, pass boolean.

## 8. User Interactions
- Page load: Display loading skeleton then form; if uninitialized show empty inputs.
- Typing limit: Real-time validation; errors disable Save.
- Toggle reinvest: Updates dirty state.
- Save: Triggers PUT; disables form while saving; success shows toast + stale banner.
- Cancel: Resets form to last saved dto values; clears errors; dirty false.
- Re-run Simulation CTA: Navigates to simulation creation route (`/wizard` or defined simulation start page).
- Retry after error: Re-fetch or re-submit depending on error type.
- Conflict detected (409): Inform user remote change occurred; refetch and update form; user re-applies edits if desired.

## 9. Conditions and Validation
| Condition | Component | Enforcement | Outcome on Fail |
|-----------|-----------|-------------|-----------------|
| `monthlyOverpaymentLimit >= 0` | MonthlyOverpaymentLimitField / SettingsForm | Client pre-submit + server | Inline error; Save disabled; server 400 displays ErrorAlert if bypassed |
| Non-numeric input | MonthlyOverpaymentLimitField | Parse & regex check | Error message “Enter a valid number” |
| If existing settings then include ETag | useSaveUserSettings | Add `If-Match` header | Missing header may still succeed but best practice; server warns only |
| Conflict (stale ETag) | useSaveUserSettings | Detect 409 status | ErrorAlert + automatic refetch |
| Unauthorized (no token) | SettingsApp | Check 401 | Redirect to sign-in |

## 10. Error Handling
- 404 GET: Switch to create mode; no alert.
- 400 PUT: Map API error code to field; show inline error + toast variant (optional).
- 409 PUT: Show conflict alert; auto refetch latest settings; keep unsaved user edits optionally (MVP: replace with server state and clear dirty).
- 401/403: Redirect to authentication flow.
- Network failure: Show ErrorAlert with retry button that re-executes GET or PUT.
- Unknown / 5xx: Generic message “Unexpected error, please retry.”; keep user edits intact; allow retry.
- Validation sync mismatch (client passes value server rejects): Display server message and keep editing state.

## 11. Implementation Steps
1. Create Astro route `src/pages/settings.astro` with layout and mount `<SettingsApp />` React island.
2. Implement `SettingsApp.tsx` component: initialize controller hook, render skeleton or form.
3. Implement `useUserSettings` hook (fetch logic with 404 handling) using `fetch('/api/user-settings')`.
4. Implement `useSettingsForm` for form state, dirty tracking, and validation parsing functions.
5. Implement `useSaveUserSettings` performing PUT with conditional `If-Match` and mapping response headers (ETag) + status handling.
6. Compose `useSettingsController` combining above into `SettingsViewModel` object.
7. Build `SettingsForm` component using Shadcn/ui primitives and Tailwind classes for layout.
8. Create `MonthlyOverpaymentLimitField` with numeric sanitation (onBlur: replace comma, trim; store raw; onChange: update state and run validation).
9. Create `ReinvestToggle` with accessible label + `ReinvestTooltip`.
10. Add `FormActions` with disabled logic (saving, !dirty, errors present).
11. Add `LastUpdatedDisplay` formatting `updatedAt` via `Intl.DateTimeFormat`.
12. Implement `SuccessToast` using existing toast system or simple local portal; differentiate created vs updated.
13. Implement `ErrorAlert` component mapping `SettingsError` types to messages and actions.
14. Implement `StaleSimulationBanner` shown after successful save (always after PUT) with CTA linking to simulation wizard (`/wizard` or `/dashboard?rerun=1`).
15. Wire submit handler: validate, build command, call save, update state (dto, eTag, staleBannerVisible, toast, clear errors, dirty false).
16. Wire cancel handler: reset form values from `dto` (or defaults if uninitialized), clear errors, dirty false.
17. Add optimistic locking: store `dto.updatedAt` as `eTag`; include header only when `isInitialized`.
18. Add conflict path: on 409 set error, call refetch, replace form values; show alert.
19. Add authorization guard: if fetch returns 401 redirect; integrate existing auth middleware pattern.
20. Ensure accessibility: labels, `aria-invalid` on invalid input, tooltip accessible via keyboard.
21. Add integration test script (optional) hitting GET (404), PUT create (201), subsequent GET (200), PUT update (200), simulated 409 scenario (manually stale ETag) verifying UI paths.
22. Perform manual validation of decimal input and large value handling; finalize copy for reinvest tooltip and stale banner.
23. Final QA: Check dark/light theme contrast, disabled button states, responsive layout.

## 12. Additional Notes
- Currency formatting: Consider read-only formatted preview (e.g., “PLN 1,250.00”) below raw numeric input post-blur.
- Future extension: Add optimistic UI marking simulation stale by requesting active simulation endpoint for confirmation if needed.
- Logging: Optionally log `X-Request-Id` for diagnostics (not required for MVP).
