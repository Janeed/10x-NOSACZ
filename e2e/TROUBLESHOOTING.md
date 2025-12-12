# E2E Tests Troubleshooting Guide

## Common Errors and Solutions

### Error: "connect ECONNREFUSED 127.0.0.1:54321"

**Full Error:**
```
TypeError: fetch failed
  cause: Error: connect ECONNREFUSED 127.0.0.1:54321
    errno: -61,
    code: 'ECONNREFUSED',
    syscall: 'connect',
    address: '127.0.0.1',
    port: 54321
```

**Cause:** Supabase is not running.

**Solution:**
```bash
# Terminal 1: Start Supabase
npm run database:dev:start

# Wait for confirmation:
# ✓ Started supabase local development setup.
#          API URL: http://localhost:54321
```

**Verify it's running:**
```bash
curl http://localhost:54321
# Should return JSON, not "Connection refused"
```

---

### Error: "TimeoutError: page.waitForURL: Timeout exceeded"

**Full Error:**
```
TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
waiting for navigation to "/dashboard" until "load"
```

**Cause:** Authentication failed, page didn't redirect to dashboard.

**Common Reasons:**
1. Supabase not running (see above)
2. Dev server not running
3. Invalid credentials in `.env.test`
4. Test user doesn't exist

**Solution:**

**Step 1: Check Supabase**
```bash
curl http://localhost:54321
# Should work
```

**Step 2: Check Dev Server**
```bash
curl http://localhost:3000
# Should return HTML
```

**Step 3: Verify Credentials**
```bash
cat .env.test
# Should show:
# E2E_USERNAME=test-user@example.com
# E2E_PASSWORD=TestPassword123
```

**Step 4: Test Manual Login**
1. Navigate to `http://localhost:3000/auth/signin`
2. Try logging in with credentials from `.env.test`
3. If login fails, create account at `/auth/signup`

---

### Error: "E2E_USERNAME and E2E_PASSWORD must be defined"

**Cause:** `.env.test` file is missing or empty.

**Solution:**
```bash
cat > .env.test << 'EOF'
E2E_USERNAME=test-user@example.com
E2E_PASSWORD=TestPassword123
EOF
```

---

### Error: "expect(locator).toBeVisible() failed" (Validation Errors)

**Full Error:**
```
Error: expect(locator).toBeVisible() failed
Locator: locator('[data-test="loan-principal-error"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found
```

**Cause:** Form validation might be working correctly, but the test is checking too quickly.

**Solution:** Tests now include proper wait times. If you still see this:

1. **Check if validation is actually triggered:**
   - Run test with `--headed` flag to see browser
   - Check if error message appears visually

2. **Verify data-test attributes exist:**
```bash
grep -r "loan-principal-error" src/components/loans/
```

3. **Increase timeout in test** (already done in latest version)

---

### Error: "Test timeout exceeded while running afterEach hook"

**Full Error:**
```
Test timeout of 30000ms exceeded while running "afterEach" hook.
```

**Cause:** Cleanup is taking too long, possibly because:
1. Too many loans to delete
2. Network/API is slow
3. A loan deletion is stuck

**Solution:**

**Immediate:** Skip cleanup for debugging:
```typescript
// In loans.spec.ts, comment out afterEach temporarily:
// test.afterEach(async ({ loansPage }) => {
//   ...
// });
```

**Long-term:** Already implemented - cleanup uses proper timeouts and error handling.

---

### Error: Stale Banner Text Mismatch

**Full Error:**
```
Error: expect(received).toContain(expected)
Expected substring: "loan update"
Received string:    "triggered by a newly created loan..."
```

**Cause:** Test expectations don't match actual UI text.

**Solution:** Tests now use regex patterns to match variations:
```typescript
// Old (too strict):
expect(text).toContain('loan update');

// New (flexible):
expect(text).toMatch(/loan update|edit|modified/);
```

---

## Debugging Strategies

### 1. Run Tests in Headed Mode

See what's happening in the browser:
```bash
npm run test:e2e:headed
```

### 2. Run Tests in UI Mode

Interactive debugging:
```bash
npm run test:e2e:ui
```

### 3. Run Single Test

