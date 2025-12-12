import { type Page, type Locator } from "@playwright/test";

/**
 * Base Page Object class providing common functionality for all pages
 * Following Playwright best practices for resilient element selection
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /**
   * Navigate to a specific path
   */
  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }

  /**
   * Wait for page to be fully loaded
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Get locator by data-test attribute
   */
  getByTestId(testId: string): Locator {
    return this.page.locator(`[data-test="${testId}"]`);
  }

  /**
   * Wait for element to be visible
   */
  async waitForVisible(testId: string, timeout?: number): Promise<void> {
    await this.getByTestId(testId).waitFor({ state: "visible", timeout });
  }

  /**
   * Wait for element to be hidden
   */
  async waitForHidden(testId: string, timeout?: number): Promise<void> {
    await this.getByTestId(testId).waitFor({ state: "hidden", timeout });
  }

  /**
   * Check if element exists in DOM
   */
  async exists(testId: string): Promise<boolean> {
    return (await this.getByTestId(testId).count()) > 0;
  }

  /**
   * Check if element is visible
   */
  async isVisible(testId: string): Promise<boolean> {
    try {
      return await this.getByTestId(testId).isVisible();
    } catch {
      return false;
    }
  }

  /**
   * Get text content of element
   */
  async getTextContent(testId: string): Promise<string> {
    return (await this.getByTestId(testId).textContent()) ?? "";
  }

  /**
   * Click element by test ID
   */
  async clickByTestId(testId: string): Promise<void> {
    await this.getByTestId(testId).click();
  }

  /**
   * Fill input by test ID
   */
  async fillByTestId(testId: string, value: string): Promise<void> {
    await this.getByTestId(testId).fill(value);
  }

  /**
   * Select option by test ID
   */
  async selectByTestId(testId: string, value: string): Promise<void> {
    await this.getByTestId(testId).selectOption(value);
  }

  /**
   * Get current page URL
   */
  async getCurrentUrl(): Promise<string> {
    return this.page.url();
  }

  /**
   * Take a screenshot
   */
  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({
      path: `screenshots/${name}.png`,
      fullPage: true,
    });
  }
}
