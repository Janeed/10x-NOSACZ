# View Implementation Plan Loans

## 1. Overview
The Loans view at `/loans` enables authenticated users to manage loan records: create new loans (including mid-term loans), edit existing details, adjust remaining balance, change interest rate with effective date selection (current vs next month), and delete loans. Each change that can affect simulation validity triggers a stale simulation banner prompting a re-run. The view emphasizes clear inline validation, optimistic but safe concurrency using ETags, and accessibility with consistent form controls.

## 2. View Routing
Path: `/loans`
Rendering: Astro page (`src/pages/loans.astro`) hosting React island components for interactive sections (list, sidebar editor, dialogs).

## 3. Component Structure
- `LoansPage` (React island root within Astro page)
  - `StaleSimulationBanner`
  - `LoansHeader` (Add Loan button, sorting summary)
  - `LoansList`
    - `LoanRow` × N
      - `LoanRowActions` (Edit | Quick Balance | Delete)
      - `StatusBadge`
  - `EmptyState` (if no loans)
  - `PaginationControls`
  - Portals/Overlays:
    - `LoanEditorSidebar`
    - `LoanBalanceQuickEdit` (popover or modal)
    - `ConfirmDialog` (delete)

## 4. Component Details
### LoansPage
- Description: Top-level orchestrator controlling data fetching, state, and dialog visibility.
- Main elements: container div; child components listed above; context providers.
- Handled interactions: initial fetch, refetch on sort/pagination; open/close editor; trigger stale state registration.
- Validation handled indirectly (delegated to form components).
- Types: `LoanListItemVM[]`, `PaginationState`, `SortingState`, `StaleState`.
- Props: none (root). Fetch options may be derived from query params.

### StaleSimulationBanner
- Description: Dismissible banner appearing after any state-changing loan operation exposing a CTA to navigate/re-run simulation.
- Main elements: alert/div with message, trigger type label, buttons ("Re-run Later" dismiss, optional "Go to Simulation").
- Interactions: dismiss click; optional navigation.
- Validation: none.
- Types: `StaleState`.
- Props: { stale: StaleState; onDismiss(): void }.

### LoansHeader
- Description: Row at top with title, Add Loan button, maybe sort controls toggle.
- Elements: h1, button, optional sort dropdown.
- Interactions: open create sidebar, change sort.
- Validation: sort option validity (must match allowed fields).
- Types: Sorting fields union.
- Props: { onAdd(): void; sorting: SortingState; onChangeSort(field, order): void }.

### LoansList
- Description: Renders list/table of loans with header row supporting sorting.
- Elements: table or div list; header cells with clickable sort; rows.
- Interactions: sort header clicks; row-level action propagation.
- Validation: none (display only).
- Types: `LoanListItemVM[]`.
- Props: { loans: LoanListItemVM[]; sorting: SortingState; onSort(field): void; onEdit(id): void; onDelete(id): void; onQuickBalance(id): void }.

### LoanRow
- Description: Displays loan summary fields and delegates actions.
- Elements: flex/grid cells: name/identifier (id or generated label), remainingBalance, annualRate, termMonths, startMonth, status, actions menu.
- Interactions: action menu clicks.
- Validation: none (display only).
- Types: LoanListItemVM.
- Props: { loan: LoanListItemVM; onEdit(id): void; onDelete(id): void; onQuickBalance(id): void }.

### StatusBadge
- Description: Visual indicator (Open/Closed) using color-coded badge.
- Elements: span or badge component.
- Interactions: none.
- Validation: none.
- Types: { isClosed: boolean }.
- Props: { isClosed: boolean }.

### LoanRowActions
- Description: Dropdown or inline icon buttons for Edit, Quick Balance, Delete.
- Elements: button group or menu.
- Interactions: onEdit, onQuickBalance, onDelete.
- Validation: none.
- Props: { onEdit(): void; onQuickBalance(): void; onDelete(): void }.

