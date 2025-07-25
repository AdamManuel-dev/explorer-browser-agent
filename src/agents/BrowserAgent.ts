import { Browser, BrowserContext, Page, chromium } from 'playwright';
import { logger } from '../utils/logger';
import { BrowserAgentConfig } from '../types';

/**
 * Manages browser automation with support for multiple strategies and AI-powered element detection.
 * Provides a high-level interface for web navigation, content extraction, and screenshot capture.
 * Built on top of Playwright for reliable browser automation.
 * 
 * @example Basic usage
 * ```typescript
 * const agent = new BrowserAgent({ headless: false });
 * await agent.initialize();
 * await agent.navigate('https://example.com');
 * const content = await agent.extractContent();
 * await agent.close();
 * ```
 * 
 * @example With custom configuration
 * ```typescript
 * const agent = new BrowserAgent({
 *   headless: true,
 *   viewport: { width: 1366, height: 768 },
 *   userAgent: 'custom-user-agent'
 * });
 * ```
 */
export class BrowserAgent {
  private browser: Browser | null = null;

  private context: BrowserContext | null = null;

  private page: Page | null = null;

  private config: BrowserAgentConfig;

  /**
   * Creates a new BrowserAgent instance with the specified configuration.
   * 
   * @param config - Configuration options for the browser agent
   */
  constructor(config: Partial<BrowserAgentConfig> = {}) {
    this.config = {
      headless: true,
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ...config,
    };
  }

  /**
   * Initializes the browser instance and creates a new page context.
   * Must be called before any other operations.
   * 
   * @throws Error when browser initialization fails
   * 
   * @example
   * ```typescript
   * const agent = new BrowserAgent();
   * await agent.initialize();
   * ```
   */
  async initialize(): Promise<void> {
    try {
      this.browser = await chromium.launch({
        headless: this.config.headless,
      });

      this.context = await this.browser.newContext({
        viewport: this.config.viewport,
        userAgent: this.config.userAgent,
      });

      this.page = await this.context.newPage();
      logger.info('Browser agent initialized');
    } catch (error) {
      logger.error('Failed to initialize browser', error);
      throw error;
    }
  }

  /**
   * Navigates the browser to the specified URL.
   * Waits for network idle to ensure page is fully loaded.
   * 
   * @param url - The URL to navigate to
   * @throws Error when browser is not initialized or navigation fails
   * 
   * @example
   * ```typescript
   * await agent.navigate('https://example.com');
   * ```
   */
  async navigate(url: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      await this.page.goto(url, { waitUntil: 'networkidle' });
      logger.info('Navigated to URL', { url });
    } catch (error) {
      logger.error('Navigation failed', { url, error });
      throw error;
    }
  }

  /**
   * Extracts all visible text content from the current page.
   * Uses document.body.innerText to get human-readable text.
   * 
   * @returns The extracted text content from the page
   * @throws Error when browser is not initialized or content extraction fails
   * 
   * @example
   * ```typescript
   * await agent.navigate('https://example.com');
   * const content = await agent.extractContent();
   * console.log('Page content:', content);
   * ```
   */
  async extractContent(): Promise<string> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      const content = await this.page.evaluate(() => document.body.innerText);
      return content;
    } catch (error) {
      logger.error('Content extraction failed', error);
      throw error;
    }
  }

  /**
   * Takes a screenshot of the current page and saves it to the specified path.
   * 
   * @param path - File path where the screenshot will be saved
   * @throws Error when browser is not initialized
   * 
   * @example
   * ```typescript
   * await agent.navigate('https://example.com');
   * await agent.screenshot('./screenshots/example.png');
   * ```
   */
  async screenshot(path: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    await this.page.screenshot({ path });
    logger.info('Screenshot saved', { path });
  }

  /**
   * Returns the current Playwright page instance for direct manipulation.
   * Useful for advanced operations not covered by the agent interface.
   * 
   * @returns The current Page instance or null if not initialized
   * 
   * @example
   * ```typescript
   * const page = agent.getPage();
   * if (page) {
   *   await page.click('button#submit');
   * }
   * ```
   */
  getPage(): Page | null {
    return this.page;
  }

  /**
   * Closes the browser and cleans up all resources.
   * Should be called when done with the browser agent.
   * 
   * @example
   * ```typescript
   * try {
   *   await agent.initialize();
   *   await agent.navigate('https://example.com');
   * } finally {
   *   await agent.close();
   * }
   * ```
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      logger.info('Browser agent closed');
    }
  }
}
