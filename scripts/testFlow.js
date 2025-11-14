#!/usr/bin/env node

const config = {
  baseUrl: "http://localhost:3000",
  email: "nosacz.user+test@example.com",
  password: "Password123!",
  isNewUser: true,
};

const apiFetch = async (path, options = {}) => {
  const url = `${config.baseUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
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

const signup = async () => {
  console.log("Attempting signup...");
  try {
    const { body } = await apiFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        email: config.email,
        password: config.password,
      }),
    });
    console.log("Signup succeeded:", body);
  } catch (error) {
    if (error.response?.status === 409) {
      console.log("Signup skipped: account already exists.");
      return;
    }
    throw error;
  }
};

const signin = async () => {
  console.log("Signing in...");
  const { body } = await apiFetch("/api/auth/signin", {
    method: "POST",
    body: JSON.stringify({
      email: config.email,
      password: config.password,
    }),
  });

  if (!body?.session?.accessToken) {
    throw new Error("Signin response missing access token");
  }

  console.log("Signin succeeded.");
  return body.session.accessToken;
};

const randomOverpaymentLimit = () => {
  const value = Number((Math.random() * 5000).toFixed(2));
  return Math.max(value, 0);
};

const updateUserSettings = async (accessToken) => {
  const payload = {
    monthlyOverpaymentLimit: randomOverpaymentLimit(),
    reinvestReducedPayments: Math.random() >= 0.5,
  };

  console.log("Updating user settings with payload:", payload);

  const { response, body } = await apiFetch("/api/user-settings", {
    method: "PUT",
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  console.log("User settings updated:", body);
  const etag = response.headers.get("etag");
  if (etag) {
    console.log("Received ETag:", etag);
  }
};

const fetchUserSettings = async (accessToken) => {
  console.log("Fetching user settings...");
  const { body } = await apiFetch("/api/user-settings", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  console.log("Current user settings:", body);
};

const main = async () => {
  try {
    if (config.isNewUser) {
      await signup();
    }

    const accessToken = await signin();
    await updateUserSettings(accessToken);
    await fetchUserSettings(accessToken);
    console.log("Test flow completed successfully.");
  } catch (error) {
    console.error("Test flow failed:", error.message);
    if (error.body) {
      console.error("Error body:", error.body);
    }
    process.exitCode = 1;
  }
};

main();
