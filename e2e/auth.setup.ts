import { test as setup, expect } from "@playwright/test";
import { AuthPage } from "./pages/AuthPage";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

/**
 * Global authentication setup for E2E tests
 * Authenticates once and stores session state to avoid repeated logins
 */

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authFile = path.join(__dirname, "../.auth/user.json");

// Read credentials from .env.test
const envTestPath = path.join(__dirname, "../.env.test");
let E2E_USERNAME = "";
let E2E_PASSWORD = "";

if (fs.existsSync(envTestPath)) {
  const envContent = fs.readFileSync(envTestPath, "utf-8");
  const envLines = envContent.split("\n");

  for (const line of envLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("E2E_USERNAME=")) {
      E2E_USERNAME = trimmed.split("=")[1]?.trim() ?? "";
    }
    if (trimmed.startsWith("E2E_PASSWORD=")) {
      E2E_PASSWORD = trimmed.split("=")[1]?.trim() ?? "";
    }
  }
}

if (!E2E_USERNAME || !E2E_PASSWORD) {
  throw new Error(
    "E2E_USERNAME and E2E_PASSWORD must be defined in .env.test file",
  );
}

setup("authenticate", async ({ page }) => {
  const authPage = new AuthPage(page);

  console.log("Starting authentication setup...");
  console.log(`Using credentials: ${E2E_USERNAME}`);

  // Navigate to sign-in page
  await authPage.navigateToSignIn();
  await authPage.verifySignInMode();

  console.log("Sign-in page loaded, submitting credentials...");

  // Perform sign-in
  await authPage.signIn(E2E_USERNAME, E2E_PASSWORD);

  console.log("Form submitted, waiting for redirect...");

  // Wait a bit for form submission
  await page.waitForTimeout(2000);

  // Check for errors before waiting for redirect
  const hasError = await authPage.hasErrorSummary();
  if (hasError) {
    const errorText = await authPage.getErrorSummaryText();
    console.error("Authentication failed with error:", errorText);

    // Check if it's a Supabase connection error
    if (errorText.includes("wrong") || errorText.includes("Network error")) {
      throw new Error(
        "❌ Authentication failed.\n" +
          "Common causes:\n" +
          "1. Supabase is not running - Run: npm run database:dev:start\n" +
          "2. Invalid credentials in .env.test\n" +
          "3. Test user does not exist - Create via /auth/signup\n" +
          `Error: ${errorText}`,
      );
    }
    throw new Error(`Authentication failed: ${errorText}`);
  }

  // Wait for successful redirect to dashboard
  await authPage.waitForSuccessfulAuth("/dashboard");
  await authPage.verifyAuthenticated();

  console.log("Successfully redirected to dashboard");

  // Verify we have a session by checking cookies or local storage
  const cookies = await page.context().cookies();
  const hasAuthCookie = cookies.some(
    (cookie) =>
      cookie.name.includes("session") ||
      cookie.name.includes("auth") ||
      cookie.name.includes("token"),
  );

  // If no auth cookie, check localStorage
  if (!hasAuthCookie) {
    const localStorage = await page.evaluate(() => {
      const keys = Object.keys(window.localStorage);
      return keys.some(
        (key) =>
          key.includes("session") ||
          key.includes("auth") ||
          key.includes("token"),
      );
    });

    expect(localStorage || hasAuthCookie).toBe(true);
  }

  // Save authenticated state
  await page.context().storageState({ path: authFile });

  console.log("✓ Authentication setup completed successfully");
});
