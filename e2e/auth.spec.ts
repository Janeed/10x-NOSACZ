import { test, expect } from './fixtures';

/**
 * Authentication E2E Tests
 * Tests sign-in and sign-up flows with validation
 * 
 * Note: These tests run WITHOUT the authenticated context
 * They test the authentication flow itself
 */

test.describe('Authentication', () => {
  // Use a different project or skip auth state for these tests
  test.use({ storageState: { cookies: [], origins: [] } });

  test.describe('Sign In', () => {
    test('should display sign-in form', async ({ authPage }) => {
      await authPage.navigateToSignIn();
      await authPage.verifySignInMode();
      
      expect(await authPage.emailInput.isVisible()).toBe(true);
      expect(await authPage.passwordInput.isVisible()).toBe(true);
      expect(await authPage.submitButton.isVisible()).toBe(true);
    });

    test('should show validation error for invalid email', async ({ authPage }) => {
      await authPage.navigateToSignIn();
      
      await authPage.setEmail('invalid-email');
      await authPage.setPassword('ValidPassword123');
      await authPage.submit();
      
      await expect(authPage.emailError).toBeVisible();
      const errorText = await authPage.getEmailError();
      expect(errorText.toLowerCase()).toContain('email');
    });

    test('should show validation error for short password', async ({ authPage }) => {
      await authPage.navigateToSignIn();
      
      await authPage.setEmail('valid@example.com');
      await authPage.setPassword('short');
      await authPage.submit();
      
      await expect(authPage.passwordError).toBeVisible();
      const errorText = await authPage.getPasswordError();
      expect(errorText.toLowerCase()).toContain('8');
    });

    test('should toggle password visibility', async ({ authPage }) => {
      await authPage.navigateToSignIn();
      
      await authPage.setPassword('MyPassword123');
      
      // Initially hidden
      expect(await authPage.isPasswordVisible()).toBe(false);
      
      // Click toggle
      await authPage.togglePasswordVisibility();
      expect(await authPage.isPasswordVisible()).toBe(true);
      
      // Toggle back
      await authPage.togglePasswordVisibility();
      expect(await authPage.isPasswordVisible()).toBe(false);
    });
  });

  test.describe('Sign Up', () => {
    test('should display sign-up form', async ({ authPage }) => {
      await authPage.navigateToSignUp();
      await authPage.verifySignUpMode();
      
      expect(await authPage.emailInput.isVisible()).toBe(true);
      expect(await authPage.passwordInput.isVisible()).toBe(true);
      expect(await authPage.submitButton.isVisible()).toBe(true);
    });

    test('should show validation error for invalid inputs', async ({ authPage }) => {
      await authPage.navigateToSignUp();
      
      await authPage.setEmail('not-an-email');
      await authPage.setPassword('123');
      await authPage.submit();
      
      await authPage.verifyValidationError();
    });
  });
});

test.describe('Authenticated Navigation', () => {
  test('should be authenticated after setup', async ({ page, authPage }) => {
    // This test uses the authenticated state from setup
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should maintain session across navigations', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
    
    await page.goto('/loans');
    await expect(page).toHaveURL(/\/loans/);
    
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);
  });
});

