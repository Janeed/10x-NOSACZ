import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export interface LoanFormData {
  principal?: string;
  remainingBalance?: string;
  annualRate?: string;
  termMonths?: string;
  originalTermMonths?: string;
  startMonthMonth?: string;
  startMonthYear?: string;
  rateEffective?: 'current' | 'next';
}

/**
 * Page Object Model for Loan Editor Sidebar (Create/Edit)
 * Handles form interactions for creating and editing loans
 */
export class LoanEditorSidebar extends BasePage {
  // Container and navigation
  readonly sidebar: Locator;
  readonly title: Locator;
  readonly closeButton: Locator;
  readonly form: Locator;

  // Form inputs
  readonly principalInput: Locator;
  readonly principalError: Locator;
  readonly remainingBalanceInput: Locator;
  readonly remainingBalanceError: Locator;
  readonly annualRateInput: Locator;
  readonly annualRateError: Locator;
  readonly termMonthsInput: Locator;
  readonly termMonthsError: Locator;
  readonly originalTermMonthsInput: Locator;
  readonly originalTermMonthsError: Locator;
  readonly startMonthMonthSelect: Locator;
  readonly startMonthYearSelect: Locator;
  readonly startMonthError: Locator;

  // Rate effective controls
  readonly rateEffectiveCurrentRadio: Locator;
  readonly rateEffectiveNextRadio: Locator;
  readonly rateEffectiveError: Locator;

