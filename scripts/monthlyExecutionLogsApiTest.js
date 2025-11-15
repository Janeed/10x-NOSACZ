#!/usr/bin/env node

import { randomUUID } from "node:crypto";

const config = {
  baseUrl: process.env.API_BASE_URL ?? "http://localhost:3000",
  email: process.env.TEST_EMAIL ?? "nosacz.loans+test@example.com",
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
    console.log("[signup] account created");
  } catch (error) {
    if (error.response?.status === 409) {
      console.log("[signup] account already exists");
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

const createLoan = async (accessToken) => {
  const payload = {
    id: randomUUID(),
    principal: 100000,
    remainingBalance: 75000,
    annualRate: 0.045,
    termMonths: 300,
    originalTermMonths: 360,
    startMonth: "2024-01-01",
  };

  const { body } = await apiFetch("/api/loans", {
    method: "POST",
    body: JSON.stringify(payload),
    accessToken,
  });

  console.log("[loans] created", body.id);
  return body;
};

const createMonthlyExecutionLog = async (accessToken, loanId) => {
  const payload = {
    loanId,
    monthStart: "2025-10-01", // Past month
    paymentStatus: "pending",
    overpaymentStatus: "scheduled",
    scheduledOverpaymentAmount: 500.00,
  };

  const { body } = await apiFetch("/api/monthly-execution-logs", {
    method: "POST",
    body: JSON.stringify(payload),
    accessToken,
  });

  console.log("[monthly-execution-logs] created", body.id);
  return body;
};

const patchLogToSkip = async (accessToken, logId) => {
  const payload = {
    overpaymentStatus: "skipped",
    reasonCode: "Test skip for verification",
  };

  const { body } = await apiFetch(`/api/monthly-execution-logs/${logId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    accessToken,
  });

  console.log("[monthly-execution-logs] patched to skip", logId);
  return body;
};

const listLogs = async (accessToken, loanId) => {
  const { body } = await apiFetch(`/api/monthly-execution-logs?loanId=${loanId}&page=1&pageSize=10`, {
    accessToken,
  });
  console.log(`
[monthly-execution-logs] listing summary
---------------------------------------
items: ${body.items.length}
page: ${body.page}/${body.totalPages}
`);
  return body;
};

const main = async () => {
  try {
    await ensureAccount();
    const accessToken = await signin();

    const loan = await createLoan(accessToken);
    const log = await createMonthlyExecutionLog(accessToken, loan.id);

    // Patch to skip overpayment - should set staleSimulation: true
    const patchedLog = await patchLogToSkip(accessToken, log.id);

    if (patchedLog.staleSimulation !== true) {
      throw new Error("Expected staleSimulation to be true after skipping overpayment");
    }

    console.log("[monthly-execution-logs] verified staleSimulation flag set");

    await listLogs(accessToken, loan.id);

    console.log("\nMonthly Execution Logs API flow completed successfully.");
  } catch (error) {
    console.error("\nMonthly Execution Logs API flow failed:", error.message);
    if (error.body) {
      console.error("Error response body:", error.body);
    }
    process.exitCode = 1;
  }
};

await main();