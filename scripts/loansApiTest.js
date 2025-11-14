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

  const { response, body } = await apiFetch("/api/loans", {
    method: "POST",
    body: JSON.stringify(payload),
    accessToken,
  });

  const etag = response.headers.get("etag");
  if (!etag) {
    throw new Error("Loan creation did not return an ETag header");
  }

  console.log("[loans] created", body.id);
  return { loan: body, etag };
};

const fetchLoan = async (accessToken, loanId) => {
  const { response, body } = await apiFetch(`/api/loans/${loanId}`, {
    method: "GET",
    accessToken,
  });
  return { loan: body, etag: response.headers.get("etag") };
};

const updateLoan = async (accessToken, loanId, etag) => {
  const payload = {
    principal: 100000,
    remainingBalance: 70000,
    annualRate: 0.0425,
    termMonths: 295,
    originalTermMonths: 360,
    startMonth: "2024-01-01",
    isClosed: false,
    closedMonth: null,
  };

  const { response, body } = await apiFetch(`/api/loans/${loanId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    accessToken,
    headers: {
      "If-Match": etag,
    },
  });

  const nextEtag = response.headers.get("etag");
  if (!nextEtag) {
    throw new Error("Loan update did not return an ETag header");
  }

  console.log("[loans] updated", loanId);
  return { loan: body, etag: nextEtag };
};

const failOriginalTermChange = async (accessToken, loanId, etag) => {
  try {
    await apiFetch(`/api/loans/${loanId}`, {
      method: "PATCH",
      body: JSON.stringify({ originalTermMonths: 240 }),
      accessToken,
      headers: {
        "If-Match": etag,
      },
    });
    throw new Error("Expected originalTermMonths mutation to fail");
  } catch (error) {
    if (error.response?.status !== 400) {
      throw error;
    }
    console.log("[loans] originalTermMonths mutation rejected as expected");
  }
};

const deleteLoan = async (accessToken, loanId) => {
  await apiFetch(`/api/loans/${loanId}`, {
    method: "DELETE",
    accessToken,
    headers: {
      "X-Client-Confirmation": randomUUID(),
    },
  });
  console.log("[loans] deleted", loanId);
};

const ensureLoanGone = async (accessToken, loanId) => {
  try {
    await apiFetch(`/api/loans/${loanId}`, {
      method: "GET",
      accessToken,
    });
    throw new Error("Expected deleted loan to return 404");
  } catch (error) {
    if (error.response?.status !== 404) {
      throw error;
    }
    console.log("[loans] confirmed deletion", loanId);
  }
};

const listLoans = async (accessToken) => {
  const { body } = await apiFetch("/api/loans?page=1&pageSize=10", {
    accessToken,
  });
  console.log(`
[loans] listing summary
-----------------------
items: ${body.items.length}
page: ${body.page}/${body.totalPages}
`);
};

const main = async () => {
  try {
    await ensureAccount();
    const accessToken = await signin();

    await listLoans(accessToken);

    const { loan, etag } = await createLoan(accessToken);
    await fetchLoan(accessToken, loan.id);

    const updated = await updateLoan(accessToken, loan.id, etag);
    await failOriginalTermChange(accessToken, loan.id, updated.etag);

    await deleteLoan(accessToken, loan.id);
    await ensureLoanGone(accessToken, loan.id);

    console.log("\nLoan API flow completed successfully.");
  } catch (error) {
    console.error("\nLoan API flow failed:", error.message);
    if (error.body) {
      console.error("Error response body:", error.body);
    }
    process.exitCode = 1;
  }
};

await main();