  // Form actions
  readonly generalError: Locator;
  readonly cancelButton: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);

    // Initialize locators
    this.sidebar = this.getByTestId('loan-editor-sidebar');
    this.title = this.getByTestId('loan-editor-title');
    this.closeButton = this.getByTestId('loan-editor-close-button');
    this.form = this.getByTestId('loan-editor-form');

    this.principalInput = this.getByTestId('loan-principal-input');
    this.principalError = this.getByTestId('loan-principal-error');
    this.remainingBalanceInput = this.getByTestId('loan-remaining-balance-input');
    this.remainingBalanceError = this.getByTestId('loan-remaining-balance-error');
    this.annualRateInput = this.getByTestId('loan-annual-rate-input');
    this.annualRateError = this.getByTestId('loan-annual-rate-error');
    this.termMonthsInput = this.getByTestId('loan-term-months-input');
    this.termMonthsError = this.getByTestId('loan-term-months-error');
    this.originalTermMonthsInput = this.getByTestId('loan-original-term-months-input');
    this.originalTermMonthsError = this.getByTestId('loan-original-term-months-error');
    this.startMonthMonthSelect = this.getByTestId('loan-start-month-month-select');
    this.startMonthYearSelect = this.getByTestId('loan-start-month-year-select');
    this.startMonthError = this.getByTestId('loan-start-month-error');

    this.rateEffectiveCurrentRadio = this.getByTestId('loan-rate-effective-current');
    this.rateEffectiveNextRadio = this.getByTestId('loan-rate-effective-next');
    this.rateEffectiveError = this.getByTestId('loan-rate-effective-error');

    this.generalError = this.getByTestId('loan-editor-error');
    this.cancelButton = this.getByTestId('loan-editor-cancel-button');
    this.submitButton = this.getByTestId('loan-editor-submit-button');
  }

  /**
   * Wait for sidebar to be visible
   */
  async waitForVisible(): Promise<void> {
    await this.sidebar.waitFor({ state: 'visible' });
  }

  /**
   * Wait for sidebar to be hidden
   */
  async waitForHidden(): Promise<void> {
    await this.sidebar.waitFor({ state: 'hidden' });
  }

  /**
   * Check if sidebar is visible
   */
  async isVisible(): Promise<boolean> {
    return await this.sidebar.isVisible();
  }

  /**
   * Get the current mode (create or edit)
   */
  async getMode(): Promise<'create' | 'edit' | null> {
    return await this.sidebar.getAttribute('data-mode') as 'create' | 'edit' | null;
  }

  /**
   * Get title text
   */
  async getTitle(): Promise<string> {
    return await this.title.textContent() ?? '';
  }

  /**
   * Verify sidebar is in create mode
   */
  async verifyCreateMode(): Promise<void> {
    await expect(this.sidebar).toHaveAttribute('data-mode', 'create');
    await expect(this.title).toContainText('Add loan');
  }

  /**
   * Verify sidebar is in edit mode
   */
  async verifyEditMode(): Promise<void> {
    await expect(this.sidebar).toHaveAttribute('data-mode', 'edit');
    await expect(this.title).toContainText('Edit loan');
  }

  /**
   * Fill principal amount
   */
  async setPrincipal(value: string): Promise<void> {
    // For negative values (validation tests), use JavaScript to bypass HTML5 min attribute
    if (value.startsWith('-')) {
      await this.principalInput.evaluate((el: HTMLInputElement, val: string) => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        nativeInputValueSetter?.call(el, val);
        const inputEvent = new Event('input', { bubbles: true });
        el.dispatchEvent(inputEvent);
        const changeEvent = new Event('change', { bubbles: true });
        el.dispatchEvent(changeEvent);
      }, value);
      await this.page.waitForTimeout(200);
    } else {
      await this.principalInput.fill(value);
    }
  }

  /**
   * Fill remaining balance
   */
  async setRemainingBalance(value: string): Promise<void> {
    await this.remainingBalanceInput.fill(value);
  }

  /**
   * Fill annual rate
   */
  async setAnnualRate(value: string): Promise<void> {
    await this.annualRateInput.fill(value);
  }

  /**
   * Fill term months
   */
  async setTermMonths(value: string): Promise<void> {
    // For zero or negative values (validation tests), use JavaScript to bypass HTML5 min attribute
    if (value === '0' || value.startsWith('-')) {
      await this.termMonthsInput.evaluate((el: HTMLInputElement, val: string) => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        nativeInputValueSetter?.call(el, val);
        const inputEvent = new Event('input', { bubbles: true });
        el.dispatchEvent(inputEvent);
        const changeEvent = new Event('change', { bubbles: true });
        el.dispatchEvent(changeEvent);
      }, value);
      await this.page.waitForTimeout(200);
    } else {
      await this.termMonthsInput.fill(value);
    }
  }

  /**
   * Fill original term months
   */
  async setOriginalTermMonths(value: string): Promise<void> {
    // For zero or negative values (validation tests), use JavaScript to bypass HTML5 min attribute
    if (value === '0' || value.startsWith('-')) {
      await this.originalTermMonthsInput.evaluate((el: HTMLInputElement, val: string) => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        nativeInputValueSetter?.call(el, val);
        const inputEvent = new Event('input', { bubbles: true });
        el.dispatchEvent(inputEvent);
        const changeEvent = new Event('change', { bubbles: true });
        el.dispatchEvent(changeEvent);
      }, value);
      await this.page.waitForTimeout(200);
    } else {
      await this.originalTermMonthsInput.fill(value);
    }
  }

  /**
   * Select start month
   */
  async setStartMonth(month: string): Promise<void> {
    await this.startMonthMonthSelect.selectOption(month);
  }

  /**
   * Select start year
   */
  async setStartYear(year: string): Promise<void> {
    await this.startMonthYearSelect.selectOption(year);
  }

  /**
   * Set rate effective to current month
   */
  async setRateEffectiveCurrent(): Promise<void> {
    await this.rateEffectiveCurrentRadio.check();
  }

  /**
   * Set rate effective to next month
   */
  async setRateEffectiveNext(): Promise<void> {
    await this.rateEffectiveNextRadio.check();
  }

  /**
   * Fill entire form with provided data
   */
  async fillForm(data: LoanFormData): Promise<void> {
    if (data.principal !== undefined) {
      await this.setPrincipal(data.principal);
    }
    if (data.remainingBalance !== undefined) {
      await this.setRemainingBalance(data.remainingBalance);
    }
    if (data.annualRate !== undefined) {
      await this.setAnnualRate(data.annualRate);
    }
    if (data.termMonths !== undefined) {
      await this.setTermMonths(data.termMonths);
    }
    if (data.originalTermMonths !== undefined) {
      await this.setOriginalTermMonths(data.originalTermMonths);
    }
    if (data.startMonthMonth !== undefined) {
      await this.setStartMonth(data.startMonthMonth);
    }
    if (data.startMonthYear !== undefined) {
      await this.setStartYear(data.startMonthYear);
    }
    if (data.rateEffective === 'next') {
      await this.setRateEffectiveNext();
    } else if (data.rateEffective === 'current') {
      await this.setRateEffectiveCurrent();
    }
  }

  /**
   * Click submit button
   */
  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  /**
   * Click cancel button
   */
  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.waitForHidden();
  }

  /**
   * Click close (X) button
   */
  async close(): Promise<void> {
    await this.closeButton.click();
    await this.waitForHidden();
  }

  /**
   * Check if submit button is disabled
   */
  async isSubmitDisabled(): Promise<boolean> {
    return await this.submitButton.isDisabled();
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
   * Get principal error message
   */
  async getPrincipalError(): Promise<string> {
    if (!await this.principalError.isVisible()) {
      return '';
    }
    return await this.principalError.textContent() ?? '';
  }

  /**
   * Get remaining balance error message
   */
  async getRemainingBalanceError(): Promise<string> {
    if (!await this.remainingBalanceError.isVisible()) {
      return '';
    }
    return await this.remainingBalanceError.textContent() ?? '';
  }

  /**
   * Get annual rate error message
   */
  async getAnnualRateError(): Promise<string> {
    if (!await this.annualRateError.isVisible()) {
      return '';
    }
    return await this.annualRateError.textContent() ?? '';
  }

  /**
   * Get term months error message
   */
  async getTermMonthsError(): Promise<string> {
    if (!await this.termMonthsError.isVisible()) {
      return '';
    }
    return await this.termMonthsError.textContent() ?? '';
  }

  /**
   * Get original term months error message
   */
  async getOriginalTermMonthsError(): Promise<string> {
    if (!await this.originalTermMonthsError.isVisible()) {
      return '';
    }
    return await this.originalTermMonthsError.textContent() ?? '';
  }

  /**
   * Check if any validation errors are visible
   */
  async hasValidationErrors(): Promise<boolean> {
    return (
      await this.principalError.isVisible() ||
      await this.remainingBalanceError.isVisible() ||
      await this.annualRateError.isVisible() ||
      await this.termMonthsError.isVisible() ||
      await this.originalTermMonthsError.isVisible() ||
      await this.startMonthError.isVisible() ||
      await this.rateEffectiveError.isVisible() ||
      await this.generalError.isVisible()
    );
  }

  /**
   * Submit form and expect validation errors
   */
  async submitAndExpectErrors(): Promise<void> {
    await this.submit();
    // Wait a bit for errors to appear
    await this.page.waitForTimeout(500);
    const hasErrors = await this.hasValidationErrors();
    expect(hasErrors).toBe(true);
  }

  /**
   * Complete flow: Fill form and submit successfully
   */
  async fillAndSubmit(data: LoanFormData): Promise<void> {
    await this.fillForm(data);
    await this.submit();
    await this.waitForHidden();
  }
}

