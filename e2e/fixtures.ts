import { test as base } from "@playwright/test";
import { LoansPage } from "./pages/LoansPage";
import { AuthPage } from "./pages/AuthPage";

/**
 * Extended test fixtures with page objects pre-initialized
 * This allows tests to use page objects without manual initialization
 *
 * Authentication is handled via global setup (auth.setup.ts)
 * which stores the authenticated state in .auth/user.json
 */
interface TestFixtures {
  loansPage: LoansPage;
  authPage: AuthPage;
}

/**
 * Extended test with custom fixtures
 * Usage in tests:
 *
 * test('my test', async ({ loansPage }) => {
 *   await loansPage.navigate();
 *   // ... rest of test
 * });
 *
 * For auth tests:
 * test('auth test', async ({ authPage }) => {
 *   await authPage.navigateToSignIn();
 *   // ... rest of test
 * });
 */
export const test = base.extend<TestFixtures>({
  loansPage: async ({ page }, use) => {
    const loansPage = new LoansPage(page);
    await use(loansPage);
  },
  authPage: async ({ page }, use) => {
    const authPage = new AuthPage(page);
    await use(authPage);
  },
});

export { expect } from "@playwright/test";
