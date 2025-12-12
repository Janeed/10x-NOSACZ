import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { LoanEditorSidebar } from './LoanEditorSidebar';
import { LoanDeleteConfirmDialog } from './LoanDeleteConfirmDialog';
import { LoanBalanceQuickEditDialog } from './LoanBalanceQuickEditDialog';

export interface LoanData {
  principal: string;
  remainingBalance?: string;
  annualRate: string;
  termMonths: string;
  originalTermMonths: string;
  startMonthMonth: string;
  startMonthYear: string;
  rateEffective?: 'current' | 'next';
}

/**
 * Page Object Model for Loans Management Page
 * Handles all interactions with the loans list, sorting, pagination, and related dialogs
 */
export class LoansPage extends BasePage {
  // Sub-components
  readonly editor: LoanEditorSidebar;
  readonly deleteDialog: LoanDeleteConfirmDialog;
  readonly balanceDialog: LoanBalanceQuickEditDialog;

  // Page elements
  readonly addLoanButton: Locator;
  readonly sortFieldSelect: Locator;
  readonly sortOrderToggle: Locator;
  readonly loansTable: Locator;
  readonly staleBanner: Locator;
  readonly staleTrigger: Locator;
  readonly staleDismissButton: Locator;
  readonly loadingIndicator: Locator;
  readonly errorContainer: Locator;
  readonly errorMessage: Locator;
  readonly retryButton: Locator;
  readonly emptyState: Locator;
  readonly emptyStateAddButton: Locator;
  readonly paginationInfo: Locator;

  constructor(page: Page) {
    super(page);
    
    // Initialize sub-components
    this.editor = new LoanEditorSidebar(page);
    this.deleteDialog = new LoanDeleteConfirmDialog(page);
    this.balanceDialog = new LoanBalanceQuickEditDialog(page);

    // Initialize locators
    this.addLoanButton = this.getByTestId('loans-add-button');
    this.sortFieldSelect = this.getByTestId('loans-sort-field-select');
    this.sortOrderToggle = this.getByTestId('loans-sort-order-toggle');
    this.loansTable = this.getByTestId('loans-table');
    this.staleBanner = this.getByTestId('loans-stale-banner');
    this.staleTrigger = this.getByTestId('loans-stale-trigger');
    this.staleDismissButton = this.getByTestId('loans-stale-dismiss-button');
    this.loadingIndicator = this.getByTestId('loans-loading');
    this.errorContainer = this.getByTestId('loans-error');
    this.errorMessage = this.getByTestId('loans-error-message');
    this.retryButton = this.getByTestId('loans-retry-button');
    this.emptyState = this.getByTestId('loans-empty-state');
    this.emptyStateAddButton = this.getByTestId('loans-empty-state-add-button');
    this.paginationInfo = this.getByTestId('loans-pagination-info');
  }

  /**
   * Navigate to the loans page
   */
  async navigate(): Promise<void> {
    await this.goto('/loans');
    await this.waitForLoad();
  }

  /**
   * Wait for loans table to be visible
   */
  async waitForTableVisible(): Promise<void> {
    await this.loansTable.waitFor({ state: 'visible' });
  }

  /**
   * Check if page is in loading state
   */
  async isLoading(): Promise<boolean> {
    return await this.loadingIndicator.isVisible();
  }

  /**
   * Check if page has error state
   */
  async hasError(): Promise<boolean> {
    return await this.errorContainer.isVisible();
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    return await this.errorMessage.textContent() ?? '';
  }

  /**
   * Click retry button
   */
  async clickRetry(): Promise<void> {
    await this.retryButton.click();
  }

  /**
   * Check if empty state is shown
   */
  async isEmptyState(): Promise<boolean> {
    return await this.emptyState.isVisible();
  }

  /**
   * Click add loan button (header or empty state)
   */
  async clickAddLoan(): Promise<void> {
    const isEmptyStateVisible = await this.isEmptyState();
    if (isEmptyStateVisible) {
      await this.emptyStateAddButton.click();
    } else {
      await this.addLoanButton.click();
    }
    await this.editor.waitForVisible();
  }

  /**
   * Create a new loan with provided data
   */
  async createLoan(data: LoanData): Promise<void> {
    await this.clickAddLoan();
    await this.editor.fillForm(data);
    await this.editor.submit();
    await this.editor.waitForHidden();
  }

  /**
   * Get all loan rows
   */
  getLoanRows(): Locator {
    return this.page.locator('[data-test="loan-row"]');
  }

  /**
   * Get loan row by index (0-based)
   */
  getLoanRow(index: number): Locator {
    return this.getLoanRows().nth(index);
  }

  /**
   * Get loan row by loan ID
   */
  getLoanRowById(loanId: string): Locator {
    return this.page.locator(`[data-test="loan-row"][data-loan-id="${loanId}"]`);
  }

  /**
   * Get count of loan rows
   */
  async getLoanCount(): Promise<number> {
    return await this.getLoanRows().count();
  }

  /**
   * Get loan ID from a row
   */
  async getLoanId(rowIndex: number): Promise<string> {
    const row = this.getLoanRow(rowIndex);
    return await row.getAttribute('data-loan-id') ?? '';
  }

