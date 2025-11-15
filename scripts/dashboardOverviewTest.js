#!/usr/bin/env node

import { randomUUID } from "node:crypto";

const config = {
  baseUrl: process.env.API_BASE_URL ?? "http://localhost:3000",
  email: process.env.TEST_EMAIL ?? "nosacz.dashboard+test@example.com",
  password: process.env.TEST_PASSWORD ?? "Password123!",
};

const apiFetch = async (path, { accessToken, ...options } = {}) => {
  const url = `${config.baseUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  const rawBody = await response.text();
  let parsedBody = null;
  try {
    parsedBody = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    parsedBody = rawBody;
  }

  if (!response.ok) {
    const error = new Error(`Request failed with status ${response.status}`);
    error.response = response;
    error.body = parsedBody;
    throw error;
  }

  return { response, body: parsedBody };
};

const ensureAccount = async () => {
  try {
    await apiFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        email: config.email,
        password: config.password,
      }),
    });
    console.log("[auth] account created");
  } catch (error) {
    if (error.response?.status === 409) {
      console.log("[auth] account already exists");
      return;
    }
    throw error;
  }
};

const signin = async () => {
  const { body } = await apiFetch("/api/auth/signin", {
    method: "POST",
    body: JSON.stringify({
      email: config.email,
      password: config.password,
    }),
  });

  const token = body?.session?.accessToken;
  if (!token) {
    throw new Error("Signin response missing access token");
  }

  console.log("[auth] signed in");
  return token;
};

const updateUserSettings = async (accessToken) => {
  const payload = {
    monthlyOverpaymentLimit: 2000.00,
    reinvestReducedPayments: true,
  };

  await apiFetch("/api/user-settings", {
    method: "PUT",
    body: JSON.stringify(payload),
    accessToken,
  });

  console.log("[user-settings] updated");
};

const createLoan = async (accessToken, loanData) => {
  const payload = {
    id: randomUUID(),
    principal: loanData.principal || 200000,
    remainingBalance: loanData.remainingBalance || 180000,
    annualRate: loanData.annualRate || 0.045,
    termMonths: loanData.termMonths || 300,
    originalTermMonths: loanData.originalTermMonths || 360,
    startMonth: loanData.startMonth || "2024-01-01",
  };

  const { body } = await apiFetch("/api/loans", {
    method: "POST",
    body: JSON.stringify(payload),
    accessToken,
  });

  console.log(`[loans] created loan ${body.id} with balance $${payload.remainingBalance}`);
  return body;
};

const createSimulation = async (accessToken) => {
  const payload = {
    strategy: "balanced",
    goal: "fastest_payoff",
    monthlyOverpaymentLimit: 2000.00,
    paymentReductionTarget: 500.00,
    reinvestReducedPayments: true,
  };

  const { body } = await apiFetch("/api/simulations", {
    method: "POST",
    body: JSON.stringify(payload),
    accessToken,
  });

  console.log(`[simulations] created simulation ${body.simulationId}`);
  return body;
};

const activateSimulation = async (accessToken, simulationId) => {
  const { body } = await apiFetch(`/api/simulations/${simulationId}/activate`, {
    method: "POST",
    accessToken,
  });

  console.log(`[simulations] activated simulation ${simulationId}`);
  return body;
};

const createMonthlyExecutionLog = async (accessToken, loanId, monthStart = "2025-11-01") => {
  const payload = {
    loanId,
    monthStart,
    paymentStatus: "paid",
    overpaymentStatus: "executed",
    scheduledOverpaymentAmount: 500.00,
    actualOverpaymentAmount: 500.00,
    interestPortion: 675.00,
    principalPortion: 1208.33,
    remainingBalanceAfter: 178291.67,
  };

  const { body } = await apiFetch("/api/monthly-execution-logs", {
    method: "POST",
    body: JSON.stringify(payload),
    accessToken,
  });

  console.log(`[monthly-execution-logs] created log for ${monthStart}`);
  return body;
};

const testDashboardOverview = async (accessToken, include = "") => {
  const url = include ? `/api/dashboard/overview?include=${include}` : "/api/dashboard/overview";

  console.log(`[dashboard] testing ${url}`);
  const { body } = await apiFetch(url, {
    method: "GET",
    accessToken,
  });

  console.log("[dashboard] response received");
  console.log("Active Simulation:", body.activeSimulation ? "✅ Present" : "❌ Missing");
  console.log(`Loans: ${body.loans?.length || 0}`);
  console.log("Current Month:", body.currentMonth ? "✅ Present" : "❌ Missing");
  console.log("Graphs:", body.graphs ? "✅ Present" : "❌ Missing");
  console.log("Adherence:", body.adherence ? "✅ Present" : "❌ Missing");

  if (body.loans?.length > 0) {
    console.log("Sample loan data:");
    console.log(`  - Remaining Balance: $${body.loans[0].remainingBalance}`);
    console.log(`  - Monthly Payment: $${body.loans[0].monthlyPayment?.toFixed(2)}`);
    console.log(`  - Progress: ${(body.loans[0].progress * 100)?.toFixed(1)}%`);
  }

  if (body.currentMonth?.entries?.length > 0) {
    console.log("Current month entries:", body.currentMonth.entries.length);
  }

  if (body.adherence) {
    console.log(`Adherence Ratio: ${(body.adherence.ratio * 100)?.toFixed(1)}%`);
  }

  return body;
};

const main = async () => {
  try {
    console.log("🚀 Setting up test data for Dashboard Overview API\n");

    // 1. Ensure account exists and sign in
    await ensureAccount();
    const accessToken = await signin();

    // 2. Update user settings
    await updateUserSettings(accessToken);

    // 3. Create multiple loans for meaningful dashboard data
    console.log("\n📊 Creating loans...");
    const loan1 = await createLoan(accessToken, {
      principal: 250000,
      remainingBalance: 220000,
      annualRate: 0.042,
      termMonths: 280,
      originalTermMonths: 360,
    });

    const loan2 = await createLoan(accessToken, {
      principal: 150000,
      remainingBalance: 120000,
      annualRate: 0.048,
      termMonths: 240,
      originalTermMonths: 300,
    });

    // 4. Create and activate a simulation
    console.log("\n🎯 Creating and activating simulation...");
    const simulation = await createSimulation(accessToken);
    await activateSimulation(accessToken, simulation.simulationId);

    // 5. Create some monthly execution logs for current month data
    console.log("\n📅 Creating monthly execution logs...");
    const currentDate = new Date();
    const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`;

    await createMonthlyExecutionLog(accessToken, loan1.id, currentMonth);
    await createMonthlyExecutionLog(accessToken, loan2.id, currentMonth);

    // 6. Test the dashboard overview
    console.log("\n📈 Testing Dashboard Overview API...\n");

    // Test without includes
    console.log("=== Testing without includes ===");
    await testDashboardOverview(accessToken);

    // Test with monthly trend
    console.log("\n=== Testing with monthlyTrend include ===");
    await testDashboardOverview(accessToken, "monthlyTrend");

    // Test with interest breakdown
    console.log("\n=== Testing with interestBreakdown include ===");
    await testDashboardOverview(accessToken, "interestBreakdown");

    // Test with both includes
    console.log("\n=== Testing with both includes ===");
    await testDashboardOverview(accessToken, "monthlyTrend,interestBreakdown");

    console.log("\n✅ Dashboard Overview API test completed successfully!");
    console.log("\n💡 Test data created:");
    console.log(`   - User: ${config.email}`);
    console.log(`   - Loans: 2 ($${loan1.remainingBalance} + $${loan2.remainingBalance})`);
    console.log("   - Active simulation: ✅");
    console.log("   - Monthly logs: ✅ (current month)");
    console.log("\n🔄 You can run this script again to recreate test data");

  } catch (error) {
    console.error("\n❌ Dashboard test setup failed:", error.message);
    if (error.body) {
      console.error("Error response body:", error.body);
    }
    process.exitCode = 1;
  }
};

await main();