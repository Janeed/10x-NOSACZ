# E2E Tests - Page Object Model

This directory contains end-to-end tests for the NOSACZ application using Playwright and the Page Object Model (POM) pattern.

## Structure

```
e2e/
├── pages/                    # Page Object Model classes
│   ├── BasePage.ts          # Base class with common functionality
│   ├── LoansPage.ts         # Main loans management page
│   ├── LoanEditorSidebar.ts # Loan create/edit sidebar
│   ├── LoanDeleteConfirmDialog.ts
│   ├── LoanBalanceQuickEditDialog.ts
│   └── index.ts             # Exports all POMs
├── loans.spec.ts            # Loan CRUD test scenarios
└── README.md                # This file
```

## Page Object Model (POM) Classes

### AuthPage

Page object for authentication flows (`/auth/signin`, `/auth/signup`).

**Key Methods:**
- `navigateToSignIn()` - Go to sign-in page
- `navigateToSignUp()` - Go to sign-up page
- `signIn(email, password)` - Fill and submit sign-in form
- `signUp(email, password)` - Fill and submit sign-up form
- `signInAndWait()` - Sign in and wait for redirect
- `verifySignInMode()` - Assert sign-in page
- `verifyAuthenticated()` - Assert on dashboard
- `getEmailError()` - Get email validation error
- `togglePasswordVisibility()` - Show/hide password

**Usage:**
```typescript
test('should sign in', async ({ authPage }) => {
  await authPage.navigateToSignIn();
  await authPage.signInAndWait('user@example.com', 'password123');
  await authPage.verifyAuthenticated();
});
```

**Note**: Most tests don't need to manually sign in because global setup handles authentication automatically. See [AUTH_README.md](./AUTH_README.md) for details.

### BasePage

Base class providing common functionality for all page objects:

- **Locator utilities**: `getByTestId()`, `clickByTestId()`, `fillByTestId()`
- **Wait utilities**: `waitForVisible()`, `waitForHidden()`, `waitForLoad()`
- **Visibility checks**: `isVisible()`, `exists()`
- **Navigation**: `goto()`, `getCurrentUrl()`

All page objects extend this class.

### LoansPage

Main page object for the loans management page (`/loans`).

**Key Methods:**
- `navigate()` - Navigate to loans page
- `createLoan(data)` - Complete flow to create a new loan
- `editLoan(index)` - Open editor for specific loan
- `deleteLoan(index)` - Open delete dialog for specific loan
- `getLoanCount()` - Get number of loans in table
- `getLoanDisplayData(index)` - Extract displayed loan data
- `setSortField(field)` - Change sort field
- `isStaleBannerVisible()` - Check stale simulation warning

**Sub-components:**
- `editor` - LoanEditorSidebar instance
- `deleteDialog` - LoanDeleteConfirmDialog instance
- `balanceDialog` - LoanBalanceQuickEditDialog instance

**High-level flows:**
- `createLoanAndVerify(data)` - Create loan and verify it appears
- `editLoanAndVerifyStale(index, data)` - Edit and verify stale banner
- `deleteLoanAndVerify(index)` - Delete and verify removal
- `adjustBalanceAndVerifyStale(index, balance)` - Adjust balance and verify

### LoanEditorSidebar

Handles the loan creation/editing sidebar form.

**Key Methods:**
- `fillForm(data)` - Fill all form fields at once
- `setPrincipal(value)` - Set principal amount
- `setAnnualRate(value)` - Set interest rate
- `setTermMonths(value)` - Set term in months
- `submit()` - Submit the form
- `cancel()` - Cancel and close
- `getMode()` - Get current mode ('create' or 'edit')
- `verifyCreateMode()` - Assert create mode
- `verifyEditMode()` - Assert edit mode
- `getPrincipalError()` - Get validation error for principal
- `hasValidationErrors()` - Check if any errors are visible

**Complete flows:**
- `fillAndSubmit(data)` - Fill form and submit
- `submitAndExpectErrors()` - Submit and verify errors appear

### LoanDeleteConfirmDialog

Handles the loan deletion confirmation dialog.

**Key Methods:**
- `confirmDelete()` - Confirm and delete loan
- `cancel()` - Cancel deletion
- `getTitle()` - Get dialog title
- `getLoanId()` - Get displayed loan ID
- `hasError()` - Check for error message
- `verifyDialog(expectedLoanId?)` - Verify dialog is shown

### LoanBalanceQuickEditDialog

Handles the quick balance adjustment dialog.

**Key Methods:**
- `setBalance(value)` - Set new balance value
- `submit()` - Submit the change
- `cancel()` - Cancel adjustment
- `getBalanceValue()` - Get current input value
- `hasError()` - Check for validation errors
- `getFieldError()` - Get field error message

**Complete flows:**
- `setBalanceAndSubmit(value)` - Set balance and submit
- `setBalanceAndExpectError(value)` - Set invalid balance and verify error

## Prerequisites

### Authentication Setup

Before running tests, you must configure authentication credentials:

1. **Copy the environment file**:
   ```bash
   cp .env.test.example .env.test
   ```