  /**
   * Get loan data displayed in a row
   */
  async getLoanDisplayData(rowIndex: number): Promise<{
    label: string;
    remainingBalance: string;
    annualRate: string;
    term: string;
    startMonth: string;
    status: string;
  }> {
    const row = this.getLoanRow(rowIndex);
    return {
      label: await row.locator('[data-test="loan-label"]').textContent() ?? '',
      remainingBalance: await row.locator('[data-test="loan-remaining-balance"]').textContent() ?? '',
      annualRate: await row.locator('[data-test="loan-annual-rate"]').textContent() ?? '',
      term: await row.locator('[data-test="loan-term"]').textContent() ?? '',
      startMonth: await row.locator('[data-test="loan-start-month"]').textContent() ?? '',
      status: await row.locator('[data-test="loan-status-badge"]').getAttribute('data-status') ?? '',
    };
  }

  /**
   * Click edit button for a specific loan row
   */
  async editLoan(rowIndex: number): Promise<void> {
    const row = this.getLoanRow(rowIndex);
    await row.locator('[data-test="loan-edit-button"]').click();
    await this.editor.waitForVisible();
  }

  /**
   * Click delete button for a specific loan row
   */
  async deleteLoan(rowIndex: number): Promise<void> {
    const row = this.getLoanRow(rowIndex);
    await row.locator('[data-test="loan-delete-button"]').click();
    await this.deleteDialog.waitForVisible();
  }

  /**
   * Click quick balance button for a specific loan row
   */
  async openQuickBalance(rowIndex: number): Promise<void> {
    const row = this.getLoanRow(rowIndex);
    await row.locator('[data-test="loan-quick-balance-button"]').click();
    await this.balanceDialog.waitForVisible();
  }

  /**
   * Change sort field
   */
  async setSortField(field: 'created_at' | 'start_month' | 'remaining_balance'): Promise<void> {
    await this.sortFieldSelect.selectOption(field);
  }

  /**
   * Toggle sort order (ascending/descending)
   */
  async toggleSortOrder(): Promise<void> {
    await this.sortOrderToggle.click();
  }

  /**
   * Get current sort order text
   */
  async getSortOrderText(): Promise<string> {
    return await this.sortOrderToggle.textContent() ?? '';
  }

  /**
   * Click a column header to sort by that column
   */
  async sortByColumn(field: 'remaining_balance' | 'start_month'): Promise<void> {
    await this.page.locator(`[data-test="loans-sort-${field}"]`).click();
  }

  /**
   * Check if stale simulation banner is visible
   */
  async isStaleBannerVisible(): Promise<boolean> {
    return await this.staleBanner.isVisible();
  }

  /**
   * Get stale trigger text
   */
  async getStaleTriggerText(): Promise<string> {
    if (!await this.staleTrigger.isVisible()) {
      return '';
    }
    return await this.staleTrigger.textContent() ?? '';
  }

  /**
   * Dismiss stale simulation banner
   */
  async dismissStaleBanner(): Promise<void> {
    await this.staleDismissButton.click();
    await this.staleBanner.waitFor({ state: 'hidden' });
  }

  /**
   * Get pagination information text
   */
  async getPaginationInfo(): Promise<string> {
    return await this.paginationInfo.textContent() ?? '';
  }

  /**
   * Verify page is loaded and ready
   */
  async verifyPageLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/loans/);
    const isLoading = await this.isLoading();
    if (isLoading) {
      await this.loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 });
    }
  }

  /**
   * Complete flow: Create loan and verify it appears in the list
   */
  async createLoanAndVerify(data: LoanData): Promise<string> {
    const initialCount = await this.getLoanCount();
    await this.createLoan(data);
    await expect(this.getLoanRows()).toHaveCount(initialCount + 1);
    return await this.getLoanId(0); // Assuming newest appears first
  }

  /**
   * Complete flow: Edit loan and verify stale banner
   */
  async editLoanAndVerifyStale(rowIndex: number, data: Partial<LoanData>): Promise<void> {
    await this.editLoan(rowIndex);
    await this.editor.fillForm(data as LoanData);
    await this.editor.submit();
    await this.editor.waitForHidden();
    await expect(this.staleBanner).toBeVisible();
  }

  /**
   * Complete flow: Delete loan and verify it's removed
   */
  async deleteLoanAndVerify(rowIndex: number): Promise<void> {
    const initialCount = await this.getLoanCount();
    const loanId = await this.getLoanId(rowIndex);
    await this.deleteLoan(rowIndex);
    await this.deleteDialog.confirmDelete();
    await expect(this.getLoanRowById(loanId)).not.toBeVisible();
    await expect(this.getLoanRows()).toHaveCount(initialCount - 1);
  }

  /**
   * Complete flow: Adjust balance and verify stale banner
   */
  async adjustBalanceAndVerifyStale(rowIndex: number, newBalance: string): Promise<void> {
    await this.openQuickBalance(rowIndex);
    await this.balanceDialog.setBalance(newBalance);
    await this.balanceDialog.submit();
    await this.balanceDialog.waitForHidden();
    await expect(this.staleBanner).toBeVisible();
  }
}

