# Running E2E Tests - Complete Guide

## Prerequisites

Before running tests for the first time:

### 1. Create `.env.test` File

```bash
# In project root
cat > .env.test << 'EOF'
E2E_USERNAME=your-test-user@example.com
E2E_PASSWORD=YourTestPassword123
EOF
```

### 2. Create Test User

```bash
# Start dev server
npm run dev

# Navigate to http://localhost:3000/auth/signup
# Create account with credentials from .env.test
```

### 3. Install Playwright

```bash
# Install Playwright browsers (first time only)
npx playwright install chromium
```

## Running Tests

### Run All E2E Tests

```bash
# Run all tests in e2e/ directory
npx playwright test

# Or specifically
npx playwright test e2e/
```

**Expected Output:**
```
Running 1 test using 1 worker
  ✓  [setup] › auth.setup.ts:... authenticate (5s)

Running 28 tests using 1 worker
  ✓  loans.spec.ts:... should create a single loan (3s)
  ✓  loans.spec.ts:... should create multiple loans (8s)
  ... (18 more loan tests)
  ✓  auth.spec.ts:... should display sign-in form (2s)
  ... (7 more auth tests)

  28 passed (1m 45s)
```

### Run Only Loan Tests

```bash
npx playwright test e2e/loans.spec.ts
```

**Expected Output:**
```
Running 20 tests using 1 worker
  ✓  should create a single loan with minimum required fields (3s)
    Cleaning up 1 loan(s)...
    Cleanup completed
  ✓  should create multiple loans with different parameters (8s)
    Cleaning up 3 loan(s)...
    Cleanup completed
  ... (18 more tests)

  20 passed (1m 30s)
```

### Run Only Auth Tests

```bash
npx playwright test e2e/auth.spec.ts
```

### Run Specific Test

```bash
# By test name
npx playwright test -g "should create a single loan"

# Multiple tests
npx playwright test -g "validation"
```

### Run in Different Modes

#### UI Mode (Interactive)
```bash
npx playwright test --ui
```

**Features:**
- 🎯 Click tests to run them
- 👁️ Watch tests execute in browser
- 🔍 Inspect each step
- 🐛 Time-travel debugging

#### Headed Mode (See Browser)
```bash
npx playwright test --headed
```

Runs tests with visible browser window

#### Debug Mode
```bash
npx playwright test --debug
```

Opens Playwright Inspector for step-by-step debugging

#### Slow Motion
```bash
npx playwright test --headed --slow-mo 1000
```

Slows down test execution (1000ms between steps)

### Run with Different Reporters

#### List Reporter (Detailed)
```bash
npx playwright test --reporter=list
```

Shows each test as it runs

#### HTML Reporter
```bash
npx playwright test --reporter=html

# View report
npx playwright show-report
```

Generates interactive HTML report

#### JSON Reporter
```bash
npx playwright test --reporter=json
```

Outputs results as JSON

## Watching Tests Execute

### View Test Trace

If a test fails, view its trace:

```bash
# Run with trace on
npx playwright test --trace on

# Show last trace
npx playwright show-trace trace.zip
```

### Screenshots

Failed tests automatically capture screenshots in:
- `e2e/test-results/`

### Videos

Failed tests automatically record videos in:
- `e2e/test-results/`

## Test Output Examples

### Successful Test Run

```
$ npx playwright test e2e/loans.spec.ts

Running 20 tests using 1 worker

  Loan Management - CRUD Operations › Loan Creation
    ✓ should create a single loan with minimum required fields (2.5s)
      Cleaning up 1 loan(s)...
      Cleanup completed
    ✓ should create multiple loans with different parameters (7.8s)
      Cleaning up 3 loan(s)...
      Cleanup completed
    ✓ should show validation error for negative principal (1.9s)
    ✓ should show validation error for zero principal (1.7s)
    ✓ should show validation error for invalid interest rate (1.8s)
    ✓ should show validation error for zero term (1.6s)
    ✓ should show validation error when remaining balance exceeds principal (2.1s)

  Loan Management - CRUD Operations › Loan Editing
    ✓ should edit loan principal and verify stale simulation banner (3.2s)
      Cleaning up 1 loan(s)...
      Cleanup completed
    ... (more tests)

  20 passed (1m 32s)
```

### Failed Test Example