2. **Edit `.env.test`** and add your test user credentials:
   ```env
   E2E_USERNAME=your-test-user@example.com
   E2E_PASSWORD=YourTestPassword123
   ```

3. **Create the test user** in your application (via signup or database)

See [AUTH_README.md](./AUTH_README.md) for detailed authentication setup instructions.

## Running Tests

### Run all tests
```bash
npm run test:e2e
# or
npx playwright test
```

**Note**: The first run will execute the authentication setup, then run all tests with the authenticated session.

### Run specific test file
```bash
npx playwright test e2e/loans.spec.ts
```

### Run in headed mode (see browser)
```bash
npx playwright test --headed
```

### Run with UI mode (interactive)
```bash
npx playwright test --ui
```

### Run specific test
```bash
npx playwright test -g "should create a single loan"
```

### Debug tests
```bash
npx playwright test --debug
```

### Generate test report
```bash
npx playwright show-report
```

## Test Data

All tests use the `data-test` attributes added to components for reliable element selection. This avoids brittle CSS selectors and class dependencies.

Example loan data structure:
```typescript
{
  principal: '100000',
  remainingBalance?: '95000',  // Optional for mid-term loans
  annualRate: '5.5',           // Percentage (not decimal)
  termMonths: '360',
  originalTermMonths: '360',
  startMonthMonth: '01',       // 01-12
  startMonthYear: '2024',
  rateEffective?: 'current' | 'next'
}
```

## Test Coverage

Current test scenarios (based on TEST_PLAN.md Section 4.2):

### ✅ Loan Creation
- Create single loan with minimum fields
- Create multiple loans with different parameters
- Validation: negative principal
- Validation: zero principal
- Validation: invalid interest rate (>100%)
- Validation: zero term
- Validation: remaining balance exceeds principal

### ✅ Loan Editing
- Edit principal and verify stale banner
- Edit interest rate and verify stale banner
- Edit term months
- Cancel editing without saving

### ✅ Loan Deletion
- Delete loan after confirmation
- Cancel deletion
- Verify stale banner after deletion

### ✅ Balance Adjustment
- Adjust balance via quick edit
- Validation: negative balance
- Cancel adjustment

### ✅ UI Features
- Sort by different fields
- Toggle sort order
- Dismiss stale banner

## Best Practices

### 1. Use Page Objects
Always interact with the page through POM methods, not directly:

```typescript
// ✅ Good
await loansPage.createLoan(loanData);

// ❌ Bad
await page.click('[data-test="loans-add-button"]');
await page.fill('[data-test="loan-principal-input"]', '100000');
// ... etc
```

### 2. Use High-Level Flows
Use complete flow methods when appropriate:

```typescript
// ✅ Good - single method
await loansPage.createLoanAndVerify(loanData);

// ❌ Verbose - multiple steps
await loansPage.clickAddLoan();
await loansPage.editor.fillForm(loanData);
await loansPage.editor.submit();
await expect(loansPage.getLoanRows()).toHaveCount(1);
```

### 3. Consistent Waits
Use built-in wait methods, not arbitrary timeouts:

```typescript
// ✅ Good
await loansPage.editor.waitForVisible();

// ❌ Bad
await page.waitForTimeout(1000);
```

### 4. Descriptive Test Names
Use descriptive test names that clearly state what's being tested:

```typescript
// ✅ Good
test('should show validation error for negative principal', async () => {

// ❌ Bad
test('test 1', async () => {
```

### 5. Setup in beforeEach
Use `beforeEach` to set up common preconditions:

```typescript
test.beforeEach(async ({ page }) => {
  loansPage = new LoansPage(page);
  await loansPage.navigate();
  await loansPage.verifyPageLoaded();
});
```

### 6. Isolate Tests
Each test should be independent and not rely on other tests:

```typescript
// ✅ Good - creates its own data
test('should edit loan', async () => {
  await loansPage.createLoan(testData);
  await loansPage.editLoan(0);
  // ...
});

// ❌ Bad - depends on previous test
test('should edit loan', async () => {
  // Assumes loan exists from previous test
  await loansPage.editLoan(0);
  // ...
});
```

## Debugging Tips

### 1. Use Playwright Inspector
```bash
npx playwright test --debug
```

### 2. Use trace viewer
Traces are automatically recorded on first retry. View them:
```bash
npx playwright show-trace trace.zip
```

### 3. Take screenshots
```typescript
await loansPage.page.screenshot({ path: 'debug.png' });
```

### 4. Console log
```typescript
console.log(await loansPage.getLoanDisplayData(0));
```

### 5. Slow down execution
```bash
npx playwright test --headed --slow-mo 1000
```

## Next Steps

To add more test scenarios:

1. Create new POM classes for other pages (Dashboard, Settings, Wizard)
2. Add authentication setup in global setup
3. Add API helpers for test data setup
4. Add visual regression tests with `expect(page).toHaveScreenshot()`
5. Add performance tests
6. Set up CI/CD integration

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Page Object Model Pattern](https://playwright.dev/docs/pom)
- [Best Practices](https://playwright.dev/docs/best-practices)
- Project TEST_PLAN.md - Complete test scenarios
- DOCS/TEST_DATA_ATTRIBUTES_LOANS.md - Data-test attribute reference (deleted)

