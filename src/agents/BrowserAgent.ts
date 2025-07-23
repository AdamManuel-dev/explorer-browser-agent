import { Browser, BrowserContext, Page, chromium } from 'playwright';
import { logger } from '../utils/logger';
import { BrowserAgentConfig } from '../types';

export class BrowserAgent {
  private browser: Browser | null = null;

  private context: BrowserContext | null = null;

  private page: Page | null = null;

  private config: BrowserAgentConfig;

  constructor(config: Partial<BrowserAgentConfig> = {}) {
    this.config = {
      headless: true,
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ...config,
    };
  }

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

  async screenshot(path: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    await this.page.screenshot({ path });
    logger.info('Screenshot saved', { path });
  }

  getPage(): Page | null {
    return this.page;
  }

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
