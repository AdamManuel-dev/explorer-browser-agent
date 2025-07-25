import { Stagehand } from '@browserbasehq/stagehand';
import { Browserbase } from '@browserbasehq/sdk';
import { Page } from 'playwright';
import { logger } from '../../utils/logger';
import { BrowserbaseConfig, StagehandConfig } from '../../mastra/types';

/**
 * Session manager for integrating Stagehand with Mastra tools
 *
 * This class manages Stagehand instances and provides the context needed
 * for the Mastra tool wrappers to function properly.
 */
export class StagehandSessionManager {
  private stagehand: Stagehand | null = null;

  private browserbase: Browserbase | null = null;

  private currentSession: any = null;

  private isInitialized = false;

  constructor(
    private browserbaseConfig: BrowserbaseConfig,
    private stagehandConfig: StagehandConfig
  ) {
    this.browserbase = new Browserbase({
      apiKey: browserbaseConfig.apiKey,
    });
  }

  /**
   * Initialize Stagehand with Browserbase session
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('Stagehand session already initialized');
      return;
    }

    try {
      logger.info('Initializing Stagehand session');

      // Create Browserbase session
      this.currentSession = await this.browserbase!.createSession({
        projectId: this.browserbaseConfig.projectId,
        browserSettings: {
          viewport: { width: 1280, height: 720 },
        },
        ...(this.browserbaseConfig.region && { region: this.browserbaseConfig.region }),
      });

      // Initialize Stagehand with the session
      this.stagehand = new Stagehand({
        ...this.stagehandConfig,
        env: 'LOCAL',
      });

      // Set the Browserbase session ID
      if (this.currentSession.id) {
        this.stagehand.browserbaseSessionID = this.currentSession.id;
      }

      // Initialize Stagehand
      await this.stagehand.init();

      this.isInitialized = true;

      logger.info('Stagehand session initialized successfully', {
        sessionId: this.currentSession.id,
      });
    } catch (error) {
      logger.error('Failed to initialize Stagehand session', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get the current Stagehand instance
   */
  getStagehand(): Stagehand {
    if (!this.stagehand || !this.isInitialized) {
      throw new Error('Stagehand session not initialized. Call initialize() first.');
    }
    return this.stagehand;
  }

  /**
   * Get the current page
   */
  async getPage(): Promise<Page> {
    const stagehand = this.getStagehand();
    const page = await stagehand.page;

    if (!page) {
      throw new Error('No page available. Stagehand may not be properly initialized.');
    }

    return page;
  }

  /**
   * Get tool context for Mastra tools
   * This provides the necessary context for the Stagehand tools to function
   */
  async getToolContext(): Promise<{
    stagehand: {
      page: Page;
      act: (options: { action: string }) => Promise<{ success: boolean; message?: string }>;
      observe: (options: {
        instruction: string;
      }) => Promise<Array<{ selector: string; description: string }>>;
      extract: (options: { instruction: string; schema?: Record<string, any> }) => Promise<any>;
    };
  }> {
    const stagehand = this.getStagehand();
    const page = await this.getPage();

    return {
      stagehand: {
        page,
        act: async (options) => {
          try {
            // Note: This is a placeholder implementation
            // The real implementation would use stagehand.act(options)
            logger.warn('Act method not fully implemented', {
              action: options.action,
            });
            return {
              success: false,
              message: 'Act functionality requires full Stagehand integration',
            };
          } catch (error) {
            logger.error('Stagehand act failed', {
              action: options.action,
              error: error instanceof Error ? error.message : String(error),
            });
            return {
              success: false,
              message: error instanceof Error ? error.message : String(error),
            };
          }
        },
        observe: async (options) => {
          try {
            // Note: This is a placeholder implementation
            // The real implementation would use stagehand.observe(options)
            logger.warn('Observe method not fully implemented', {
              instruction: options.instruction,
            });
            return [];
          } catch (error) {
            logger.error('Stagehand observe failed', {
              instruction: options.instruction,
              error: error instanceof Error ? error.message : String(error),
            });
            return [];
          }
        },
        extract: async (options) => {
          try {
            // Note: This is a placeholder implementation
            // The real implementation would need to handle Stagehand's extract method properly
            logger.warn('Extract method not fully implemented', {
              instruction: options.instruction,
            });
            return {
              message: 'Extract functionality requires full Stagehand integration',
              instruction: options.instruction,
            };
          } catch (error) {
            logger.error('Stagehand extract failed', {
              instruction: options.instruction,
              error: error instanceof Error ? error.message : String(error),
            });
            return null;
          }
        },
      },
    };
  }

  /**
   * Navigate to a URL
   */
  async navigateTo(url: string, options: { timeout?: number } = {}): Promise<void> {
    const page = await this.getPage();
    await page.goto(url, {
      timeout: options.timeout || 30000,
      waitUntil: 'networkidle',
    });
  }

  /**
   * Take a screenshot of the current page
   */
  async takeScreenshot(options: { fullPage?: boolean } = {}): Promise<string> {
    const page = await this.getPage();
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: options.fullPage || false,
    });
    return `data:image/png;base64,${screenshot.toString('base64')}`;
  }

  /**
   * Get current page information
   */
  async getPageInfo(): Promise<{
    url: string;
    title: string;
    description?: string;
  }> {
    const page = await this.getPage();

    const [url, title, description] = await Promise.all([
      page.url(),
      page.title(),
      page
        .locator('meta[name="description"]')
        .getAttribute('content')
        .catch(() => undefined),
    ]);

    return { url, title, description };
  }

  /**
   * Check if session is healthy
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    sessionId?: string;
    pageUrl?: string;
    error?: string;
  }> {
    try {
      if (!this.isInitialized || !this.stagehand) {
        return {
          healthy: false,
          error: 'Session not initialized',
        };
      }

      const page = await this.getPage();
      const url = page.url();

      return {
        healthy: true,
        sessionId: this.currentSession?.id,
        pageUrl: url,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Clean up the session
   */
  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up Stagehand session');

      if (this.stagehand) {
        await this.stagehand.close();
        this.stagehand = null;
      }

      if (this.currentSession && this.browserbase) {
        // Browserbase sessions are typically cleaned up automatically
        this.currentSession = null;
      }

      this.isInitialized = false;

      logger.info('Stagehand session cleanup completed');
    } catch (error) {
      logger.error('Error during session cleanup', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get session metrics
   */
  getMetrics(): {
    isInitialized: boolean;
    sessionId?: string;
    hasStagehand: boolean;
    hasPage: boolean;
  } {
    return {
      isInitialized: this.isInitialized,
      sessionId: this.currentSession?.id,
      hasStagehand: !!this.stagehand,
      hasPage: !!this.stagehand?.page,
    };
  }
}