### EmptyState
- Description: Shown when no loans exist, prompting creation.
- Elements: illustration/icon, message, Add Loan button.
- Interactions: onAdd.
- Validation: none.
- Props: { onAdd(): void }.

### PaginationControls
- Description: Page navigation and size selection.
- Elements: previous/next buttons, page number display, optional page size select.
- Interactions: onPageChange, onPageSizeChange.
- Validation: page bounds (1..totalPages), pageSize within allowed.
- Types: PaginationState.
- Props: { pagination: PaginationState; onChangePage(page): void; onChangePageSize(size): void }.

### LoanEditorSidebar
- Description: Slide-in form for creating or editing a loan including interest change effective date toggle.
- Elements: form fields: principal, remainingBalance, annualRate, termMonths, originalTermMonths, startMonth (month picker), interest effective date radio (current/next), closed state (readonly or hidden), buttons Save/Cancel.
- Interactions: input changes, Save (submit POST/PUT), Cancel (close), Rate effective toggle, optional help tooltip.
- Validation (front-end):
  - principal > 0
  - annualRate > 0
  - termMonths > 0
  - remainingBalance >= 0 and <= principal
  - originalTermMonths >= termMonths (if business rule) else >= 0
  - startMonth normalized `YYYY-MM-01`
  - If marking closed (future enhancement) closedMonth present & >= startMonth
- On Save:
  - Create mode: build `CreateLoanCommand`; if remainingBalance blank => set to principal.
  - Edit mode: build `UpdateLoanCommand`; include unchanged fields; send PUT with `If-Match` header set to stored ETag.
  - Interest rate change next month path: if annualRate changed and effective = next → after successful PUT/PATCH optionally POST `/api/loan-change-events` (future extension; currently may skip if out-of-scope) then set stale.
- Types: LoanFormValues, LoanFormErrors, `CreateLoanCommand`, `UpdateLoanCommand`.
- Props: { mode: "create" | "edit"; open: boolean; loan?: LoanListItemVM; etag?: string; onClose(): void; onSaved(updatedLoan, etag, staleFlag): void }.

### LoanBalanceQuickEdit
- Description: Lightweight inline adjustment of remaining balance (PATCH) after ad hoc payment.
- Elements: popover with numeric input, hint text, Save/Cancel.
- Interactions: input change, Save executes PATCH, Cancel closes.
- Validation: newBalance >=0 && newBalance <= principal; numeric parsing.
- Types: LoanPatchBalanceCommandVM.
- Props: { loan: LoanListItemVM; etag?: string; onClose(): void; onPatched(updatedLoan, etag, staleFlag): void }.

### ConfirmDialog
- Description: Generic destructive confirmation used for loan deletion.
- Elements: dialog with message including loan identifier, Confirm and Cancel buttons.
- Interactions: Confirm triggers DELETE with `X-Client-Confirmation: confirmed` header; Cancel closes.
- Validation: none.
- Props: { open: boolean; loan?: LoanListItemVM; onConfirm(id): void; onCancel(): void }.

### NumberInputWithValidation (Utility)
- Description: Reusable numeric input enforcing positive decimals.
- Elements: label, input, error message region.
- Interactions: onChange; formatting on blur.
- Validation: provided via props predicate and error message.
- Props: { label: string; value: number | ""; onChange(number|""): void; required?: boolean; min?: number; max?: number; error?: string }.

### MonthPicker
- Description: Month/year selector returning normalized `YYYY-MM-01`.
- Elements: select for month, select for year, combined hidden input.
- Validation: ensures output present.
- Props: { value: string; onChange(value): void; minYear?: number; maxYear?: number; error?: string }.

