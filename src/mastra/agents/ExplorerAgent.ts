import { Agent } from '@mastra/core';
import { Stagehand } from '@browserbasehq/stagehand';
import { Browserbase } from '@browserbasehq/sdk';
import { Page, Browser, BrowserContext } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { MonitoringService } from '../../monitoring';
import { StealthMode } from '../../stealth';
import { CaptchaHandler } from '../../captcha';
import { MultiStrategyAuthManager } from '../../auth';
import {
  BrowserbaseConfig,
  StagehandConfig,
  ExplorationTarget,
  ExplorationResult,
  UserPath,
  ExplorationStep,
  ElementInfo,
  ExplorationError,
  AgentCapabilities,
  AgentMetrics,
} from '../types';

export interface ExplorerAgentConfig {
  browserbase: BrowserbaseConfig;
  stagehand: StagehandConfig;
  monitoring?: MonitoringService;
  stealth?: StealthMode;
  captchaHandler?: CaptchaHandler;
  authManager?: MultiStrategyAuthManager;
  maxConcurrentSessions?: number;
  defaultTimeout?: number;
  screenshotQuality?: number;
}

export class ExplorerAgent extends Agent {
  private browserbase: Browserbase;
  private stagehand: Stagehand;
  private monitoring?: MonitoringService;
  private stealth?: StealthMode;
  private captchaHandler?: CaptchaHandler;
  private authManager?: MultiStrategyAuthManager;
  private sessions: Map<string, BrowserContext> = new Map();
  private activePaths: Map<string, UserPath> = new Map();
  private config: ExplorerAgentConfig;
  private metrics: AgentMetrics;

  constructor(config: ExplorerAgentConfig) {
    super({
      name: 'ExplorerAgent',
      description: 'AI-powered web exploration agent using Browserbase and Stagehand',
      version: '1.0.0',
    });

    this.config = config;
    this.browserbase = new Browserbase(config.browserbase.apiKey);
    this.stagehand = new Stagehand(config.stagehand);
    this.monitoring = config.monitoring;
    this.stealth = config.stealth;
    this.captchaHandler = config.captchaHandler;
    this.authManager = config.authManager;

    this.metrics = {
      tasksCompleted: 0,
      tasksSuccessful: 0,
      tasksFailed: 0,
      averageTaskDuration: 0,
      totalRuntime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      lastActivity: new Date(),
    };

    this.setupEventHandlers();
  }

  /**
   * Get agent capabilities
   */
  getCapabilities(): AgentCapabilities {
    return {
      canNavigate: true,
      canInteract: true,
      canExtract: true,
      canGenerateTests: false, // Delegated to GeneratorAgent
      canHandleAuth: !!this.authManager,
      canHandleCaptcha: !!this.captchaHandler,
      canTakeScreenshots: true,
      supportedBrowsers: ['chromium', 'firefox', 'webkit'],
    };
  }

