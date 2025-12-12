# Authentication in E2E Tests

This document explains how authentication is handled in the E2E test suite.

## Overview

The test suite uses **global authentication setup** to authenticate once and reuse the session across all tests. This significantly speeds up test execution by avoiding repeated login steps.

## Architecture

### 1. Global Setup (`auth.setup.ts`)

The authentication setup runs **once before all tests** as a separate project:

```typescript
// Runs once per test suite
setup('authenticate', async ({ page }) => {
  // 1. Navigate to sign-in page
  // 2. Enter credentials from .env.test
  // 3. Submit form and wait for redirect
  // 4. Save authenticated state to .auth/user.json
});
```

### 2. Authenticated Tests

All tests in the main project automatically use the authenticated state:

```typescript
test('my test', async ({ loansPage }) => {
  // Already authenticated!
  await loansPage.navigate();
  // ... rest of test
});
```

### 3. Authentication Tests

Tests that need to verify the authentication flow itself can opt out:

```typescript
test.describe('Authentication', () => {
  // Clear authentication state for these tests
  test.use({ storageState: { cookies: [], origins: [] } });
  
  test('should show validation error', async ({ authPage }) => {
    // Test runs without authentication
  });
});
```

## Setup Instructions

### 1. Create `.env.test` File

Copy the example file and fill in your test credentials:

```bash
cp .env.test.example .env.test
```

Edit `.env.test`:

```env
E2E_USERNAME=test-user@example.com
E2E_PASSWORD=TestPassword123
```

**Important**: 
- This test user must exist in your test database
- Use a dedicated test account, not a real user
- `.env.test` is gitignored for security

### 2. Create Test User

Before running tests, create a test user in your application:

**Option A: Via UI**
1. Start your dev server: `npm run dev`
2. Navigate to `/auth/signup`
3. Create an account with the credentials from `.env.test`

**Option B: Via Database**
```sql
-- Insert test user directly into Supabase
-- (adjust based on your auth setup)
```

**Option C: Via API**
```bash
# Use your API to create a test user
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test-user@example.com","password":"TestPassword123"}'
```

### 3. Run Tests

Once setup is complete, tests will automatically authenticate:

```bash
# Run all tests (includes auth setup)
npx playwright test

# Setup runs automatically, then all tests use the authenticated state
```

## How It Works

### Project Dependencies

In `playwright.config.ts`:

```typescript
projects: [
  // 1. Setup project runs first
  {
    name: 'setup',
    testMatch: /auth\.setup\.ts/,
  },
  // 2. Main tests use the authenticated state
  {
    name: 'chromium-desktop',
    use: {
      storageState: '.auth/user.json',  // ← Loads saved auth state
    },
    dependencies: ['setup'],  // ← Runs after setup completes
  },
],
```

### Execution Flow

```
1. Run setup project (auth.setup.ts)
   ├─ Navigate to /auth/signin
   ├─ Enter credentials from .env.test
   ├─ Submit form
   ├─ Wait for redirect to /dashboard
   └─ Save state to .auth/user.json

2. Run main tests (loans.spec.ts, etc.)
   ├─ Load state from .auth/user.json
   └─ All tests start already authenticated!
```

### State Storage

The authenticated state is stored in `.auth/user.json` and includes:

- **Cookies**: Session/auth tokens
- **Local Storage**: Client-side auth data
- **Session Storage**: Temporary session data

This file is:
- ✅ Created automatically during setup
- ✅ Gitignored (listed in `.gitignore`)
- ✅ Reused across test runs
- ✅ Regenerated if deleted

## Data-Test Attributes

### Auth Components

| Element | Selector |
|---------|----------|
| Auth form | `[data-test="auth-form"]` |
| Form mode | `[data-test="auth-form"][data-mode="signin\|signup"]` |
| Form title | `[data-test="auth-form-title"]` |
| Email input | `[data-test="auth-email-input"]` |
| Email error | `[data-test="auth-email-error"]` |
| Password input | `[data-test="auth-password-input"]` |
| Password error | `[data-test="auth-password-error"]` |
| Password toggle | `[data-test="auth-password-toggle"]` |
| Submit button | `[data-test="auth-submit-button"]` |
| Error summary | `[data-test="error-summary"]` |

## AuthPage POM

### Key Methods

```typescript
const authPage = new AuthPage(page);

// Navigation
await authPage.navigateToSignIn();
await authPage.navigateToSignUp();

// Form interaction
await authPage.setEmail('user@example.com');
await authPage.setPassword('password123');
await authPage.submit();

// Validation
await authPage.verifySignInMode();
await authPage.verifyAuthenticated();

// High-level flows
await authPage.signInAndWait(email, password);
await authPage.signUpAndWait(email, password);

// Error handling
const emailError = await authPage.getEmailError();
const hasError = await authPage.hasErrorSummary();
```

## Troubleshooting

### Issue: "E2E_USERNAME and E2E_PASSWORD must be defined"

**Solution**: Create `.env.test` file with valid credentials

```bash
cp .env.test.example .env.test
# Edit .env.test and add your credentials
```

### Issue: "Invalid email or password"

**Solution**: Ensure test user exists in database

```bash
# Create test user via signup page
npm run dev
# Navigate to http://localhost:3000/auth/signup
```

### Issue: Tests fail with "Not authenticated"

**Solution**: Delete `.auth/user.json` and re-run tests

```bash
rm -rf .auth/
npx playwright test
```

### Issue: Flaky authentication tests

**Solution**: Increase timeout or check network conditions

```typescript
test('my test', async ({ authPage }) => {
  await authPage.navigateToSignIn();
  // Increase timeout if needed
  await authPage.waitForSuccessfulAuth('/dashboard', { timeout: 15000 });
});
```

## Example Test Files

### Authenticated Test (loans.spec.ts)

```typescript
import { test, expect } from './fixtures';

test.describe('Loans', () => {
  test('should create loan', async ({ loansPage }) => {
    // Already authenticated! 
    await loansPage.navigate();
    await loansPage.createLoan({ ...loanData });
  });
});
```

### Authentication Test (auth.spec.ts)

```typescript
import { test, expect } from './fixtures';

test.describe('Authentication', () => {
  // Clear auth state for these tests
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should validate email', async ({ authPage }) => {
    await authPage.navigateToSignIn();
    await authPage.setEmail('invalid');
    await authPage.submit();
    await expect(authPage.emailError).toBeVisible();
  });
});
```

## Best Practices

### ✅ Do

- Use `.env.test` for test credentials
- Create dedicated test user accounts
- Let global setup handle authentication
- Use `test.use({ storageState: ... })` to opt out

### ❌ Don't

- Hardcode credentials in test files
- Use real user accounts for testing
- Manually log in in every test
- Commit `.env.test` or `.auth/` to git

## Security Notes

⚠️ **Important Security Considerations**:

1. **Never commit `.env.test`** - Contains real credentials
2. **Never commit `.auth/user.json`** - Contains session tokens
3. **Use test-only accounts** - Don't use real user data
4. **Separate test database** - Use different DB for E2E tests
5. **Rotate credentials** - Change test passwords regularly

## CI/CD Integration

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
      
      - name: Run E2E tests
        run: npx playwright test
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

Add secrets in GitHub repository settings:
- `E2E_USERNAME` - Test user email
- `E2E_PASSWORD` - Test user password

## Additional Resources

- [Playwright Authentication Guide](https://playwright.dev/docs/auth)
- [Playwright Global Setup](https://playwright.dev/docs/test-global-setup-teardown)
- [Playwright Projects](https://playwright.dev/docs/test-projects)

