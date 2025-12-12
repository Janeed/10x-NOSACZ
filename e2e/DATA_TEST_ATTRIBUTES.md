# Data-Test Attributes Quick Reference

This is a quick reference for all `data-test` attributes used in loan management components. These are used by the Page Object Model classes for element selection.

## Loans Page

| Element | Selector |
|---------|----------|
| Add loan button | `[data-test="loans-add-button"]` |
| Sort field select | `[data-test="loans-sort-field-select"]` |
| Sort order toggle | `[data-test="loans-sort-order-toggle"]` |
| Loans table | `[data-test="loans-table"]` |
| Loading indicator | `[data-test="loans-loading"]` |
| Error container | `[data-test="loans-error"]` |
| Error message | `[data-test="loans-error-message"]` |
| Retry button | `[data-test="loans-retry-button"]` |
| Empty state | `[data-test="loans-empty-state"]` |
| Empty state add button | `[data-test="loans-empty-state-add-button"]` |
| Pagination info | `[data-test="loans-pagination-info"]` |
| Stale banner | `[data-test="loans-stale-banner"]` |
| Stale trigger text | `[data-test="loans-stale-trigger"]` |
| Stale dismiss button | `[data-test="loans-stale-dismiss-button"]` |

## Loan Rows

| Element | Selector |
|---------|----------|
| Loan row | `[data-test="loan-row"]` |
| Loan row with ID | `[data-test="loan-row"][data-loan-id="{id}"]` |
| Loan label | `[data-test="loan-label"]` |
| Remaining balance | `[data-test="loan-remaining-balance"]` |
| Annual rate | `[data-test="loan-annual-rate"]` |
| Term | `[data-test="loan-term"]` |
| Start month | `[data-test="loan-start-month"]` |
| Status badge | `[data-test="loan-status-badge"]` |
| Edit button | `[data-test="loan-edit-button"]` |
| Delete button | `[data-test="loan-delete-button"]` |
| Quick balance button | `[data-test="loan-quick-balance-button"]` |

## Loan Editor Sidebar

| Element | Selector |
|---------|----------|
| Sidebar container | `[data-test="loan-editor-sidebar"]` |
| Sidebar with mode | `[data-test="loan-editor-sidebar"][data-mode="create\|edit"]` |
| Title | `[data-test="loan-editor-title"]` |
| Close button | `[data-test="loan-editor-close-button"]` |
| Form | `[data-test="loan-editor-form"]` |
| **Inputs** | |
| Principal input | `[data-test="loan-principal-input"]` |
| Remaining balance input | `[data-test="loan-remaining-balance-input"]` |
| Annual rate input | `[data-test="loan-annual-rate-input"]` |
| Term months input | `[data-test="loan-term-months-input"]` |
| Original term months input | `[data-test="loan-original-term-months-input"]` |
| Start month select | `[data-test="loan-start-month-month-select"]` |
| Start year select | `[data-test="loan-start-month-year-select"]` |
| Rate effective current | `[data-test="loan-rate-effective-current"]` |
| Rate effective next | `[data-test="loan-rate-effective-next"]` |
| **Errors** | |
| Principal error | `[data-test="loan-principal-error"]` |
| Remaining balance error | `[data-test="loan-remaining-balance-error"]` |
| Annual rate error | `[data-test="loan-annual-rate-error"]` |
| Term months error | `[data-test="loan-term-months-error"]` |
| Original term months error | `[data-test="loan-original-term-months-error"]` |
| Start month error | `[data-test="loan-start-month-error"]` |
| Rate effective error | `[data-test="loan-rate-effective-error"]` |
| General error | `[data-test="loan-editor-error"]` |
| **Actions** | |
| Cancel button | `[data-test="loan-editor-cancel-button"]` |
| Submit button | `[data-test="loan-editor-submit-button"]` |

## Delete Confirmation Dialog

| Element | Selector |
|---------|----------|
| Dialog container | `[data-test="loan-delete-dialog"]` |
| Title | `[data-test="loan-delete-title"]` |
| Loan ID display | `[data-test="loan-delete-id"]` |
| Error message | `[data-test="loan-delete-error"]` |
| Cancel button | `[data-test="loan-delete-cancel-button"]` |
| Confirm button | `[data-test="loan-delete-confirm-button"]` |

## Quick Balance Dialog

| Element | Selector |
|---------|----------|
| Dialog container | `[data-test="loan-quick-balance-dialog"]` |
| Title | `[data-test="loan-quick-balance-title"]` |
| Form | `[data-test="loan-quick-balance-form"]` |
| Balance input | `[data-test="loan-quick-balance-input"]` |
| Field error | `[data-test="loan-quick-balance-field-error"]` |
| General error | `[data-test="loan-quick-balance-error"]` |
| Cancel button | `[data-test="loan-quick-balance-cancel-button"]` |
| Submit button | `[data-test="loan-quick-balance-submit-button"]` |

## Usage in Tests

Instead of using these selectors directly, use the Page Object Model classes which provide convenient methods:

```typescript
// ❌ Don't do this
await page.click('[data-test="loans-add-button"]');
await page.fill('[data-test="loan-principal-input"]', '100000');

// ✅ Do this
await loansPage.clickAddLoan();
await loansPage.editor.setPrincipal('100000');
```

The POM classes handle all selector logic internally, making tests more maintainable.