  /**
   * Get current agent metrics
   */
  getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  /**
   * Explore a target website using AI-guided navigation
   */
  async explore(target: ExplorationTarget): Promise<ExplorationResult> {
    const startTime = new Date();
    const explorationId = uuidv4();
    const spanId = this.monitoring?.startSpan('explorer_explore', undefined);

    try {
      logger.info(`Starting exploration of ${target.url}`, {
        explorationId,
        target: target.url,
        maxDepth: target.maxDepth,
        maxPages: target.maxPages,
      });

      // Create Browserbase session
      const session = await this.createBrowserbaseSession();
      
      // Initialize Stagehand with the session
      const page = await this.initializeStagehand(session);

      // Apply stealth mode if configured
      if (this.stealth) {
        await this.stealth.setupPage(page);
      }

      // Handle authentication if required
      if (target.requireAuth && this.authManager) {
        await this.handleAuthentication(page, target);
      }

      // Start AI-guided exploration
      const userPaths = await this.performAIGuidedExploration(page, target);

      const endTime = new Date();
      const result: ExplorationResult = {
        id: explorationId,
        target,
        startTime,
        endTime,
        pagesExplored: userPaths.reduce((sum, path) => sum + path.steps.filter(s => s.type === 'navigate').length, 0),
        elementsFound: userPaths.reduce((sum, path) => sum + path.steps.filter(s => s.elementInfo).length, 0),
        interactionsRecorded: userPaths.reduce((sum, path) => sum + path.steps.length, 0),
        screenshotsTaken: userPaths.reduce((sum, path) => sum + path.screenshots.length, 0),
        userPaths,
        errors: [],
        metadata: {
          browserbaseSessionId: session.id,
          explorationDuration: endTime.getTime() - startTime.getTime(),
          userAgent: await page.evaluate(() => navigator.userAgent),
        },
      };

      // Clean up session
      await this.cleanupSession(session.id);

      this.updateMetrics(true, endTime.getTime() - startTime.getTime());
      this.monitoring?.recordCounter('explorations_completed', 1, { status: 'success' });
      
      logger.info(`Completed exploration of ${target.url}`, {
        explorationId,
        pagesExplored: result.pagesExplored,
        userPaths: result.userPaths.length,
      });

      return result;

    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime.getTime());
      this.monitoring?.recordCounter('explorations_completed', 1, { status: 'error' });
      
      logger.error(`Failed to explore ${target.url}`, {
        explorationId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    } finally {
      if (spanId) {
        this.monitoring?.endSpan(spanId);
      }
    }
  }

  /**
   * Extract elements from a page using AI-powered detection
   */
  async extractElements(page: Page, selectors?: string[]): Promise<ElementInfo[]> {
    const spanId = this.monitoring?.startSpan('explorer_extract_elements');

    try {
      logger.debug('Extracting elements from page', {
        url: page.url(),
        selectors: selectors?.length || 'all',
      });

      // Use Stagehand's AI-powered element detection
      const elements = await this.stagehand.observe({
        instruction: selectors?.length 
          ? `Find elements matching these selectors: ${selectors.join(', ')}`
          : 'Find all interactive elements on the page including buttons, links, forms, and inputs',
      });

      // Convert Stagehand results to our ElementInfo format
      const elementInfos: ElementInfo[] = [];
      
      for (const element of elements) {
        try {
          const elementInfo = await this.analyzeElement(page, element.selector);
          if (elementInfo) {
            elementInfos.push(elementInfo);
          }
        } catch (error) {
          logger.warn(`Failed to analyze element ${element.selector}`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      this.monitoring?.recordGauge('elements_extracted', elementInfos.length);
      
      logger.debug(`Extracted ${elementInfos.length} elements from page`);
      return elementInfos;

    } catch (error) {
      logger.error('Failed to extract elements', {
        url: page.url(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      if (spanId) {
        this.monitoring?.endSpan(spanId);
      }
    }
  }

  /**
   * Perform AI-guided interaction with an element
   */
  async interactWithElement(page: Page, instruction: string): Promise<ExplorationStep> {
    const stepId = uuidv4();
    const startTime = new Date();
    const spanId = this.monitoring?.startSpan('explorer_interact');

    try {
      logger.debug('Performing AI-guided interaction', {
        instruction,
        url: page.url(),
      });

      // Take screenshot before interaction
      const beforeScreenshot = await this.takeScreenshot(page);

      // Use Stagehand to perform the interaction
      const result = await this.stagehand.act({
        action: instruction,
      });

      // Take screenshot after interaction
      const afterScreenshot = await this.takeScreenshot(page);

      const endTime = new Date();
      const step: ExplorationStep = {
        id: stepId,
        type: this.inferStepType(instruction),
        selector: result.selector || undefined,
        value: result.value || undefined,
        url: page.url(),
        timestamp: startTime,
        duration: endTime.getTime() - startTime.getTime(),
        success: result.success || false,
        screenshot: afterScreenshot,
        elementInfo: result.selector ? await this.analyzeElement(page, result.selector) : undefined,
      };

      this.monitoring?.recordHistogram('interaction_duration', step.duration);
      
      logger.debug('Completed AI-guided interaction', {
        stepId,
        success: step.success,
        duration: step.duration,
      });

      return step;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Failed to interact with element', {
        instruction,
        error: errorMessage,
      });

      const step: ExplorationStep = {
        id: stepId,
        type: 'click', // Default fallback
        timestamp: startTime,
        duration: Date.now() - startTime.getTime(),
        success: false,
        error: errorMessage,
        url: page.url(),
      };

      return step;
    } finally {
      if (spanId) {
        this.monitoring?.endSpan(spanId);
      }
    }
  }

  /**
   * Navigate to a URL with error handling and monitoring
   */
  async navigateToUrl(page: Page, url: string): Promise<ExplorationStep> {
    const stepId = uuidv4();
    const startTime = new Date();
    const spanId = this.monitoring?.startSpan('explorer_navigate');

    try {
      logger.debug(`Navigating to ${url}`);

      // Use stealth navigation if configured
      if (this.stealth) {
        await this.stealth.navigateStealthily(page, url);
      } else {
        await page.goto(url, { 
          waitUntil: 'networkidle',
          timeout: this.config.defaultTimeout || 30000,
        });
      }

      // Handle CAPTCHA if detected
      if (this.captchaHandler) {
        const captchaDetected = await this.captchaHandler.detectCaptcha(page);
        if (captchaDetected.detected) {
          await this.captchaHandler.handleCaptchaWorkflow(page);
        }
      }

      const screenshot = await this.takeScreenshot(page);
      const endTime = new Date();

      const step: ExplorationStep = {
        id: stepId,
        type: 'navigate',
        url,
        timestamp: startTime,
        duration: endTime.getTime() - startTime.getTime(),
        success: true,
        screenshot,
      };

      this.monitoring?.recordHistogram('navigation_duration', step.duration);
      
      logger.debug(`Successfully navigated to ${url}`, {
        duration: step.duration,
      });

      return step;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error(`Failed to navigate to ${url}`, {
        error: errorMessage,
      });

      const step: ExplorationStep = {
        id: stepId,
        type: 'navigate',
        url,
        timestamp: startTime,
        duration: Date.now() - startTime.getTime(),
        success: false,
        error: errorMessage,
      };

      return step;
    } finally {
      if (spanId) {
        this.monitoring?.endSpan(spanId);
      }
    }
  }

  /**
   * Create a new Browserbase session
   */
  private async createBrowserbaseSession(): Promise<any> {
    try {
      const session = await this.browserbase.sessions.create({
        projectId: this.config.browserbase.projectId,
        browserSettings: {
          viewport: { width: 1280, height: 720 },
        },
        ...(this.config.browserbase.region && { region: this.config.browserbase.region }),
      });

      this.sessions.set(session.id, session);
      
      logger.debug('Created Browserbase session', {
        sessionId: session.id,
        projectId: this.config.browserbase.projectId,
      });

      return session;
    } catch (error) {
      logger.error('Failed to create Browserbase session', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Initialize Stagehand with a Browserbase session
   */
  private async initializeStagehand(session: any): Promise<Page> {
    try {
      // Connect Stagehand to the Browserbase session
      const page = await this.stagehand.page;
      
      if (!page) {
        throw new Error('Failed to initialize Stagehand page');
      }

      // Set up page with our configuration
      await page.setViewportSize({ width: 1280, height: 720 });
      
      logger.debug('Initialized Stagehand with Browserbase session', {
        sessionId: session.id,
      });

      return page;
    } catch (error) {
      logger.error('Failed to initialize Stagehand', {
        sessionId: session.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Perform AI-guided exploration of a target
   */
  private async performAIGuidedExploration(page: Page, target: ExplorationTarget): Promise<UserPath[]> {
    const userPaths: UserPath[] = [];
    const visitedUrls = new Set<string>();
    let currentDepth = 0;

    try {
      // Start with the initial navigation
      const initialPath: UserPath = {
        id: uuidv4(),
        name: `Exploration of ${target.domain}`,
        url: target.url,
        steps: [],
        duration: 0,
        success: false,
        screenshots: [],
        metadata: { depth: 0 },
      };

      // Navigate to the starting URL
      const navStep = await this.navigateToUrl(page, target.url);
      initialPath.steps.push(navStep);
      visitedUrls.add(target.url);

      // AI-guided exploration loop
      while (currentDepth < target.maxDepth && userPaths.length < target.maxPages) {
        try {
          // Use Stagehand to observe the current page and find interesting elements
          const observations = await this.stagehand.observe({
            instruction: 'Find all clickable elements like buttons, links, and form controls that might lead to interesting content or functionality',
          });

          // Filter observations based on target patterns
          const relevantElements = this.filterElementsByPatterns(observations, target);

          // Interact with promising elements
          for (const element of relevantElements.slice(0, 3)) { // Limit to 3 interactions per page
            try {
              const interactionStep = await this.interactWithElement(
                page,
                `Click on the element: ${element.selector}`
              );
              
              initialPath.steps.push(interactionStep);

              // If navigation occurred, check if it's a new URL
              const currentUrl = page.url();
              if (!visitedUrls.has(currentUrl) && this.isRelevantUrl(currentUrl, target)) {
                visitedUrls.add(currentUrl);
                
                // Create a new path for this navigation
                const newPath: UserPath = {
                  id: uuidv4(),
                  name: `Navigation to ${new URL(currentUrl).pathname}`,
                  url: currentUrl,
                  steps: [interactionStep],
                  duration: 0,
                  success: true,
                  screenshots: interactionStep.screenshot ? [interactionStep.screenshot] : [],
                  metadata: { depth: currentDepth + 1, parentPath: initialPath.id },
                };

                userPaths.push(newPath);
              }

              // Wait between interactions to appear human-like
              await page.waitForTimeout(1000 + Math.random() * 2000);

            } catch (error) {
              logger.warn('Failed interaction during exploration', {
                element: element.selector,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          currentDepth++;

          // Navigate back or to a new promising URL if we have one
          if (userPaths.length > 0 && Math.random() > 0.5) {
            const randomPath = userPaths[Math.floor(Math.random() * userPaths.length)];
            if (randomPath.url !== page.url()) {
              const backNavStep = await this.navigateToUrl(page, randomPath.url);
              initialPath.steps.push(backNavStep);
            }
          }

        } catch (error) {
          logger.warn('Error during exploration iteration', {
            depth: currentDepth,
            error: error instanceof Error ? error.message : String(error),
          });
          break;
        }
      }

      // Calculate final metrics for initial path
      initialPath.duration = initialPath.steps.reduce((sum, step) => sum + step.duration, 0);
      initialPath.success = initialPath.steps.some(step => step.success);
      initialPath.screenshots = initialPath.steps
        .map(step => step.screenshot)
        .filter(Boolean) as string[];

      userPaths.unshift(initialPath); // Add initial path at the beginning

      logger.info('Completed AI-guided exploration', {
        pathsCreated: userPaths.length,
        depthReached: currentDepth,
        urlsVisited: visitedUrls.size,
      });

      return userPaths;

    } catch (error) {
      logger.error('Failed during AI-guided exploration', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Handle authentication for the target
   */
  private async handleAuthentication(page: Page, target: ExplorationTarget): Promise<void> {
    if (!this.authManager || !target.authStrategy) {
      return;
    }

    try {
      logger.debug('Handling authentication', {
        strategy: target.authStrategy,
        url: target.url,
      });

      await this.authManager.authenticate(page, target.authStrategy, {
        // Authentication credentials would come from configuration
        username: process.env.AUTH_USERNAME,
        password: process.env.AUTH_PASSWORD,
      });

      logger.debug('Authentication completed successfully');
    } catch (error) {
      logger.error('Authentication failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Analyze an element to extract detailed information
   */
  private async analyzeElement(page: Page, selector: string): Promise<ElementInfo | null> {
    try {
      const element = page.locator(selector).first();
      
      if (!await element.isVisible()) {
        return null;
      }

      const [tagName, text, boundingBox, attributes] = await Promise.all([
        element.evaluate(el => el.tagName.toLowerCase()),
        element.textContent(),
        element.boundingBox(),
        element.evaluate(el => {
          const attrs: Record<string, string> = {};
          for (const attr of el.attributes) {
            attrs[attr.name] = attr.value;
          }
          return attrs;
        }),
      ]);

      const [isClickable, isFormField] = await Promise.all([
        element.evaluate(el => {
          const clickableTypes = ['button', 'a', 'input', 'select', 'textarea'];
          return clickableTypes.includes(el.tagName.toLowerCase()) || 
                 el.getAttribute('onclick') !== null ||
                 el.getAttribute('role') === 'button';
        }),
        element.evaluate(el => {
          const formTypes = ['input', 'select', 'textarea'];
          return formTypes.includes(el.tagName.toLowerCase());
        }),
      ]);

      return {
        tagName,
        text: text || undefined,
        attributes,
        boundingBox: boundingBox || undefined,
        isVisible: true,
        isClickable,
        isFormField,
      };

    } catch (error) {
      logger.debug(`Failed to analyze element ${selector}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Take a screenshot of the current page
   */
  private async takeScreenshot(page: Page): Promise<string> {
    try {
      const screenshot = await page.screenshot({
        type: 'png',
        quality: this.config.screenshotQuality || 80,
        fullPage: false, // Only visible area for performance
      });

      // Convert to base64 for storage
      return `data:image/png;base64,${screenshot.toString('base64')}`;
    } catch (error) {
      logger.warn('Failed to take screenshot', {
        error: error instanceof Error ? error.message : String(error),
      });
      return '';
    }
  }

  /**
   * Filter elements based on target patterns
   */
  private filterElementsByPatterns(elements: any[], target: ExplorationTarget): any[] {
    if (!target.patterns && !target.excludePatterns) {
      return elements;
    }

    return elements.filter(element => {
      const text = element.text?.toLowerCase() || '';
      const selector = element.selector?.toLowerCase() || '';
      
      // Check include patterns
      if (target.patterns) {
        const matchesInclude = target.patterns.some(pattern => 
          text.includes(pattern.toLowerCase()) || 
          selector.includes(pattern.toLowerCase())
        );
        if (!matchesInclude) return false;
      }

      // Check exclude patterns
      if (target.excludePatterns) {
        const matchesExclude = target.excludePatterns.some(pattern =>
          text.includes(pattern.toLowerCase()) || 
          selector.includes(pattern.toLowerCase())
        );
        if (matchesExclude) return false;
      }

      return true;
    });
  }

  /**
   * Check if a URL is relevant for exploration
   */
  private isRelevantUrl(url: string, target: ExplorationTarget): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === new URL(target.url).hostname;
    } catch {
      return false;
    }
  }

  /**
   * Infer step type from instruction
   */
  private inferStepType(instruction: string): ExplorationStep['type'] {
    const lower = instruction.toLowerCase();
    
    if (lower.includes('click')) return 'click';
    if (lower.includes('fill') || lower.includes('type') || lower.includes('enter')) return 'fill';
    if (lower.includes('select')) return 'select';
    if (lower.includes('hover')) return 'hover';
    if (lower.includes('scroll')) return 'scroll';
    if (lower.includes('wait')) return 'wait';
    if (lower.includes('extract') || lower.includes('get')) return 'extract';
    
    return 'click'; // Default fallback
  }

  /**
   * Clean up a browser session
   */
  private async cleanupSession(sessionId: string): Promise<void> {
    try {
      if (this.sessions.has(sessionId)) {
        const session = this.sessions.get(sessionId);
        // The Browserbase SDK should handle session cleanup automatically
        this.sessions.delete(sessionId);
        
        logger.debug('Cleaned up browser session', { sessionId });
      }
    } catch (error) {
      logger.warn('Failed to cleanup session', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Update agent metrics
   */
  private updateMetrics(success: boolean, duration: number): void {
    this.metrics.tasksCompleted++;
    if (success) {
      this.metrics.tasksSuccessful++;
    } else {
      this.metrics.tasksFailed++;
    }
    
    this.metrics.averageTaskDuration = 
      (this.metrics.averageTaskDuration * (this.metrics.tasksCompleted - 1) + duration) / 
      this.metrics.tasksCompleted;
      
    this.metrics.totalRuntime += duration;
    this.metrics.lastActivity = new Date();
    
    // Update memory usage (simplified)
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = memUsage.heapUsed;
  }

  /**
   * Set up event handlers for monitoring and logging
   */
  private setupEventHandlers(): void {
    // Handle uncaught errors
    this.on('error', (error) => {
      logger.error('ExplorerAgent error', {
        error: error.message,
        stack: error.stack,
      });
      this.monitoring?.recordCounter('agent_errors', 1, { type: 'uncaught' });
    });

    // Periodic metrics reporting
    setInterval(() => {
      if (this.monitoring) {
        this.monitoring.recordGauge('agent_tasks_completed', this.metrics.tasksCompleted);
        this.monitoring.recordGauge('agent_success_rate', 
          this.metrics.tasksCompleted > 0 ? 
            this.metrics.tasksSuccessful / this.metrics.tasksCompleted : 0
        );
        this.monitoring.recordGauge('agent_memory_usage', this.metrics.memoryUsage);
      }
    }, 60000); // Every minute
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down ExplorerAgent');
    
    try {
      // Clean up all active sessions
      for (const sessionId of this.sessions.keys()) {
        await this.cleanupSession(sessionId);
      }

      // Close Stagehand
      if (this.stagehand) {
        await this.stagehand.close();
      }

      logger.info('ExplorerAgent shutdown completed');
    } catch (error) {
      logger.error('Error during ExplorerAgent shutdown', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}