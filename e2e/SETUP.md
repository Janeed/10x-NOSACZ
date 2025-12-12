# E2E Test Setup Guide

## Quick Start (5 minutes)

## Prerequisites

**IMPORTANT**: Before running tests, you need:

1. ✅ **Docker** - Running (required by Supabase)
2. ✅ **Supabase** - Local instance running
3. ✅ **Dev Server** - Astro server running
4. ✅ **Test User** - Account created
5. ✅ **Credentials** - `.env.test` file configured

### Step 0: Start Required Services

**Terminal 1 - Start Supabase:**
```bash
npm run database:dev:start
```

Wait for:
```
✓ Started supabase local development setup.
         API URL: http://localhost:54321
```

**Terminal 2 - Start Dev Server:**
```bash
npm run dev
```

Wait for:
```
✓ astro-dev-server
  Local:    http://localhost:3000/
```

Keep both terminals running!

### Step 1: Create Test User

**Option A - Via UI** (Recommended)
```bash
# Start your dev server
npm run dev

# Navigate to http://localhost:3000/auth/signup
# Create an account with email and password
```

**Option B - Via Database**
```sql
-- Use your database tool to create a test user
-- (specific SQL depends on your auth setup)
```

### Step 2: Create `.env.test` File

Create a file named `.env.test` in the **project root** (same level as `package.json`):

```env
E2E_USERNAME=your-test-user@example.com
E2E_PASSWORD=YourTestPassword123
```

Replace with the credentials from Step 1.

**Important**: 
- ✅ Use the exact credentials from your test user
- ✅ File must be named `.env.test` (not `.env.test.txt`)
- ✅ File must be in project root, not in `e2e/` folder

### Step 3: Install Playwright

```bash
# Install Playwright browsers (if not already done)
npx playwright install chromium
```

### Step 4: Verify Setup

**Make sure all services are running:**

```bash
# Check Supabase (should return JSON)
curl http://localhost:54321

# Check dev server (should return HTML)
curl http://localhost:3000
```

### Step 5: Run Tests

**Terminal 3 - Run Tests:**
```bash
npm run test:e2e
```

You should see:
```
Running 1 test using 1 worker
  ✓  [setup] › auth.setup.ts:... authenticate (5s)

Running 20 tests using 1 worker
  ✓  loans.spec.ts:... should create a single loan (2s)
  ...
```

## Troubleshooting

### Error: "connect ECONNREFUSED 127.0.0.1:54321"

**Cause**: Supabase is not running

**Solution**:
```bash
# Terminal 1: Start Supabase
npm run database:dev:start

# Wait for "Started supabase local development setup"
# Then re-run tests in Terminal 3
```

### Error: "TimeoutError: page.waitForURL: Timeout exceeded"

**Cause**: Authentication failed, page didn't redirect

**Common Causes**:
1. Supabase not running
2. Dev server not running
3. Invalid credentials
4. Test user doesn't exist

**Solution**:
```bash
# Check all services are running
curl http://localhost:54321  # Supabase (should work)
curl http://localhost:3000   # Dev server (should work)

# Verify credentials
cat .env.test

# Try manual login
# Navigate to http://localhost:3000/auth/signin
# Use credentials from .env.test
```

### Error: "E2E_USERNAME and E2E_PASSWORD must be defined"

**Problem**: The `.env.test` file doesn't exist or isn't in the right location.

**Solution**:
```bash
# Make sure you're in the project root
cd /path/to/10x-NOSACZ

# Create the file
cat > .env.test << 'EOF'
E2E_USERNAME=your-test-user@example.com
E2E_PASSWORD=YourTestPassword123
EOF

# Verify it exists
ls -la .env.test
```

### Error: "Invalid email or password"

**Problem**: The test user doesn't exist in the database.

**Solution**: Create the test user via the signup page or database.

### Error: "Network error" or "Connection refused"

**Problem**: Dev server isn't running.

**Solution**:
```bash
# Start dev server in a separate terminal
npm run dev

# Then run tests in another terminal
npx playwright test
```

### Tests are flaky or timing out

**Problem**: Slow network or system performance.

**Solution**: Increase timeout in `playwright.config.ts`:
```typescript
timeout: 60_000, // Increase to 60 seconds
```

## File Structure

After setup, your project should look like:

```
10x-NOSACZ/
├── .env.test              ← YOU CREATE THIS
├── .auth/                 ← AUTO-CREATED BY TESTS
│   └── user.json          ← AUTO-CREATED
├── e2e/
│   ├── auth.setup.ts
│   ├── auth.spec.ts
│   ├── loans.spec.ts
│   └── ...
├── package.json
└── playwright.config.ts
```

## Example `.env.test` Content

```env
# E2E Test Credentials
E2E_USERNAME=test@example.com
E2E_PASSWORD=TestPassword123
```

That's it! Copy-paste the above, replacing with your actual test credentials.

## Security Checklist

Before committing code:

- [ ] `.env.test` is NOT committed (check .gitignore)
- [ ] `.auth/` folder is NOT committed
- [ ] Test user has no access to real user data
- [ ] Test credentials are documented in team wiki/docs

## Next Steps

Once setup is complete:

1. ✅ Run all tests: `npx playwright test`
2. ✅ Run specific tests: `npx playwright test loans.spec.ts`
3. ✅ Run in UI mode: `npx playwright test --ui`
4. ✅ Debug tests: `npx playwright test --debug`

See [README.md](./README.md) for complete documentation.

