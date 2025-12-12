import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export type AuthMode = 'signin' | 'signup';

/**
 * Page Object Model for Authentication Page
 * Handles sign-in and sign-up flows with validation
 */
export class AuthPage extends BasePage {
  // Form elements
  readonly form: Locator;
  readonly title: Locator;
  readonly emailInput: Locator;
  readonly emailError: Locator;
  readonly passwordInput: Locator;
  readonly passwordError: Locator;
  readonly passwordToggle: Locator;
  readonly submitButton: Locator;
  readonly errorSummary: Locator;

  constructor(page: Page) {
    super(page);

    this.form = this.getByTestId('auth-form');
    this.title = this.getByTestId('auth-form-title');
    this.emailInput = this.getByTestId('auth-email-input');
    this.emailError = this.getByTestId('auth-email-error');
    this.passwordInput = this.getByTestId('auth-password-input');
    this.passwordError = this.getByTestId('auth-password-error');
    this.passwordToggle = this.getByTestId('auth-password-toggle');
    this.submitButton = this.getByTestId('auth-submit-button');
    this.errorSummary = this.getByTestId('error-summary');
  }

  /**
   * Navigate to sign-in page
   */
  async navigateToSignIn(): Promise<void> {
    await this.goto('/auth/signin');
    await this.waitForLoad();
  }

  /**
   * Navigate to sign-up page
   */
  async navigateToSignUp(): Promise<void> {
    await this.goto('/auth/signup');
    await this.waitForLoad();
  }

  /**
   * Get current form mode
   */
  async getMode(): Promise<AuthMode | null> {
    return await this.form.getAttribute('data-mode') as AuthMode | null;
  }

  /**
   * Verify form is in sign-in mode
   */
  async verifySignInMode(): Promise<void> {
    await expect(this.form).toHaveAttribute('data-mode', 'signin');
    await expect(this.title).toContainText('Sign in');
  }

  /**
   * Verify form is in sign-up mode
   */
  async verifySignUpMode(): Promise<void> {
    await expect(this.form).toHaveAttribute('data-mode', 'signup');
    await expect(this.title).toContainText('Create');
  }

  /**
   * Fill email field
   */
  async setEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  /**
   * Fill password field
   */
  async setPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  /**
   * Toggle password visibility
   */
  async togglePasswordVisibility(): Promise<void> {
    await this.passwordToggle.click();
  }

  /**
   * Check if password is visible (text type)
   */
  async isPasswordVisible(): Promise<boolean> {
    const type = await this.passwordInput.getAttribute('type');
    return type === 'text';
  }

  /**
   * Submit the form
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
   * Get email error message
   */
  async getEmailError(): Promise<string> {
    if (!await this.emailError.isVisible()) {
      return '';
    }
    return await this.emailError.textContent() ?? '';
  }

  /**
   * Get password error message
   */
  async getPasswordError(): Promise<string> {
    if (!await this.passwordError.isVisible()) {
      return '';
    }
    return await this.passwordError.textContent() ?? '';
  }

  /**
   * Check if error summary is visible
   */
  async hasErrorSummary(): Promise<boolean> {
    return await this.errorSummary.isVisible();
  }

  /**
   * Get error summary text
   */
  async getErrorSummaryText(): Promise<string> {
    if (!await this.errorSummary.isVisible()) {
      return '';
    }
    return await this.errorSummary.textContent() ?? '';
  }

  /**
   * Wait for navigation after successful auth
   */
  async waitForSuccessfulAuth(expectedUrl: string = '/dashboard'): Promise<void> {
    await this.page.waitForURL(expectedUrl, { timeout: 10000 });
  }

  /**
   * Complete sign-in flow
   */
  async signIn(email: string, password: string): Promise<void> {
    await this.setEmail(email);
    await this.setPassword(password);
    await this.submit();
  }

  /**
   * Complete sign-up flow
   */
  async signUp(email: string, password: string): Promise<void> {
    await this.setEmail(email);
    await this.setPassword(password);
    await this.submit();
  }

  /**
   * Sign in and wait for redirect to dashboard
   */
  async signInAndWait(email: string, password: string): Promise<void> {
    await this.signIn(email, password);
    await this.waitForSuccessfulAuth();
  }

  /**
   * Sign up and wait for redirect to dashboard
   */
  async signUpAndWait(email: string, password: string): Promise<void> {
    await this.signUp(email, password);
    await this.waitForSuccessfulAuth();
  }

  /**
   * Verify successful authentication (on dashboard page)
   */
  async verifyAuthenticated(): Promise<void> {
    await expect(this.page).toHaveURL(/\/dashboard/);
  }

  /**
   * Verify validation error appears
   */
  async verifyValidationError(): Promise<void> {
    const hasEmailError = await this.emailError.isVisible();
    const hasPasswordError = await this.passwordError.isVisible();
    const hasErrorSummary = await this.errorSummary.isVisible();
    
    expect(hasEmailError || hasPasswordError || hasErrorSummary).toBe(true);
  }
}

