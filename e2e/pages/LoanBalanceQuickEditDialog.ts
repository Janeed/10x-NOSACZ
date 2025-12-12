import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object Model for Loan Balance Quick Edit Dialog
 * Handles quick balance adjustment dialog
 */
export class LoanBalanceQuickEditDialog extends BasePage {
  readonly dialog: Locator;
  readonly title: Locator;
  readonly form: Locator;
  readonly balanceInput: Locator;
  readonly fieldError: Locator;
  readonly generalError: Locator;
  readonly cancelButton: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);

    this.dialog = this.getByTestId('loan-quick-balance-dialog');
    this.title = this.getByTestId('loan-quick-balance-title');
    this.form = this.getByTestId('loan-quick-balance-form');
    this.balanceInput = this.getByTestId('loan-quick-balance-input');
    this.fieldError = this.getByTestId('loan-quick-balance-field-error');
    this.generalError = this.getByTestId('loan-quick-balance-error');
    this.cancelButton = this.getByTestId('loan-quick-balance-cancel-button');
    this.submitButton = this.getByTestId('loan-quick-balance-submit-button');
  }

  /**
   * Wait for dialog to be visible
   */
  async waitForVisible(): Promise<void> {
    await this.dialog.waitFor({ state: 'visible' });
  }

  /**
   * Wait for dialog to be hidden
   */
  async waitForHidden(): Promise<void> {
    await this.dialog.waitFor({ state: 'hidden' });
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
    return await this.title.textContent() ?? '';
  }

  /**
   * Get current balance input value
   */
  async getBalanceValue(): Promise<string> {
    return await this.balanceInput.inputValue();
  }

  /**
   * Set new balance value
   */
  async setBalance(value: string): Promise<void> {
    // For negative values (validation tests), use JavaScript to bypass HTML5 min attribute
    if (value.startsWith('-')) {
      await this.balanceInput.evaluate((el: HTMLInputElement, val: string) => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        nativeInputValueSetter?.call(el, val);
        const inputEvent = new Event('input', { bubbles: true });
        el.dispatchEvent(inputEvent);
        const changeEvent = new Event('change', { bubbles: true });
        el.dispatchEvent(changeEvent);
      }, value);
      await this.page.waitForTimeout(200);
    } else {
      await this.balanceInput.fill(value);
    }
  }

  /**
   * Get field error message
   */
  async getFieldError(): Promise<string> {
    if (!await this.fieldError.isVisible()) {
      return '';
    }
    return await this.fieldError.textContent() ?? '';
  }

  /**
   * Get general error message
   */
  async getGeneralError(): Promise<string> {
    if (!await this.generalError.isVisible()) {
      return '';
    }
    return await this.generalError.textContent() ?? '';
  }

  /**
   * Check if any error is visible
   */
  async hasError(): Promise<boolean> {
    return await this.fieldError.isVisible() || await this.generalError.isVisible();
  }

  /**
   * Click cancel button
   */
  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.waitForHidden();
  }

  /**
   * Click submit button
   */
  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  /**
   * Check if submit button is disabled
   */
  async isSubmitDisabled(): Promise<boolean> {
    return await this.submitButton.isDisabled();
  }

  /**
   * Verify dialog is shown
   */
  async verifyDialog(): Promise<void> {
    await expect(this.dialog).toBeVisible();
    await expect(this.title).toContainText('Adjust');
  }

  /**
   * Complete flow: Set balance and submit
   */
  async setBalanceAndSubmit(value: string): Promise<void> {
    await this.setBalance(value);
    await this.submit();
    await this.waitForHidden();
  }

  /**
   * Complete flow: Set balance and expect error
   */
  async setBalanceAndExpectError(value: string): Promise<void> {
    await this.setBalance(value);
    await this.submit();
    // Wait for error to appear
    await this.page.waitForTimeout(500);
    const hasError = await this.hasError();
    expect(hasError).toBe(true);
  }

  /**
   * Complete flow: Cancel balance adjustment
   */
  async cancelAdjustment(): Promise<void> {
    await this.cancel();
  }
}