```
$ npx playwright test e2e/loans.spec.ts

Running 20 tests using 1 worker

  Loan Management - CRUD Operations › Loan Creation
    ✓ should create a single loan (2.5s)
    ✗ should create multiple loans (timeout)

  1) should create multiple loans ────────────────────────────────────

    Test timeout of 30000ms exceeded.

    Call log:
      - loansPage.navigate() @ loans.spec.ts:45
      - loansPage.createLoan(...) @ loans.spec.ts:52
      - loansPage.editor.fillForm(...) [pending]

  1 failed
    loans.spec.ts:... should create multiple loans
  19 passed (1m 45s)
```

**Check**:
- `test-results/` folder for screenshots/videos
- Increase timeout if needed: `test.setTimeout(60000)`

## Configuration

### Environment Variables

Create `.env.test` (already done in setup):
```env
E2E_USERNAME=test-user@example.com
E2E_PASSWORD=TestPassword123
```

### Playwright Config

Located in `playwright.config.ts`:

```typescript
{
  testDir: './e2e',
  timeout: 30_000,          // Test timeout
  expect: { timeout: 5_000 }, // Assertion timeout
  retries: 0,               // No retries locally
  workers: 1,               // Sequential execution
}
```

## Troubleshooting

### Issue: "E2E_USERNAME and E2E_PASSWORD must be defined"

**Solution**: Create `.env.test` file
```bash
cp .env.test.example .env.test
# Edit with your credentials
```

### Issue: "Invalid email or password"

**Solution**: Create test user account
```bash
npm run dev
# Navigate to /auth/signup and create account
```

### Issue: "Connection refused"

**Solution**: Start dev server
```bash
# Terminal 1
npm run dev

# Terminal 2
npx playwright test
```

### Issue: Tests are slow

**Solution**: Run in parallel (careful with cleanup!)
```bash
# Edit playwright.config.ts
workers: 2  # Instead of 1

# Or via command
npx playwright test --workers=2
```

**Note**: Parallel execution may interfere with cleanup

### Issue: "Element not found"

**Solution**: Increase timeout or check selectors
```bash
# Run with more time
npx playwright test --timeout=60000

# Or in headed mode to see what's happening
npx playwright test --headed
```

### Issue: Cleanup warnings

**Solution**: This is normal! Cleanup logs show:
```
⚠ Failed to delete loan abc123: Element not found
```

This usually means the loan was already deleted by the test.

## Continuous Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps chromium
      
      - name: Create .env.test
        run: |
          echo "E2E_USERNAME=${{ secrets.E2E_USERNAME }}" >> .env.test
          echo "E2E_PASSWORD=${{ secrets.E2E_PASSWORD }}" >> .env.test
      
      - name: Start dev server
        run: npm run dev &
        
      - name: Wait for server
        run: npx wait-on http://localhost:3000
      
      - name: Run E2E tests
        run: npx playwright test
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## Quick Reference

| Command | Description |
|---------|-------------|
| `npx playwright test` | Run all tests |
| `npx playwright test --ui` | Interactive UI mode |
| `npx playwright test --headed` | See browser |
| `npx playwright test --debug` | Step-by-step debug |
| `npx playwright test loans.spec.ts` | Run specific file |
| `npx playwright test -g "create"` | Run matching tests |
| `npx playwright show-report` | View HTML report |
| `npx playwright codegen localhost:3000` | Record new tests |

## Test Logs

### Enable Verbose Logging

```bash
DEBUG=pw:api npx playwright test
```

### Console Logs from Tests

Tests output cleanup information:
```
Cleaning up 1 loan(s)...
Cleanup completed
```

This confirms automatic cleanup is working.

## Performance Tips

1. **Run specific tests** during development
2. **Use `--ui` mode** for debugging
3. **Keep test user clean** - cleanup handles this
4. **Watch cleanup logs** for issues
5. **Increase timeout** for slow networks

## Summary

✅ **Setup**: `.env.test` + test user + Playwright install  
✅ **Run**: `npx playwright test`  
✅ **Debug**: `npx playwright test --ui`  
✅ **Cleanup**: Automatic after each test  
✅ **CI/CD**: GitHub Actions ready  

For more details:
- Setup: `e2e/SETUP.md`
- Cleanup: `e2e/TEST_CLEANUP.md`
- Authentication: `e2e/AUTH_README.md`

