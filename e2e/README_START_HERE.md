# E2E Tests - START HERE 🚀

## ⚡ Quick Start (3 Steps)

### Step 1: Start Services (2 Terminals)

**Terminal 1 - Supabase:**
```bash
npm run database:dev:start
```
Wait for: `✓ Started supabase local development setup`

**Terminal 2 - Dev Server:**
```bash
npm run dev
```
Wait for: `Local: http://localhost:3000/`

### Step 2: Setup Credentials (One Time Only)

```bash
# Create .env.test
cat > .env.test << 'EOF'
E2E_USERNAME=test-user@example.com
E2E_PASSWORD=TestPassword123
EOF

# Create test user account
# Navigate to: http://localhost:3000/auth/signup
# Use credentials from .env.test
```

### Step 3: Run Tests

**Terminal 3:**
```bash
npm run test:e2e
```

**Expected output:**
```
✓ [setup] authenticate (5s)
✓ 28 tests passed (2m)
```

---

## 🆘 Getting Errors?

### Error: "ECONNREFUSED 127.0.0.1:54321"

**Problem:** Supabase is not running

**Fix:**
```bash
# Terminal 1:
npm run database:dev:start
```

### Error: "TimeoutError: page.waitForURL"

**Problem:** Authentication failed

**Fix:**
1. Make sure Supabase is running (see above)
2. Make sure Dev Server is running: `npm run dev`
3. Create test user at `http://localhost:3000/auth/signup`

### Error: "E2E_USERNAME must be defined"

**Problem:** Missing `.env.test` file

**Fix:**
```bash
cat > .env.test << 'EOF'
E2E_USERNAME=test-user@example.com
E2E_PASSWORD=TestPassword123
EOF
```

---

## 📚 Documentation

### For First-Time Setup:
- **[QUICK_START.md](./QUICK_START.md)** - Copy-paste commands
- **[SETUP.md](./SETUP.md)** - Detailed setup guide

### For Running Tests:
- **[RUN_TESTS.md](./RUN_TESTS.md)** - How to run tests
- **[PRE_FLIGHT_CHECK.md](./PRE_FLIGHT_CHECK.md)** - Pre-test checklist

### For Troubleshooting:
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Error solutions
- **[ERROR_FIXES_SUMMARY.md](./ERROR_FIXES_SUMMARY.md)** - Recent fixes

### For Understanding:
- **[AUTH_README.md](./AUTH_README.md)** - Authentication setup
- **[TEST_CLEANUP.md](./TEST_CLEANUP.md)** - Cleanup strategy
- **[FINAL_SUMMARY.md](./FINAL_SUMMARY.md)** - Complete overview

---

## ✅ Pre-Flight Checklist

Before running tests, verify:

- [ ] Docker is running
- [ ] Supabase started: `curl http://localhost:54321`
- [ ] Dev server started: `curl http://localhost:3000`
- [ ] `.env.test` exists with credentials
- [ ] Test user account created

---

## 🎯 Test Commands

```bash
# Run all tests
npm run test:e2e

# Run specific suites
npm run test:e2e:loans
npm run test:e2e:auth

# Run with browser visible
npm run test:e2e:headed

# Interactive mode
npm run test:e2e:ui
```

---

## 🔧 Daily Workflow

### Every Day:
1. Start Supabase (Terminal 1)
2. Start Dev Server (Terminal 2)
3. Run Tests (Terminal 3)

### When Done:
```bash
# Stop dev server: Ctrl+C in Terminal 2
# Stop Supabase:
npm run database:dev:stop
```

---

## 📊 What's Tested

- ✅ **Loan Creation** (8 tests) - Create loans, validation
- ✅ **Loan Editing** (4 tests) - Edit loans, stale detection
- ✅ **Loan Deletion** (3 tests) - Delete loans, cleanup
- ✅ **Balance Adjustment** (4 tests) - Quick balance edits
- ✅ **Sorting** (4 tests) - Sort by different fields
- ✅ **Pagination** (3 tests) - Navigate pages
- ✅ **Error Handling** (2 tests) - Retry, error display

**Total: 28 tests**

---

## 🚨 Most Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `ECONNREFUSED 54321` | Supabase not running | `npm run database:dev:start` |
| `ECONNREFUSED 3000` | Dev server not running | `npm run dev` |
| Auth timeout | Services not ready | Start Supabase + Dev Server |
| Missing credentials | No `.env.test` | Create `.env.test` file |

---

## 💡 Tips

1. **Keep services running** - Don't restart between test runs
2. **Use UI mode for debugging** - `npm run test:e2e:ui`
3. **Check screenshots on failure** - Look in `test-results/`
4. **Run single test** - `npx playwright test -g "test name"`

---

## 🎓 Architecture

### Page Object Model (POM)
Tests use POM pattern for maintainability:
- `e2e/pages/LoansPage.ts` - Loans page interactions
- `e2e/pages/AuthPage.ts` - Authentication interactions
- `e2e/pages/LoanEditorSidebar.ts` - Loan form interactions
- `e2e/pages/LoanDeleteConfirmDialog.ts` - Delete confirmation
- `e2e/pages/LoanBalanceQuickEditDialog.ts` - Balance editing

### Authentication
- Global setup in `e2e/auth.setup.ts`
- Runs once before all tests
- Saves session to `.auth/user.json`
- Reused across all test runs

### Cleanup
- Automatic cleanup after each test
- Tracks created loans via `createdLoanIds`
- Deletes all test data in `afterEach` hook
- Ensures clean state for next test

---

## 🏁 Ready to Start?

1. **First time?** Read [QUICK_START.md](./QUICK_START.md)
2. **Having issues?** Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
3. **Want details?** See [FINAL_SUMMARY.md](./FINAL_SUMMARY.md)

**Or just run:**
```bash
# Terminal 1
npm run database:dev:start

# Terminal 2
npm run dev

# Terminal 3
npm run test:e2e
```

Good luck! 🎉