## 5. Types
Existing (from `src/types.ts`): `LoanDto`, `CreateLoanCommand`, `UpdateLoanCommand`, `PatchLoanCommand`, `LoanListResponse`.
New view-specific:
- `LoanListItemVM` { id: string; principal: number; remainingBalance: number; annualRate: number; termMonths: number; originalTermMonths: number; startMonth: string; isClosed: boolean; closedMonth?: string | null; createdAt: string; etag?: string; staleSimulation?: boolean }
- `SortingState` { field: "created_at" | "start_month" | "remaining_balance"; order: "asc" | "desc" }
- `PaginationState` { page: number; pageSize: number; totalPages: number; totalItems: number }
- `LoanFormValues` { principal: number | ""; remainingBalance: number | ""; annualRate: number | ""; termMonths: number | ""; originalTermMonths: number | ""; startMonth: string; rateChangeEffective: "current" | "next" }
- `LoanFormErrors` { principal?: string; remainingBalance?: string; annualRate?: string; termMonths?: string; originalTermMonths?: string; startMonth?: string; rateChangeEffective?: string }
- `StaleState` { isStale: boolean; trigger?: "edit" | "delete" | "balance_adjust" | "rate_change" | "create" }
- `LoanPatchBalanceCommandVM` { remainingBalance: number }
- `ApiErrorShape` { code: string; message: string; status: number; issues?: Array<{ path?: string; message: string; code?: string }> }

## 6. State Management
Local React state + custom hooks (no external store):
- `useLoansData({ page, pageSize, sorting })` returns { loans, pagination, sorting, loading, error, refetch } and internally stores ETags map.
- `useLoanEditor()` returns { open, mode, loan, values, errors, setField, submit, close } performing validation pre-submit.
- `useQuickBalanceEdit()` returns { open, loan, value, error, setValue, submit, close }.
- `useStaleSimulation()` centralizes stale detection: listens to responses capturing `X-Simulation-Stale` or `loan.staleSimulation` and sets `StaleState` once per operation; provides `dismiss()`.
- `useApiFetch()` generic fetch wrapper returning JSON + headers; standardizes adding auth headers (if needed) and content-type.
- Derived states: disabling Save while submitting; highlight row updated; error banners.

## 7. API Integration
Requests:
- List: `GET /api/loans?page=&pageSize=&sort=&order=` → `LoanListResponse` mapped to `LoanListItemVM[]` plus capture `ETag` from individual GET (optional if we choose per-row GET before edit).
- Create: `POST /api/loans` body `CreateLoanCommand` formed from `LoanFormValues`; on success store `ETag` header, update list (prepend or refetch). If response has `X-Simulation-Stale` treat stale.
- Update: `PUT /api/loans/{id}` headers: `If-Match: <etag>` body `UpdateLoanCommand`. Response returns updated `LoanDto`, new `ETag`, maybe `X-Simulation-Stale`.
- Patch balance: `PATCH /api/loans/{id}` headers: optional `If-Match` (send if we have) body partial `{ remainingBalance }` fulfilling `PatchLoanCommand`. Response processed similarly.
- Delete: `DELETE /api/loans/{id}` header: `X-Client-Confirmation: confirmed`; success status 204; if `X-Simulation-Stale` set stale; update list locally.
- Interest change effective next month (optional future): `POST /api/loan-change-events` with `{ loanId, effectiveMonth, changeType: "rate_change", oldAnnualRate, newAnnualRate }` after a successful PUT where effective date is next month.
Response handling: parse JSON (except 204); capture headers `ETag`, `X-Simulation-Stale`, `X-Request-Id`.
Error translation: issues array mapped into `LoanFormErrors` by `path`.

## 8. User Interactions
- Add Loan: click Add → sidebar opens; user enters principal, rate, term; Save creates loan; if success → list updates & stale banner (trigger "create").
- Edit Loan: open sidebar with pre-filled values; change fields; choose rate effective date; Save executes PUT; success → row updated; stale banner (trigger "edit").
- Quick Balance Adjust: open popover; set new balance; Save executes PATCH; success → update balance in row; stale banner (trigger "balance_adjust").
- Delete Loan: open confirm dialog; Confirm executes DELETE; success → remove row; stale banner (trigger "delete").
- Interest Rate Change (next month): user modifies annualRate and selects effective "next"; Save updates loan (current fields) plus (optional) create change event; stale banner (trigger "rate_change").
- Sorting: clicking header toggles order; triggers refetch.
- Pagination: clicking next/prev updates page state; triggers refetch.
- Dismiss Stale Banner: hides banner until next trigger.

