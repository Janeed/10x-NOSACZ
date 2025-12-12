# E2E Tests - Pre-Flight Checklist

Before running E2E tests, ensure all services are running. This checklist helps diagnose common issues.

## ✅ Pre-Flight Checklist

### 1. Supabase Database

**Required**: Supabase must be running for authentication and data persistence.

```bash
# Start Supabase
npm run database:dev:start

# Or directly
supabase start
```

**Verify Supabase is running:**
```bash
supabase status
```

**Expected output:**
```
supabase local development setup is running.

         API URL: http://localhost:54321
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
...
```

**Common issues:**
- ❌ Port 54321-54323 already in use
- ❌ Docker not running
- ❌ Supabase not initialized

**Solutions:**
```bash
# Stop other Supabase instances
supabase stop

# Start fresh
supabase start

# Check Docker is running
docker ps
```

### 2. Development Server

**Required**: Astro dev server must be running for tests to access the application.

```bash
# Start dev server (in a separate terminal)
npm run dev
```

**Verify dev server is running:**
```bash
curl http://localhost:3000
```

**Expected**: HTML response (not connection refused)

### 3. Test Credentials

**Required**: `.env.test` file with valid credentials.

```bash
# Check file exists
cat .env.test

# Should show:
# E2E_USERNAME=your-test-user@example.com
# E2E_PASSWORD=YourTestPassword123
```

**If missing:**
```bash
cat > .env.test << 'EOF'
E2E_USERNAME=test-user@example.com
E2E_PASSWORD=TestPassword123
EOF
```

### 4. Test User Exists

**Required**: The test user from `.env.test` must exist in the database.

**Verify:**
```bash
# Start services
npm run database:dev:start
npm run dev

# Navigate to http://localhost:3000/auth/signin
# Try logging in with credentials from .env.test
```

**If login fails:**
```bash
# Create test user via signup page
# Navigate to http://localhost:3000/auth/signup
# Create account with credentials from .env.test
```

### 5. Playwright Installed

**Required**: Playwright browsers must be installed.

```bash
# Install if needed
npx playwright install chromium
```

## Quick Pre-Flight Check

Run this in your terminal:

```bash
#!/bin/bash

echo "🔍 E2E Pre-Flight Check"
echo "======================="

# Check 1: Supabase
echo -n "1. Supabase running... "
if curl -s http://localhost:54321 > /dev/null 2>&1; then
  echo "✓"
else
  echo "✗ NOT RUNNING"
  echo "   Run: npm run database:dev:start"
fi

# Check 2: Dev server
echo -n "2. Dev server running... "
if curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "✓"
else
  echo "✗ NOT RUNNING"
  echo "   Run: npm run dev"
fi

# Check 3: .env.test
echo -n "3. .env.test exists... "
if [ -f .env.test ]; then
  echo "✓"
else
  echo "✗ NOT FOUND"
  echo "   Create .env.test with E2E_USERNAME and E2E_PASSWORD"
fi

# Check 4: Playwright
echo -n "4. Playwright installed... "
if npx playwright --version > /dev/null 2>&1; then
  echo "✓"
else
  echo "✗ NOT INSTALLED"
  echo "   Run: npx playwright install chromium"
fi

echo ""
echo "======================="
echo "Ready to run tests? npm run test:e2e"
```

Save as `e2e-preflight.sh` and run:
```bash
chmod +x e2e-preflight.sh
./e2e-preflight.sh
```

## Running Tests (Correct Order)

### Terminal 1: Start Supabase

```bash
npm run database:dev:start
```

**Wait for output:**
```
✓ Started supabase local development setup.

         API URL: http://localhost:54321
...
```

### Terminal 2: Start Dev Server

```bash
npm run dev
```

**Wait for output:**
```
✓ astro-dev-server
  Local:    http://localhost:3000/
```

### Terminal 3: Run Tests

```bash
# Run all tests
npm run test:e2e

# Or specific tests
npm run test:e2e:loans
npm run test:e2e:auth
```

## Common Error Messages

### Error: "connect ECONNREFUSED 127.0.0.1:54321"

**Cause**: Supabase is not running

**Solution**:
```bash
# Terminal 1
npm run database:dev:start

# Wait for "Started supabase local development setup"
```

### Error: "ECONNREFUSED localhost:3000"

**Cause**: Dev server is not running

**Solution**:
```bash
# Terminal 2
npm run dev

# Wait for "Local: http://localhost:3000/"
```

### Error: "Invalid email or password"

**Cause**: Test user doesn't exist or wrong credentials

**Solution**:
```bash
# Verify credentials in .env.test
cat .env.test

# Create test user
npm run dev
# Navigate to http://localhost:3000/auth/signup
```

### Error: "E2E_USERNAME and E2E_PASSWORD must be defined"

**Cause**: `.env.test` file missing

**Solution**:
```bash
cat > .env.test << 'EOF'
E2E_USERNAME=test-user@example.com
E2E_PASSWORD=TestPassword123
EOF
```

## Automated Startup Script

Create a helper script `run-e2e-tests.sh`:

```bash
#!/bin/bash

set -e

echo "🚀 Starting E2E Test Environment"
echo "================================"

# Check if Supabase is running
if ! curl -s http://localhost:54321 > /dev/null 2>&1; then
  echo "❌ Supabase is not running"
  echo "Please start Supabase in a separate terminal:"
  echo "  npm run database:dev:start"
  exit 1
fi
echo "✓ Supabase is running"

# Check if dev server is running
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "❌ Dev server is not running"
  echo "Please start dev server in a separate terminal:"
  echo "  npm run dev"
  exit 1
fi
echo "✓ Dev server is running"

# Check .env.test
if [ ! -f .env.test ]; then
  echo "❌ .env.test file not found"
  echo "Please create .env.test with E2E_USERNAME and E2E_PASSWORD"
  exit 1
fi
echo "✓ .env.test exists"

echo ""
echo "================================"
echo "🧪 Running E2E Tests"
echo "================================"
echo ""

# Run tests
npx playwright test "$@"
```

**Usage:**
```bash
chmod +x run-e2e-tests.sh
./run-e2e-tests.sh
```

## Quick Reference

| Service | Command | Port | Check |
|---------|---------|------|-------|
| Supabase | `npm run database:dev:start` | 54321 | `curl localhost:54321` |
| Dev Server | `npm run dev` | 3000 | `curl localhost:3000` |
| Tests | `npm run test:e2e` | - | - |

## Complete Startup Sequence

```bash
# Terminal 1: Supabase (leave running)
npm run database:dev:start

# Terminal 2: Dev Server (leave running)  
npm run dev

# Terminal 3: Run Tests
npm run test:e2e
```

## Stopping Services

```bash
# Stop dev server
# Ctrl+C in Terminal 2

# Stop Supabase
npm run database:dev:stop
# or
supabase stop
```

## Docker Requirement

Supabase requires Docker to be running:

```bash
# Start Docker Desktop (macOS)
open -a Docker

# Verify Docker is running
docker ps
```

If Docker is not installed:
- macOS: Install [Docker Desktop](https://www.docker.com/products/docker-desktop)
- Linux: Install Docker Engine

## Summary

**Before running tests:**
1. ✅ Start Supabase: `npm run database:dev:start`
2. ✅ Start Dev Server: `npm run dev`
3. ✅ Create `.env.test` with credentials
4. ✅ Create test user account

**Then run:**
```bash
npm run test:e2e
```

**Expected output:**
```
✓ [setup] authenticate (5s)
✓ 28 tests passed (2m)
```

