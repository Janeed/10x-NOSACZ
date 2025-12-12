# E2E Tests - Quick Start Guide

## ⚡ Fast Setup (Copy-Paste)

### Terminal Setup

Open **3 terminals** and run these commands:

#### Terminal 1: Supabase
```bash
npm run database:dev:start
```
**Wait for**: `✓ Started supabase local development setup`

#### Terminal 2: Dev Server
```bash
npm run dev
```
**Wait for**: `Local: http://localhost:3000/`

#### Terminal 3: Setup & Run Tests

```bash
# Create .env.test (replace with your credentials)
cat > .env.test << 'EOF'
E2E_USERNAME=test-user@example.com
E2E_PASSWORD=TestPassword123
EOF

# Create test user (one time only)
# Navigate to http://localhost:3000/auth/signup
# Create account with credentials from .env.test

# Install Playwright (one time only)
npx playwright install chromium

# Run tests
npm run test:e2e
```

## Expected Output

```
Running 1 test using 1 worker
  ✓ [setup] › auth.setup.ts:... authenticate (5s)
    Starting authentication setup...
    Using credentials: test-user@example.com
    Sign-in page loaded, submitting credentials...
    Form submitted, waiting for redirect...
    Successfully redirected to dashboard
    ✓ Authentication setup completed successfully

Running 28 tests using 1 worker
  ✓ loans.spec.ts:... should create a single loan (3s)
    Cleaning up 1 loan(s)...
    Cleanup completed
  ✓ loans.spec.ts:... should create multiple loans (8s)
    Cleaning up 3 loan(s)...
    Cleanup completed
  ... (26 more tests)

  28 passed (2m 15s)
```

## Common Errors

### ❌ "connect ECONNREFUSED 127.0.0.1:54321"

**Problem**: Supabase is not running

**Fix**: Start Supabase in Terminal 1
```bash
npm run database:dev:start
```

### ❌ "Connection refused: localhost:3000"

**Problem**: Dev server is not running

**Fix**: Start dev server in Terminal 2
```bash
npm run dev
```

### ❌ "Invalid email or password"

**Problem**: Test user doesn't exist

**Fix**: Create test user
```bash
# With dev server running (Terminal 2)
# Navigate to http://localhost:3000/auth/signup
# Create account with credentials from .env.test
```

## One-Line Check

Verify all services before running tests:

```bash
curl -f http://localhost:54321 >/dev/null 2>&1 && curl -f http://localhost:3000 >/dev/null 2>&1 && echo "✓ All services running" || echo "✗ Services not running"
```

## Running Tests

### All Tests
```bash
npm run test:e2e
```

### Specific Tests
```bash
# Loans only
npm run test:e2e:loans

# Auth only
npm run test:e2e:auth

# Setup only (for debugging)
npm run test:e2e:setup
```

### Interactive Mode
```bash
npm run test:e2e:ui
```

### See Browser
```bash
npm run test:e2e:headed
```

## Complete Checklist

Before running `npm run test:e2e`:

- [ ] Docker is running
- [ ] Supabase started (`npm run database:dev:start`)
- [ ] Dev server started (`npm run dev`)
- [ ] `.env.test` exists with valid credentials
- [ ] Test user account created
- [ ] Playwright installed (`npx playwright install chromium`)

Then:
```bash
npm run test:e2e
```

## Daily Workflow

### First Time Setup (Once)
1. Create `.env.test`
2. Create test user
3. Install Playwright

### Every Day
1. Start Supabase (Terminal 1)
2. Start Dev Server (Terminal 2)
3. Run Tests (Terminal 3)

### When Done
```bash
# Stop dev server (Ctrl+C in Terminal 2)
# Stop Supabase (Ctrl+C in Terminal 1, or)
npm run database:dev:stop
```

## Need Help?

- **Detailed setup**: [SETUP.md](./SETUP.md)
- **Running guide**: [RUN_TESTS.md](./RUN_TESTS.md)
- **Auth guide**: [AUTH_README.md](./AUTH_README.md)
- **Pre-flight check**: [PRE_FLIGHT_CHECK.md](./PRE_FLIGHT_CHECK.md)

