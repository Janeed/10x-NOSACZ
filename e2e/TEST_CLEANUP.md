# Test Cleanup Strategy

## Overview

The E2E test suite implements **automatic cleanup** after each test to ensure tests can be run repeatedly with the same user account without accumulating test data.

## Why Cleanup?

Since we're reusing the same test user account and don't have a proper database reset mechanism yet, we need to:

1. ✅ Clean up loans created during tests
2. ✅ Ensure tests start with a clean state
3. ✅ Allow tests to run repeatedly
4. ✅ Use the tested delete functionality for cleanup

## How It Works

### Tracking Created Loans

```typescript
// Track loans created during each test
let createdLoanIds: string[] = [];

test.beforeEach(async ({ loansPage }) => {
  // Reset tracking
  createdLoanIds = [];
  // ... navigation
});
```

### Recording Loan Creation

Every time a test creates a loan, we track its ID:

```typescript
test('create loan', async ({ loansPage }) => {
  await loansPage.createLoan(loanData);
  
  // Track for cleanup
  const loanId = await loansPage.getLoanId(0);
  createdLoanIds.push(loanId);
});
```

### Automatic Cleanup

After each test, we delete all tracked loans:

```typescript
test.afterEach(async ({ loansPage }) => {
  if (createdLoanIds.length > 0) {
    console.log(`Cleaning up ${createdLoanIds.length} loan(s)...`);
    
    for (const loanId of createdLoanIds) {
      try {
        const loanRow = loansPage.getLoanRowById(loanId);
        if (await loanRow.isVisible()) {
          await loanRow.locator('[data-test="loan-delete-button"]').click();
          await loansPage.deleteDialog.confirmDelete();
        }
      } catch (error) {
        console.warn(`Failed to delete loan ${loanId}:`, error);
      }
    }
    
    console.log('Cleanup completed');
  }
});
```

## Test Structure

### Loan Creation Tests

```typescript
test('create single loan', async ({ loansPage }) => {
  // Create loan
  await loansPage.createLoan(loanData);
  
  // Track for cleanup
  const loanId = await loansPage.getLoanId(0);
  createdLoanIds.push(loanId);
  
  // Verify creation
  expect(await loansPage.getLoanCount()).toBeGreaterThan(0);
  
  // Cleanup happens automatically in afterEach
});
```

### Loan Deletion Tests

For tests that delete loans, we remove them from the cleanup list:

```typescript
test('delete loan', async ({ loansPage }) => {
  // Create loan (tracked)
  await loansPage.createLoan(loanData);
  const loanId = await loansPage.getLoanId(0);
  createdLoanIds.push(loanId);
  
  // Delete loan (test functionality)
  await loansPage.deleteLoan(0);
  await loansPage.deleteDialog.confirmDelete();
  
  // Remove from cleanup since already deleted
  createdLoanIds = createdLoanIds.filter(id => id !== loanId);
  
  // Verify deletion
  await expect(loansPage.getLoanRowById(loanId)).not.toBeVisible();
});
```

### Loan Editing Tests

Editing doesn't create new loans, so we still track the original:

```typescript
test.describe('Loan Editing', () => {
  test.beforeEach(async ({ loansPage }) => {
    // Create test loan
    await loansPage.createLoan(loanData);
    
    // Track for cleanup
    const loanId = await loansPage.getLoanId(0);
    createdLoanIds.push(loanId);
  });

  test('edit loan', async ({ loansPage }) => {
    // Edit existing loan
    await loansPage.editLoan(0);
    await loansPage.editor.setPrincipal('120000');
    await loansPage.editor.submit();
    
    // Cleanup happens automatically
  });
});
```

## Error Handling

The cleanup includes error handling to ensure partial failures don't block subsequent tests:

```typescript
try {
  // Delete loan
  await loanRow.locator('[data-test="loan-delete-button"]').click();
  await loansPage.deleteDialog.confirmDelete();
} catch (error) {
  console.warn(`Failed to delete loan ${loanId}:`, error);
  // Continue with other loans
}
```

## Benefits

✅ **Repeatable Tests** - Run tests multiple times without accumulation  
✅ **Clean State** - Each test starts fresh  
✅ **No Manual Cleanup** - Automatic after each test  
✅ **Uses Real Functionality** - Tests the delete feature  
✅ **Robust** - Error handling for partial failures  
✅ **Visible** - Console logs show cleanup progress  

## Running Tests

### Run All Tests

```bash
npx playwright test e2e/loans.spec.ts
```

You'll see cleanup logs:
```
Cleaning up 1 loan(s)...
Cleanup completed
```

### Run Specific Test

```bash
npx playwright test e2e/loans.spec.ts -g "should create a single loan"
```

### Watch for Cleanup Issues

```bash
npx playwright test e2e/loans.spec.ts --reporter=list
```

Look for cleanup warnings:
```
⚠ Failed to delete loan abc123: Error: Element not found
```

## Troubleshooting

### Issue: Cleanup logs show failures

**Problem**: Some loans couldn't be deleted during cleanup

**Possible Causes**:
1. Loan was already deleted by the test
2. Network issue during cleanup
3. Page navigation issue

**Solution**: Check if loans are accumulating by running:
```bash
# Start dev server and manually check loans page
npm run dev
# Navigate to http://localhost:3000/loans
```

### Issue: Tests fail saying "loan not found"

**Problem**: Test expects a loan that doesn't exist

**Cause**: Previous test cleanup failed

**Solution**: Manually delete all loans through UI, then re-run tests

### Issue: Cleanup is slow

**Problem**: Many loans being cleaned up

**Cause**: Cleanup from failed tests accumulating

**Solution**: This is normal! The cleanup is working. Let it finish.

## Best Practices

### ✅ Do

- Always track created loans with `createdLoanIds.push(loanId)`
- Remove from tracking when test deletes the loan
- Let cleanup run even if test fails
- Check console logs for cleanup status

### ❌ Don't

- Skip tracking created loans
- Forget to remove deleted loans from tracking
- Ignore cleanup warnings
- Disable cleanup (unless debugging)

## Future Improvements

When proper teardown is implemented, consider:

1. **Database Reset** - Truncate tables between test runs
2. **API Cleanup** - Delete via API instead of UI
3. **Test Isolation** - Each test gets fresh database
4. **Fixtures** - Database fixtures for known states

## Example Test Run

```bash
$ npx playwright test e2e/loans.spec.ts

Running 20 tests using 1 worker

  ✓ should create a single loan with minimum required fields (3s)
    Cleaning up 1 loan(s)...
    Cleanup completed
  
  ✓ should create multiple loans with different parameters (8s)
    Cleaning up 3 loan(s)...
    Cleanup completed
  
  ✓ should show validation error for negative principal (2s)
    Cleaning up 0 loan(s)...
  
  ✓ should edit loan principal and verify stale simulation banner (4s)
    Cleaning up 1 loan(s)...
    Cleanup completed

  ... (more tests)

  20 passed (1m 35s)
```

## Verification

To verify cleanup is working:

1. **Run tests**: `npx playwright test e2e/loans.spec.ts`
2. **Check UI**: Navigate to http://localhost:3000/loans
3. **Expected**: No test loans remaining
4. **If loans exist**: Check console for cleanup warnings

## Summary

The cleanup strategy ensures:
- ✅ Tests can run repeatedly with same user
- ✅ No test data accumulation
- ✅ Clean state for each test
- ✅ Uses tested delete functionality
- ✅ Handles errors gracefully
- ✅ Provides visibility via console logs

This temporary solution works well until proper database teardown is implemented.