## 9. Conditions and Validation
Component-level checks:
- Principal > 0 (LoanEditorSidebar) else error.
- AnnualRate > 0.
- TermMonths > 0.
- RemainingBalance: if blank create mode set to principal; if provided ensure 0 ≤ remainingBalance ≤ principal.
- startMonth present; formatting `YYYY-MM-01`.
- Rate effective date radio must be selected when annualRate changed; default "next".
- Quick Balance value numeric and within range.
- Sorting field selection limited to allowed union.
- Pagination page cannot exceed totalPages (disable beyond bounds).
API preconditions:
- PUT requires ETag stored when entering edit (via prior GET or from list if preserved). If missing, fallback fetch first.
- DELETE requires confirmation header; ConfirmDialog ensures header value constant.
- Content-Type application/json enforced by fetch wrapper.
Failure surface: highlight invalid fields, disable Save until all required pass.

## 10. Error Handling
- 400 Validation: map `issues` to field errors; show banner for non-field errors.
- 409 Conflict (ETag mismatch): show toast "Loan updated elsewhere. Reloading." then refetch loan and re-open form with new values.
- 404 Not Found: remove loan from list if editing/deleting; toast "Loan no longer exists".
- Network failure: show retry button on list level; keep existing cached data if any.
- Delete conflict (409 running simulation job): present inline error inside dialog; option to cancel.
- Unexpected 5xx: log requestId (if present) to console; show generic error banner with retry.
- Stale banner race: if multiple operations trigger, maintain first trigger label; subsequent updates only toggle isStale=true (not overwrite trigger).
- Form submission duplicate click: disable Save while pending.

## 11. Implementation Steps
1. Create Astro page `src/pages/loans.astro` mounting `<LoansPage />` island.
2. Implement types in a new `src/lib/viewModels/loans.ts` (LoanListItemVM, SortingState, etc.).
3. Build `useApiFetch` hook for standardized fetch + header extraction.
4. Build `useStaleSimulation` hook capturing headers from write responses.
5. Implement `useLoansData` hook (list fetch, sorting, pagination, refetch, error states).
6. Implement `LoansPage` integrating hooks, handing children props.
7. Implement `LoansHeader` (Add button, sort controls UI).
8. Implement `LoansList`, `LoanRow`, `LoanRowActions`, `StatusBadge` using Tailwind + shadcn primitives.
9. Implement `EmptyState` component with CTA.
10. Implement `PaginationControls` (prev/next, page size if needed).
11. Implement `LoanEditorSidebar` form:
    - Controlled inputs + inline errors area.
    - Validation logic pre-submit building commands.
    - Submit handler calling POST or PUT with ETag.
12. (Optional future) Interest rate next-month event logic: after PUT if effective=next create change event.
13. Implement `LoanBalanceQuickEdit` popover (shadcn Popover/Dialog) with range validation.
14. Implement `ConfirmDialog` (shadcn Dialog) sending DELETE with header.
15. Implement `StaleSimulationBanner` triggered by `useStaleSimulation` state.
16. Integrate ETag storage (Map) inside `useLoansData`; when editing, ensure latest ETag is loaded (via GET if absent).
17. Add accessibility: labels, aria-describedby for errors, focus management for sidebar/dialog open.
18. Add loading skeletons for list while fetching.
19. Add toast notifications component (if existing pattern) for success, conflict, deletion.
20. Add minimal unit tests for validation helpers (principal >0, balance <= principal).
21. Verify stale banner triggers for each operation (inspect headers simulation).

---
This plan aligns with PRD user stories (US-001, US-002, US-003, US-004, US-005, US-006, US-021, US-025) and enforces API constraints (ETag, confirmation header, validation limits) while centralizing stale simulation prompts.
