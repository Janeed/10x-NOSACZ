import { type Page, type Locator, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * Page Object Model for Loan Delete Confirmation Dialog
 * Handles confirmation dialog for loan deletion
 */
export class LoanDeleteConfirmDialog extends BasePage {
  readonly dialog: Locator;
  readonly title: Locator;
  readonly loanId: Locator;
  readonly errorMessage: Locator;
  readonly cancelButton: Locator;
  readonly confirmButton: Locator;

  constructor(page: Page) {
    super(page);

    this.dialog = this.getByTestId("loan-delete-dialog");
    this.title = this.getByTestId("loan-delete-title");
    this.loanId = this.getByTestId("loan-delete-id");
    this.errorMessage = this.getByTestId("loan-delete-error");
    this.cancelButton = this.getByTestId("loan-delete-cancel-button");
    this.confirmButton = this.getByTestId("loan-delete-confirm-button");
  }

  /**
   * Wait for dialog to be visible
   */
  async waitForVisible(): Promise<void> {
    await this.dialog.waitFor({ state: "visible" });
  }

  /**
   * Wait for dialog to be hidden
   */
  async waitForHidden(): Promise<void> {
    await this.dialog.waitFor({ state: "hidden" });
  }

  /**
   * Check if dialog is visible
   */
  async isVisible(): Promise<boolean> {
    return await this.dialog.isVisible();
  }

  /**
   * Get dialog title text
   */
  async getTitle(): Promise<string> {
    return (await this.title.textContent()) ?? "";
  }

  /**
   * Get displayed loan ID
   */
  async getLoanId(): Promise<string> {
    return (await this.loanId.textContent()) ?? "";
  }

  /**
   * Get error message if visible
   */
  async getErrorMessage(): Promise<string> {
    if (!(await this.errorMessage.isVisible())) {
      return "";
    }
    return (await this.errorMessage.textContent()) ?? "";
  }

  /**
   * Check if error message is visible
   */
  async hasError(): Promise<boolean> {
    return await this.errorMessage.isVisible();
  }

  /**
   * Click cancel button
   */
  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.waitForHidden();
  }

  /**
   * Click confirm button to delete loan
   */
  async confirmDelete(): Promise<void> {
    await this.confirmButton.click();
    await this.waitForHidden();
  }

  /**
   * Check if confirm button is disabled
   */
  async isConfirmDisabled(): Promise<boolean> {
    return await this.confirmButton.isDisabled();
  }

  /**
   * Verify dialog is shown with correct loan ID
   */
  async verifyDialog(expectedLoanId?: string): Promise<void> {
    await expect(this.dialog).toBeVisible();
    await expect(this.title).toContainText("Delete loan");
    if (expectedLoanId) {
      await expect(this.loanId).toContainText(expectedLoanId);
    }
  }

  /**
   * Complete flow: Confirm deletion
   */
  async deleteAndConfirm(): Promise<void> {
    await this.confirmDelete();
  }

  /**
   * Complete flow: Cancel deletion
   */
  async cancelDeletion(): Promise<void> {
    await this.cancel();
  }
}