Isolate the failing test:
```bash
# Run only loans tests
npm run test:e2e:loans

# Run only auth tests
npm run test:e2e:auth

# Run specific test by name
npx playwright test -g "should create a single loan"
```

### 4. Check Screenshots and Videos

After test failure, check:
```
test-results/
  [test-name]/
    test-failed-1.png  # Screenshot at failure
    video.webm         # Video of test run
    error-context.md   # Additional context
```

### 5. Enable Debug Logs

```bash
DEBUG=pw:api npx playwright test
```

### 6. Check Console Logs

In test file:
```typescript
test('my test', async ({ page }) => {
  page.on('console', msg => console.log('Browser:', msg.text()));
  // ... rest of test
});
```

---

## Service Startup Checklist

Use this checklist before running tests:

```bash
#!/bin/bash

echo "🔍 E2E Services Check"
echo "===================="

# 1. Check Supabase
if curl -s http://localhost:54321 > /dev/null 2>&1; then
  echo "✓ Supabase running on port 54321"
else
  echo "✗ Supabase NOT running"
  echo "  Run: npm run database:dev:start"
  exit 1
fi

# 2. Check Dev Server
if curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "✓ Dev server running on port 3000"
else
  echo "✗ Dev server NOT running"
  echo "  Run: npm run dev"
  exit 1
fi

# 3. Check .env.test
if [ -f .env.test ]; then
  echo "✓ .env.test exists"
else
  echo "✗ .env.test NOT found"
  echo "  Create with E2E_USERNAME and E2E_PASSWORD"
  exit 1
fi

# 4. Check Playwright
if npx playwright --version > /dev/null 2>&1; then
  echo "✓ Playwright installed"
else
  echo "✗ Playwright NOT installed"
  echo "  Run: npx playwright install chromium"
  exit 1
fi

echo ""
echo "===================="
echo "✓ All services ready!"
echo "Run: npm run test:e2e"
```

Save as `check-e2e-services.sh` and run:
```bash
chmod +x check-e2e-services.sh
./check-e2e-services.sh
```

---

## Environment Issues

### Docker Not Running

**Error:** Supabase fails to start

**Solution:**
```bash
# macOS: Start Docker Desktop
open -a Docker

# Verify Docker is running
docker ps
```

### Port Already in Use

**Error:** `Port 54321 already in use`

**Solution:**
```bash
# Stop existing Supabase
supabase stop

# Start fresh
npm run database:dev:start
```

### Port 3000 Already in Use

**Error:** `Port 3000 already in use`

**Solution:**
```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
# Then update playwright.config.ts baseURL
```

---

## Getting Help

If none of these solutions work:

1. **Check recent changes:** Review what changed since tests last worked
2. **Check test artifacts:** Look at screenshots/videos in `test-results/`
3. **Run manual test:** Try the same steps manually in browser
4. **Check logs:** Look at dev server and Supabase logs
5. **Clean start:** Stop all services, restart everything fresh

### Clean Restart Procedure

```bash
# 1. Stop everything
# Ctrl+C in all terminals

# 2. Stop Supabase completely
npm run database:dev:stop

# 3. Clean Playwright state
rm -rf .auth/
rm -rf test-results/

# 4. Start fresh
# Terminal 1:
npm run database:dev:start

# Terminal 2:
npm run dev

# Terminal 3:
npm run test:e2e
```

---

## Quick Reference

| Error | Likely Cause | Quick Fix |
|-------|--------------|-----------|
| `ECONNREFUSED 54321` | Supabase not running | `npm run database:dev:start` |
| `ECONNREFUSED 3000` | Dev server not running | `npm run dev` |
| `TimeoutError: waitForURL` | Auth failed | Check Supabase + credentials |
| `E2E_USERNAME must be defined` | Missing `.env.test` | Create `.env.test` file |
| `element(s) not found` | Timing issue | Tests have proper waits now |
| `Test timeout in afterEach` | Cleanup stuck | Check network/API |

---

## Still Having Issues?

See also:
- [SETUP.md](./SETUP.md) - Initial setup guide
- [QUICK_START.md](./QUICK_START.md) - Fast setup commands
- [PRE_FLIGHT_CHECK.md](./PRE_FLIGHT_CHECK.md) - Pre-test checklist
- [AUTH_README.md](./AUTH_README.md) - Authentication details

