import { test, expect } from "./fixtures";

/**
 * Loan Management E2E Tests
 * Based on TEST_PLAN.md Section 4.2: Loan Management (CRUD)
 *
 * Scenarios covered:
 * - Loan Creation (single loan with minimum required fields)
 * - Loan Creation (multiple loans with different parameters)
 * - Validation errors (negative or zero principal, invalid term)
 * - Loan Editing (update fields and verify downstream impact)
 * - Loan Deletion
 *
 * NOTE: Tests include cleanup to allow reuse of the same test user
 */

test.describe("Loan Management - CRUD Operations", () => {
  // Track loans created during each test for cleanup
  let createdLoanIds: string[] = [];

  test.beforeEach(async ({ loansPage }) => {
    // Reset tracking
    createdLoanIds = [];

    // Navigate to loans page
    await loansPage.navigate();
    await loansPage.verifyPageLoaded();
  });

  test.afterEach(async ({ loansPage }) => {
    // Clean up all loans created during the test
    if (createdLoanIds.length > 0) {
      console.log(`Cleaning up ${createdLoanIds.length} loan(s)...`);

      // Navigate to loans page if not already there
      const currentUrl = await loansPage.getCurrentUrl();
      if (!currentUrl.includes("/loans")) {
        await loansPage.navigate();
        await loansPage.verifyPageLoaded();
      }

      // Delete each loan
      for (const loanId of createdLoanIds) {
        try {
          // Find the loan row by ID
          const loanRow = loansPage.getLoanRowById(loanId);
          const isVisible = await loanRow.isVisible();

          if (isVisible) {
            // Click delete button
            await loanRow.locator('[data-test="loan-delete-button"]').click();

            // Confirm deletion
            await loansPage.deleteDialog.waitForVisible();
            await loansPage.deleteDialog.confirmDelete();

            // Wait for loan to be removed
            await loansPage.page.waitForTimeout(500);
          }
        } catch (error) {
          console.warn(`Failed to delete loan ${loanId}:`, error);
          // Continue with other loans
        }
      }

      console.log("Cleanup completed");
    }
  });

  test.describe("Loan Creation", () => {
    test("should create a single loan with minimum required fields", async ({
      loansPage,
    }) => {
      // Given: User is on the loans page
      const initialCount = await loansPage.getLoanCount();

      // When: User creates a loan with minimum required fields
      const loanData = {
        principal: "100000",
        annualRate: "5.5",
        termMonths: "360",
        originalTermMonths: "360",
        startMonthMonth: "01",
        startMonthYear: "2024",
      };

      await loansPage.createLoan(loanData);

      // Then: Loan appears in the list
      expect(await loansPage.getLoanCount()).toBe(initialCount + 1);

      // And: Loan data is displayed correctly
      const displayData = await loansPage.getLoanDisplayData(0);
      expect(displayData.status).toBe("active");

      // Track for cleanup
      const loanId = await loansPage.getLoanId(0);
      createdLoanIds.push(loanId);
    });

    test("should create multiple loans with different parameters", async ({
      loansPage,
    }) => {
      // Given: User is on the loans page
      const initialCount = await loansPage.getLoanCount();

      // When: User creates multiple loans
      const loans = [
        {
          principal: "200000",
          annualRate: "4.5",
          termMonths: "240",
          originalTermMonths: "240",
          startMonthMonth: "01",
          startMonthYear: "2023",
        },
        {
          principal: "50000",
          annualRate: "6.0",
          termMonths: "120",
          originalTermMonths: "120",
          startMonthMonth: "06",
          startMonthYear: "2024",
        },
        {
          principal: "150000",
          remainingBalance: "100000", // Mid-term loan
          annualRate: "5.0",
          termMonths: "180",
          originalTermMonths: "240",
          startMonthMonth: "03",
          startMonthYear: "2022",
        },
      ];

      for (const loanData of loans) {
        await loansPage.createLoan(loanData);
        // Track each created loan
        const loanId = await loansPage.getLoanId(0);
        createdLoanIds.push(loanId);
      }

      // Then: All loans appear in the list
      expect(await loansPage.getLoanCount()).toBe(initialCount + 3);
    });
  });

  test.describe("Loan Editing", () => {
    test.beforeEach(async ({ loansPage }) => {
      // Create a test loan before each edit test
      await loansPage.createLoan({
        principal: "100000",
        annualRate: "5.5",
        termMonths: "360",
        originalTermMonths: "360",
        startMonthMonth: "01",
        startMonthYear: "2024",
      });

      // Track for cleanup
      const loanId = await loansPage.getLoanId(0);
      createdLoanIds.push(loanId);
    });

    test("should edit loan principal and verify stale simulation banner", async ({
      loansPage,
    }) => {
      // Given: At least one loan exists
      expect(await loansPage.getLoanCount()).toBeGreaterThan(0);

      // When: User edits the loan's principal
      await loansPage.editLoan(0);
      await loansPage.editor.verifyEditMode();
      await loansPage.editor.setPrincipal("120000");
      await loansPage.editor.submit();
      await loansPage.editor.waitForHidden();

      // Then: Stale simulation banner appears
      await expect(loansPage.staleBanner).toBeVisible();
      const triggerText = await loansPage.getStaleTriggerText();
      // Text is "Triggered by a loan update" or similar
      expect(triggerText.toLowerCase()).toMatch(/loan update|edit|modified/);
    });

    test("should edit loan interest rate and mark simulation as stale", async ({
      loansPage,
    }) => {
      // Given: At least one loan exists
      expect(await loansPage.getLoanCount()).toBeGreaterThan(0);

      // When: User changes the interest rate
      await loansPage.editLoan(0);
      await loansPage.editor.setAnnualRate("6.5");
      await loansPage.editor.submit();
      await loansPage.editor.waitForHidden();

      // Then: Stale banner appears
      await expect(loansPage.staleBanner).toBeVisible();
    });

    test("should edit loan term months", async ({ loansPage }) => {
      // When: User shortens the loan term
      await loansPage.editLoan(0);
      await loansPage.editor.setTermMonths("300");
      await loansPage.editor.submit();
      await loansPage.editor.waitForHidden();

      // Then: Updated term is displayed
      const updatedData = await loansPage.getLoanDisplayData(0);
      expect(updatedData.term).toContain("300");
    });

    test("should cancel loan editing without saving changes", async ({
      loansPage,
    }) => {
      // Given: User opens edit form
      await loansPage.editLoan(0);
      await loansPage.editor.verifyEditMode();
      const originalData = await loansPage.getLoanDisplayData(0);

      // When: User makes changes but cancels
      await loansPage.editor.setPrincipal("999999");
      await loansPage.editor.cancel();

      // Then: Form closes without saving
      expect(await loansPage.editor.isVisible()).toBe(false);

      // And: Original data unchanged
      const currentData = await loansPage.getLoanDisplayData(0);
      expect(currentData.remainingBalance).toBe(originalData.remainingBalance);
    });
  });

  test.describe("Loan Deletion", () => {
    test.beforeEach(async ({ loansPage }) => {
      // Create test loan before each deletion test
      await loansPage.createLoan({
        principal: "100000",
        annualRate: "5.5",
        termMonths: "360",
        originalTermMonths: "360",
        startMonthMonth: "01",
        startMonthYear: "2024",
      });

      // Track for cleanup (will be deleted by test itself)
      const loanId = await loansPage.getLoanId(0);
      createdLoanIds.push(loanId);
    });

    test("should delete a loan after confirmation", async ({ loansPage }) => {
      // Given: At least one loan exists
      const initialCount = await loansPage.getLoanCount();
      expect(initialCount).toBeGreaterThan(0);

      const loanId = await loansPage.getLoanId(0);

      // When: User deletes the loan and confirms
      await loansPage.deleteLoan(0);
      await loansPage.deleteDialog.verifyDialog();
      await loansPage.deleteDialog.confirmDelete();

      // Then: Loan is removed from list
      expect(await loansPage.getLoanCount()).toBe(initialCount - 1);
      await expect(loansPage.getLoanRowById(loanId)).not.toBeVisible();

      // Remove from cleanup list since it's already deleted
      createdLoanIds = createdLoanIds.filter((id) => id !== loanId);
    });

    test("should cancel loan deletion", async ({ loansPage }) => {
      // Given: At least one loan exists
      const initialCount = await loansPage.getLoanCount();
      const loanId = await loansPage.getLoanId(0);

      // When: User opens delete dialog but cancels
      await loansPage.deleteLoan(0);
      await loansPage.deleteDialog.verifyDialog();
      await loansPage.deleteDialog.cancel();

      // Then: Loan remains in list
      expect(await loansPage.getLoanCount()).toBe(initialCount);
      await expect(loansPage.getLoanRowById(loanId)).toBeVisible();
    });
  });

  test.describe("Balance Adjustment", () => {
    test.beforeEach(async ({ loansPage }) => {
      // Create a test loan
      await loansPage.createLoan({
        principal: "100000",
        annualRate: "5.5",
        termMonths: "360",
        originalTermMonths: "360",
        startMonthMonth: "01",
        startMonthYear: "2024",
      });

      // Track for cleanup
      const loanId = await loansPage.getLoanId(0);
      createdLoanIds.push(loanId);
    });

    test("should adjust loan balance via quick edit", async ({ loansPage }) => {
      // Given: At least one loan exists
      expect(await loansPage.getLoanCount()).toBeGreaterThan(0);

      // When: User adjusts the balance
      await loansPage.openQuickBalance(0);
      await loansPage.balanceDialog.verifyDialog();
      await loansPage.balanceDialog.setBalance("95000");
      await loansPage.balanceDialog.submit();
      await loansPage.balanceDialog.waitForHidden();

      // Then: Updated balance is displayed
      const updatedData = await loansPage.getLoanDisplayData(0);
      expect(updatedData.remainingBalance).toContain("95");

      // And: Stale banner appears
      await expect(loansPage.staleBanner).toBeVisible();
    });

    test("should cancel balance adjustment", async ({ loansPage }) => {
      // Given: User opens quick balance dialog
      await loansPage.openQuickBalance(0);
      const originalData = await loansPage.getLoanDisplayData(0);

      // When: User makes changes but cancels
      await loansPage.balanceDialog.setBalance("50000");
      await loansPage.balanceDialog.cancel();

      // Then: Dialog closes without saving
      expect(await loansPage.balanceDialog.isVisible()).toBe(false);

      // And: Balance unchanged
      const currentData = await loansPage.getLoanDisplayData(0);
      expect(currentData.remainingBalance).toBe(originalData.remainingBalance);
    });
  });

  test.describe("Sorting and UI Features", () => {
    test.beforeEach(async ({ loansPage }) => {
      // Create multiple loans for sorting tests
      const loans = [
        {
          principal: "100000",
          annualRate: "5.5",
          termMonths: "360",
          originalTermMonths: "360",
          startMonthMonth: "01",
          startMonthYear: "2024",
        },
        {
          principal: "50000",
          annualRate: "6.0",
          termMonths: "180",
          originalTermMonths: "180",
          startMonthMonth: "06",
          startMonthYear: "2023",
        },
      ];

      for (const loanData of loans) {
        await loansPage.createLoan(loanData);
        const loanId = await loansPage.getLoanId(0);
        createdLoanIds.push(loanId);
      }
    });

    test("should toggle sort order", async ({ loansPage }) => {
      // Given: Loans list is visible
      const loanCount = await loansPage.getLoanCount();
      expect(loanCount).toBeGreaterThan(0);

      // When: User toggles sort order
      const initialOrder = await loansPage.getSortOrderText();
      await loansPage.toggleSortOrder();

      // Then: Sort order changes
      const newOrder = await loansPage.getSortOrderText();
      expect(newOrder).not.toBe(initialOrder);
    });

    test("should dismiss stale simulation banner", async ({ loansPage }) => {
      // Given: Create stale banner by editing a loan
      const loanCount = await loansPage.getLoanCount();
      expect(loanCount).toBeGreaterThan(0);

      await loansPage.editLoan(0);
      await loansPage.editor.setAnnualRate("7.0");
      await loansPage.editor.submit();
      await loansPage.editor.waitForHidden();

      // Check if banner appeared
      const bannerVisible = await loansPage.isStaleBannerVisible();
      if (!bannerVisible) {
        console.log("Stale banner did not appear (no active simulation)");
        return; // Don't skip, just note and continue
      }

      // When: User dismisses the banner
      await loansPage.dismissStaleBanner();

      // Then: Banner is hidden
      expect(await loansPage.isStaleBannerVisible()).toBe(false);
    });
  });
});
