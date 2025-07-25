import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { stagehandTools } from '../../tools/stagehand';
import { Stagehand } from '@browserbasehq/stagehand';
import { Browserbase } from '@browserbasehq/sdk';
import { Page, BrowserContext } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { EventEmitter } from 'events';
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
  AgentCapabilities,
  AgentMetrics,
} from '../types';

interface StagehandResult {
  success: boolean;
  message: string;
  action: string;
}

interface StagehandElement {
  selector: string;
  description: string;
  backendNodeId?: number;
  method?: string;
  arguments?: string[];
}

interface BrowserbaseSession {
  id: string;
  createdAt: string;
  startedAt: string;
  endedAt?: string;
  expiresAt: string;
  projectId: string;
  status: 'RUNNING' | 'COMPLETED' | 'ERROR' | 'TIMED_OUT';
  proxyBytes?: number;
  keepAlive: boolean;
  contextId?: string;
}

export interface ExplorationEvent {
  id: string;
  type: 'session_created' | 'navigation_started' | 'navigation_completed' | 'page_analyzed' | 'interaction_started' | 'interaction_completed' | 'elements_extracted' | 'command_executed' | 'exploration_completed' | 'error_occurred' | 'progress_update';
  timestamp: Date;
  data: any;
  sessionId?: string;
  url?: string;
  progress?: {
    current: number;
    total: number;
    percentage: number;
    message: string;
  };
}

export interface StreamingOptions {
  enableProgress?: boolean;
  enableRealTimeUpdates?: boolean;
  enableScreenshots?: boolean;
  progressInterval?: number;
}

export interface ExplorationEventCallback {
  (event: ExplorationEvent): void;
}

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

  private sessions: Map<string, BrowserbaseSession> = new Map();

  private activePaths: Map<string, UserPath> = new Map();

  private config: ExplorerAgentConfig;

  private metrics: AgentMetrics;

  private eventEmitter: EventEmitter = new EventEmitter();

  private streamingCallbacks: Map<string, ExplorationEventCallback> = new Map();

  constructor(config: ExplorerAgentConfig) {
    super({
      id: 'explorer-agent',
      name: 'ExplorerAgent',
      instructions:
        'AI-powered web exploration agent using Browserbase and Stagehand. Use the stagehand tools to interact with web pages: stagehand-act for performing actions, stagehand-observe for finding elements, and stagehand-extract for extracting data.',
      model: openai('gpt-4'),
      tools: stagehandTools,
    });

    this.config = config;
    this.browserbase = new Browserbase({
      apiKey: config.browserbase.apiKey,
    });
    this.stagehand = new Stagehand({
      ...config.stagehand,
      env: 'LOCAL',
    });
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
   * Subscribe to exploration events for streaming updates
   */
  onExplorationEvent(callback: ExplorationEventCallback): string {
    const subscriptionId = uuidv4();
    this.streamingCallbacks.set(subscriptionId, callback);
    return subscriptionId;
  }

  /**
   * Unsubscribe from exploration events
   */
  offExplorationEvent(subscriptionId: string): void {
    this.streamingCallbacks.delete(subscriptionId);
  }

  /**
   * Emit exploration event to all subscribers
   */
  private emitExplorationEvent(event: Omit<ExplorationEvent, 'id' | 'timestamp'>): void {
    const fullEvent: ExplorationEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      ...event,
    };

    // Emit to event emitter
    this.eventEmitter.emit('exploration:event', fullEvent);

    // Call all streaming callbacks
    this.streamingCallbacks.forEach((callback) => {
      try {
        callback(fullEvent);
      } catch (error) {
        logger.warn('Error in streaming callback', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // Log the event
    logger.debug('Exploration event emitted', {
      type: fullEvent.type,
      id: fullEvent.id,
      url: fullEvent.url,
    });
  }

  /**
   * Explore using natural language goals and instructions
   */
  async exploreWithNaturalLanguage(
    target: ExplorationTarget,
    goal: string,
    instructions?: string[]
  ): Promise<ExplorationResult> {
    const startTime = new Date();
    const explorationId = uuidv4();
    const spanId = this.monitoring?.startSpan('explorer_nl_explore', undefined);

    try {
      logger.info(`Starting natural language exploration`, {
        explorationId,
        target: target.url,
        goal,
        instructions: instructions?.length || 0,
      });

      // Create Browserbase session
      const session = await this.createBrowserbaseSession();
      const page = await this.initializeStagehand(session);

      // Apply stealth mode if configured
      if (this.stealth) {
        await this.stealth.applyPageStealthMeasures(page);
      }

      // Handle authentication if required
      if (target.requireAuth && this.authManager) {
        await this.handleAuthentication(page, target);
      }

      // Navigate to target
      const navStep = await this.navigateToUrl(page, target.url);

      // Start with initial path
      const initialPath: UserPath = {
        id: uuidv4(),
        name: `Natural Language Exploration: ${goal}`,
        url: target.url,
        steps: [navStep],
        duration: 0,
        success: false,
        screenshots: [],
        metadata: { goal, naturalLanguage: true },
      };

      const userPaths: UserPath[] = [initialPath];

      // Execute natural language instructions
      if (instructions && instructions.length > 0) {
        for (const instruction of instructions) {
          try {
            const commandSteps = await this.executeNaturalLanguageCommand(page, instruction, {
              goal,
              previousSteps: initialPath.steps,
            });

            initialPath.steps.push(...commandSteps);

            // Check if we navigated to new pages and create new paths
            const currentUrl = page.url();
            if (currentUrl !== target.url && !userPaths.some((p) => p.url === currentUrl)) {
              const newPath: UserPath = {
                id: uuidv4(),
                name: `Navigation result: ${instruction}`,
                url: currentUrl,
                steps: commandSteps.filter((s) => s.url === currentUrl),
                duration: 0,
                success: commandSteps.some((s) => s.success),
                screenshots: commandSteps.map((s) => s.screenshot).filter(Boolean) as string[],
                metadata: {
                  goal,
                  naturalLanguage: true,
                  parentPath: initialPath.id,
                  instruction,
                },
              };
              userPaths.push(newPath);
            }
          } catch (error) {
            logger.warn('Failed to execute natural language instruction', {
              instruction,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      } else {
        // Auto-explore based on goal if no specific instructions
        const autoExploreSteps = await this.executeNaturalLanguageCommand(
          page,
          `Explore this website to achieve the goal: ${goal}. Look for relevant buttons, links, forms, and content.`,
          { goal }
        );
        initialPath.steps.push(...autoExploreSteps);
      }

      // Finalize metrics
      const endTime = new Date();
      initialPath.duration = initialPath.steps.reduce((sum, step) => sum + step.duration, 0);
      initialPath.success = initialPath.steps.some((step) => step.success);
      initialPath.screenshots = initialPath.steps
        .map((step) => step.screenshot)
        .filter(Boolean) as string[];

      const result: ExplorationResult = {
        id: explorationId,
        target,
        startTime,
        endTime,
        pagesExplored: userPaths.length,
        elementsFound: userPaths.reduce(
          (sum, path) => sum + path.steps.filter((s) => s.elementInfo).length,
          0
        ),
        interactionsRecorded: userPaths.reduce((sum, path) => sum + path.steps.length, 0),
        screenshotsTaken: userPaths.reduce((sum, path) => sum + path.screenshots.length, 0),
        userPaths,
        errors: userPaths.flatMap((path) =>
          path.steps
            .filter((s) => !s.success && s.error)
            .map((s) => ({
              id: uuidv4(),
              type: 'interaction' as const,
              message: s.error!,
              url: s.url,
              selector: s.selector,
              timestamp: s.timestamp,
              recoverable: true,
            }))
        ),
        metadata: {
          browserbaseSessionId: session.id,
          explorationDuration: endTime.getTime() - startTime.getTime(),
          goal,
          naturalLanguageMode: true,
          instructionsProvided: instructions?.length || 0,
          userAgent: await page.evaluate(() => navigator.userAgent),
        },
      };

      // Clean up session
      await this.cleanupSession(session.id);

      this.updateMetrics(true, endTime.getTime() - startTime.getTime());
      this.monitoring?.recordCounter('nl_explorations_completed', 1, { status: 'success' });

      logger.info(`Completed natural language exploration`, {
        explorationId,
        goal,
        pagesExplored: result.pagesExplored,
        interactionsRecorded: result.interactionsRecorded,
      });

      return result;
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime.getTime());
      this.monitoring?.recordCounter('nl_explorations_completed', 1, { status: 'error' });

      logger.error(`Failed natural language exploration`, {
        explorationId,
        goal,
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
   * Streaming version of natural language exploration with real-time updates
   */
  async* exploreWithNaturalLanguageStream(
    target: ExplorationTarget,
    goal: string,
    instructions?: string[],
    options: StreamingOptions = {}
  ): AsyncGenerator<ExplorationEvent, ExplorationResult> {
    const startTime = new Date();
    const explorationId = uuidv4();
    const spanId = this.monitoring?.startSpan('explorer_nl_explore_stream', undefined);

    try {
      this.emitExplorationEvent({
        type: 'progress_update',
        data: { message: 'Starting natural language exploration' },
        progress: { current: 0, total: 10, percentage: 0, message: 'Initializing...' },
      });

      // Create Browserbase session
      const session = await this.createBrowserbaseSession();
      
      yield {
        id: uuidv4(),
        type: 'session_created',
        timestamp: new Date(),
        data: { sessionId: session.id },
        sessionId: session.id,
      };

      this.emitExplorationEvent({
        type: 'progress_update',
        data: { message: 'Browser session created' },
        progress: { current: 1, total: 10, percentage: 10, message: 'Initializing browser...' },
      });

      const page = await this.initializeStagehand(session);

      // Apply stealth mode if configured
      if (this.stealth) {
        await this.stealth.applyPageStealthMeasures(page);
      }

      // Handle authentication if required
      if (target.requireAuth && this.authManager) {
        this.emitExplorationEvent({
          type: 'progress_update',
          data: { message: 'Handling authentication' },
          progress: { current: 2, total: 10, percentage: 20, message: 'Authenticating...' },
        });
        await this.handleAuthentication(page, target);
      }

      // Navigate to target
      yield {
        id: uuidv4(),
        type: 'navigation_started',
        timestamp: new Date(),
        data: { url: target.url },
        url: target.url,
      };

      const navStep = await this.navigateToUrl(page, target.url);
      
      yield {
        id: uuidv4(),
        type: 'navigation_completed',
        timestamp: new Date(),
        data: { step: navStep },
        url: target.url,
      };

      this.emitExplorationEvent({
        type: 'progress_update',
        data: { message: 'Navigation completed' },
        progress: { current: 3, total: 10, percentage: 30, message: 'Analyzing page...' },
      });

      // Start with initial path
      const initialPath: UserPath = {
        id: uuidv4(),
        name: `Natural Language Exploration: ${goal}`,
        url: target.url,
        steps: [navStep],
        duration: 0,
        success: false,
        screenshots: [],
        metadata: { goal, naturalLanguage: true },
      };

      const userPaths: UserPath[] = [initialPath];

      // Execute natural language instructions with streaming
      if (instructions && instructions.length > 0) {
        this.emitExplorationEvent({
          type: 'progress_update',
          data: { message: 'Executing instructions' },
          progress: { current: 4, total: 10, percentage: 40, message: 'Processing instructions...' },
        });

        for (let i = 0; i < instructions.length; i++) {
          const instruction = instructions[i];
          
          yield {
            id: uuidv4(),
            type: 'command_executed',
            timestamp: new Date(),
            data: { instruction, index: i, total: instructions.length },
            url: page.url(),
          };

          try {
            const commandSteps = await this.executeNaturalLanguageCommand(page, instruction, {
              goal,
              previousSteps: initialPath.steps,
            });
            
            initialPath.steps.push(...commandSteps);
            
            // Emit interaction events for each step
            for (const step of commandSteps) {
              yield {
                id: uuidv4(),
                type: 'interaction_completed',
                timestamp: new Date(),
                data: { step },
                url: step.url,
              };
            }

            // Check if we navigated to new pages and create new paths
            const currentUrl = page.url();
            if (currentUrl !== target.url && !userPaths.some((p) => p.url === currentUrl)) {
              const newPath: UserPath = {
                id: uuidv4(),
                name: `Navigation result: ${instruction}`,
                url: currentUrl,
                steps: commandSteps.filter((s) => s.url === currentUrl),
                duration: 0,
                success: commandSteps.some((s) => s.success),
                screenshots: commandSteps.map((s) => s.screenshot).filter(Boolean) as string[],
                metadata: { 
                  goal, 
                  naturalLanguage: true, 
                  parentPath: initialPath.id,
                  instruction 
                },
              };
              userPaths.push(newPath);
            }

            // Update progress
            const progressPercentage = 40 + ((i + 1) / instructions.length) * 40;
            this.emitExplorationEvent({
              type: 'progress_update',
              data: { message: `Completed instruction ${i + 1}/${instructions.length}` },
              progress: { 
                current: 4 + i + 1, 
                total: 10, 
                percentage: progressPercentage, 
                message: `Instruction ${i + 1}/${instructions.length} completed` 
              },
            });

          } catch (error) {
            yield {
              id: uuidv4(),
              type: 'error_occurred',
              timestamp: new Date(),
              data: { 
                error: error instanceof Error ? error.message : String(error),
                instruction,
                index: i 
              },
              url: page.url(),
            };

            logger.warn('Failed to execute natural language instruction', {
              instruction,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      } else {
        // Auto-explore based on goal if no specific instructions
        this.emitExplorationEvent({
          type: 'progress_update',
          data: { message: 'Auto-exploring based on goal' },
          progress: { current: 5, total: 10, percentage: 50, message: 'Auto-exploring...' },
        });

        const autoExploreSteps = await this.executeNaturalLanguageCommand(
          page, 
          `Explore this website to achieve the goal: ${goal}. Look for relevant buttons, links, forms, and content.`,
          { goal }
        );
        initialPath.steps.push(...autoExploreSteps);

        // Emit interaction events
        for (const step of autoExploreSteps) {
          yield {
            id: uuidv4(),
            type: 'interaction_completed',
            timestamp: new Date(),
            data: { step },
            url: step.url,
          };
        }
      }

      // Finalize metrics
      this.emitExplorationEvent({
        type: 'progress_update',
        data: { message: 'Finalizing exploration results' },
        progress: { current: 8, total: 10, percentage: 80, message: 'Processing results...' },
      });

      const endTime = new Date();
      initialPath.duration = initialPath.steps.reduce((sum, step) => sum + step.duration, 0);
      initialPath.success = initialPath.steps.some((step) => step.success);
      initialPath.screenshots = initialPath.steps
        .map((step) => step.screenshot)
        .filter(Boolean) as string[];

      const result: ExplorationResult = {
        id: explorationId,
        target,
        startTime,
        endTime,
        pagesExplored: userPaths.length,
        elementsFound: userPaths.reduce(
          (sum, path) => sum + path.steps.filter((s) => s.elementInfo).length,
          0
        ),
        interactionsRecorded: userPaths.reduce((sum, path) => sum + path.steps.length, 0),
        screenshotsTaken: userPaths.reduce((sum, path) => sum + path.screenshots.length, 0),
        userPaths,
        errors: userPaths.flatMap((path) =>
          path.steps
            .filter((s) => !s.success && s.error)
            .map((s) => ({
              id: uuidv4(),
              type: 'interaction' as const,
              message: s.error!,
              url: s.url,
              selector: s.selector,
              timestamp: s.timestamp,
              recoverable: true,
            }))
        ),
        metadata: {
          browserbaseSessionId: session.id,
          explorationDuration: endTime.getTime() - startTime.getTime(),
          goal,
          naturalLanguageMode: true,
          instructionsProvided: instructions?.length || 0,
          userAgent: await page.evaluate(() => navigator.userAgent),
        },
      };

      // Clean up session
      await this.cleanupSession(session.id);

      this.emitExplorationEvent({
        type: 'progress_update',
        data: { message: 'Exploration completed successfully' },
        progress: { current: 10, total: 10, percentage: 100, message: 'Complete!' },
      });

      yield {
        id: uuidv4(),
        type: 'exploration_completed',
        timestamp: new Date(),
        data: { result },
        sessionId: session.id,
      };

      this.updateMetrics(true, endTime.getTime() - startTime.getTime());
      this.monitoring?.recordCounter('nl_explorations_completed', 1, { status: 'success' });

      logger.info(`Completed streaming natural language exploration`, {
        explorationId,
        goal,
        pagesExplored: result.pagesExplored,
        interactionsRecorded: result.interactionsRecorded,
      });

      return result;
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime.getTime());
      this.monitoring?.recordCounter('nl_explorations_completed', 1, { status: 'error' });

      yield {
        id: uuidv4(),
        type: 'error_occurred',
        timestamp: new Date(),
        data: { 
          error: error instanceof Error ? error.message : String(error),
          goal 
        },
      };

      logger.error(`Failed streaming natural language exploration`, {
        explorationId,
        goal,
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
        await this.stealth.applyPageStealthMeasures(page);
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
        pagesExplored: userPaths.reduce(
          (sum, path) => sum + path.steps.filter((s) => s.type === 'navigate').length,
          0
        ),
        elementsFound: userPaths.reduce(
          (sum, path) => sum + path.steps.filter((s) => s.elementInfo).length,
          0
        ),
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

      // Use Stagehand's AI-powered element detection and extraction
      const extractionInstruction = selectors?.length
        ? `Find and analyze all elements matching these patterns: ${selectors.join(', ')}. Extract their tag names, text content, attributes, visibility status, clickability, and form field properties.`
        : 'Find and analyze all interactive elements on the page including buttons, links, forms, inputs, and other actionable elements. Extract their properties including tag names, text content, visibility, clickability, and form field status.';

      const extractionResult = await this.stagehand.extract({
        instruction: extractionInstruction,
        schema: z.object({
          elements: z.array(
            z.object({
              selector: z.string(),
              tagName: z.string(),
              text: z.string().optional(),
              attributes: z.record(z.string()),
              isVisible: z.boolean(),
              isClickable: z.boolean(),
              isFormField: z.boolean(),
              boundingBox: z
                .object({
                  x: z.number(),
                  y: z.number(),
                  width: z.number(),
                  height: z.number(),
                })
                .optional(),
            })
          ),
        }),
      });

      // Convert Stagehand extraction results to our ElementInfo format
      const elementInfos: ElementInfo[] = [];

      if (extractionResult?.elements && Array.isArray(extractionResult.elements)) {
        for (const elementData of extractionResult.elements) {
          try {
            // Only include visible elements
            if (elementData.isVisible) {
              const elementInfo: ElementInfo = {
                tagName: elementData.tagName?.toLowerCase() || 'unknown',
                text: elementData.text || undefined,
                attributes: elementData.attributes || {},
                boundingBox:
                  elementData.boundingBox &&
                  elementData.boundingBox.x !== undefined &&
                  elementData.boundingBox.y !== undefined &&
                  elementData.boundingBox.width !== undefined &&
                  elementData.boundingBox.height !== undefined
                    ? (elementData.boundingBox as {
                        x: number;
                        y: number;
                        width: number;
                        height: number;
                      })
                    : undefined,
                isVisible: elementData.isVisible,
                isClickable: elementData.isClickable || false,
                isFormField: elementData.isFormField || false,
              };
              elementInfos.push(elementInfo);
            }
          } catch (error) {
            logger.warn(`Failed to process element data`, {
              element: elementData.selector || 'unknown',
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      // Fallback to observe API if extraction didn't return structured data
      if (elementInfos.length === 0) {
        logger.debug('Extraction returned no elements, falling back to observe API');

        const elements = await this.stagehand.observe({
          instruction: selectors?.length
            ? `Find elements matching these selectors: ${selectors.join(', ')}`
            : 'Find all interactive elements on the page including buttons, links, forms, and inputs',
        });

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
      }

      this.monitoring?.recordGauge('elements_extracted', elementInfos.length);

      logger.debug(`Extracted ${elementInfos.length} elements from page using AI`);
      return elementInfos;
    } catch (error) {
      logger.error('Failed to extract elements with Stagehand', {
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
   * Execute natural language browser commands
   */
  async executeNaturalLanguageCommand(
    page: Page,
    command: string,
    context?: { goal?: string; previousSteps?: ExplorationStep[] }
  ): Promise<ExplorationStep[]> {
    const stepId = uuidv4();
    const startTime = new Date();
    const spanId = this.monitoring?.startSpan('explorer_nl_command');

    try {
      logger.info('Executing natural language command', {
        command,
        goal: context?.goal,
        url: page.url(),
      });

      // Break down complex commands into steps using AI
      const planningResult = await this.stagehand.extract({
        instruction: `Break down this natural language browser command into specific actionable steps: "${command}". ${context?.goal ? `The overall goal is: ${context.goal}.` : ''} Return a list of specific actions that need to be performed.`,
        schema: z.object({
          steps: z.array(
            z.object({
              action: z.string(),
              description: z.string(),
              type: z.enum([
                'navigate',
                'click',
                'fill',
                'select',
                'wait',
                'extract',
                'scroll',
                'hover',
              ]),
            })
          ),
        }),
      });

      const steps: ExplorationStep[] = [];

      if (planningResult?.steps && Array.isArray(planningResult.steps)) {
        // Execute each planned step
        for (const plannedStep of planningResult.steps) {
          try {
            const stepResult = await this.performAIGuidedAction(
              page,
              plannedStep.action,
              plannedStep.type
            );
            steps.push(stepResult);

            // Wait between steps to appear human-like
            await page.waitForTimeout(500 + Math.random() * 1000);
          } catch (error) {
            logger.warn('Failed to execute planned step', {
              step: plannedStep.action,
              error: error instanceof Error ? error.message : String(error),
            });

            // Add failed step to results
            steps.push({
              id: uuidv4(),
              type: (plannedStep.type as ExplorationStep['type']) || 'click',
              timestamp: new Date(),
              duration: 0,
              success: false,
              error: error instanceof Error ? error.message : String(error),
              url: page.url(),
            });
          }
        }
      } else {
        // Fallback: execute as single action if planning failed
        const singleStep = await this.performAIGuidedAction(page, command);
        steps.push(singleStep);
      }

      this.monitoring?.recordHistogram('nl_command_duration', Date.now() - startTime.getTime());
      this.monitoring?.recordGauge('nl_command_steps', steps.length);

      logger.info('Completed natural language command', {
        command,
        stepsExecuted: steps.length,
        successfulSteps: steps.filter((s) => s.success).length,
      });

      return steps;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Failed to execute natural language command', {
        command,
        error: errorMessage,
      });

      return [
        {
          id: stepId,
          type: 'click', // Default fallback
          timestamp: startTime,
          duration: Date.now() - startTime.getTime(),
          success: false,
          error: errorMessage,
          url: page.url(),
        },
      ];
    } finally {
      if (spanId) {
        this.monitoring?.endSpan(spanId);
      }
    }
  }

  /**
   * Perform a single AI-guided action
   */
  private async performAIGuidedAction(
    page: Page,
    action: string,
    expectedType?: string
  ): Promise<ExplorationStep> {
    const stepId = uuidv4();
    const startTime = new Date();

    try {
      // Take screenshot before action
      const beforeScreenshot = await this.takeScreenshot(page);

      // Use Stagehand to perform the action
      const result = await this.stagehand.act({
        action,
      });

      // Take screenshot after action
      const afterScreenshot = await this.takeScreenshot(page);

      const endTime = new Date();
      const step: ExplorationStep = {
        id: stepId,
        type: expectedType ? (expectedType as ExplorationStep['type']) : this.inferStepType(action),
        selector: undefined, // Stagehand doesn't expose specific selectors
        value: undefined,
        url: page.url(),
        timestamp: startTime,
        duration: endTime.getTime() - startTime.getTime(),
        success: result.success || false,
        screenshot: afterScreenshot,
        elementInfo: undefined,
      };

      return step;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        id: stepId,
        type: expectedType ? (expectedType as ExplorationStep['type']) : this.inferStepType(action),
        timestamp: startTime,
        duration: Date.now() - startTime.getTime(),
        success: false,
        error: errorMessage,
        url: page.url(),
      };
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
      await this.takeScreenshot(page);

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
        selector: undefined, // Stagehand doesn't return specific selector in act result
        value: undefined, // Stagehand doesn't return value in act result
        url: page.url(),
        timestamp: startTime,
        duration: endTime.getTime() - startTime.getTime(),
        success: result.success || false,
        screenshot: afterScreenshot,
        elementInfo: undefined, // Would need separate element detection
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
  private async createBrowserbaseSession(): Promise<BrowserbaseSession> {
    try {
      const session = await this.browserbase.createSession({
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
  private async initializeStagehand(session: BrowserbaseSession): Promise<Page> {
    try {
      // Stagehand should be initialized with browserbaseSessionID
      if (session.id) {
        this.stagehand.browserbaseSessionID = session.id;
      }

      // Initialize Stagehand
      await this.stagehand.init();

      // Get the page from Stagehand
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
  private async performAIGuidedExploration(
    page: Page,
    target: ExplorationTarget
  ): Promise<UserPath[]> {
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
            instruction:
              'Find all clickable elements like buttons, links, and form controls that might lead to interesting content or functionality',
          });

          // Filter observations based on target patterns
          const relevantElements = this.filterElementsByPatterns(observations, target);

          // Interact with promising elements
          for (const element of relevantElements.slice(0, 3)) {
            // Limit to 3 interactions per page
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
      initialPath.success = initialPath.steps.some((step) => step.success);
      initialPath.screenshots = initialPath.steps
        .map((step) => step.screenshot)
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

      const authConfig: any = {
        strategy: target.authStrategy || 'basic',
        credentials: {
          username: process.env.AUTH_USERNAME,
          password: process.env.AUTH_PASSWORD,
        },
        sessionPersistence: true,
      };
      await this.authManager.authenticate(page, authConfig);

      logger.debug('Authentication completed successfully');
    } catch (error) {
      logger.error('Authentication failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Analyze an element using Stagehand AI-powered extraction
   */
  private async analyzeElement(page: Page, selector: string): Promise<ElementInfo | null> {
    try {
      // Use Stagehand to extract detailed element information
      const elementData = await this.stagehand.extract({
        instruction: `Analyze the element with selector "${selector}" and extract its tag name, text content, attributes, visibility, whether it's clickable, and whether it's a form field`,
        schema: z.object({
          tagName: z.string(),
          text: z.string().optional(),
          attributes: z.record(z.string()),
          isVisible: z.boolean(),
          isClickable: z.boolean(),
          isFormField: z.boolean(),
          boundingBox: z
            .object({
              x: z.number(),
              y: z.number(),
              width: z.number(),
              height: z.number(),
            })
            .optional(),
        }),
      });

      if (!elementData || !elementData.isVisible) {
        return null;
      }

      return {
        tagName: elementData.tagName?.toLowerCase() || 'unknown',
        text: elementData.text || undefined,
        attributes: elementData.attributes || {},
        boundingBox:
          elementData.boundingBox &&
          elementData.boundingBox.x !== undefined &&
          elementData.boundingBox.y !== undefined &&
          elementData.boundingBox.width !== undefined &&
          elementData.boundingBox.height !== undefined
            ? (elementData.boundingBox as { x: number; y: number; width: number; height: number })
            : undefined,
        isVisible: elementData.isVisible,
        isClickable: elementData.isClickable || false,
        isFormField: elementData.isFormField || false,
      };
    } catch (error) {
      logger.debug(`Failed to analyze element ${selector} with Stagehand`, {
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback to basic Playwright analysis if Stagehand fails
      try {
        const element = page.locator(selector).first();
        if (!(await element.isVisible())) {
          return null;
        }

        const [tagName, text, isClickable] = await Promise.all([
          element.evaluate((el) => el.tagName.toLowerCase()),
          element.textContent(),
          element.evaluate((el) => {
            const clickableTypes = ['button', 'a', 'input', 'select', 'textarea'];
            return (
              clickableTypes.includes(el.tagName.toLowerCase()) ||
              el.getAttribute('onclick') !== null ||
              el.getAttribute('role') === 'button'
            );
          }),
        ]);

        return {
          tagName,
          text: text || undefined,
          attributes: {},
          isVisible: true,
          isClickable,
          isFormField: ['input', 'select', 'textarea'].includes(tagName),
        };
      } catch (fallbackError) {
        logger.warn(`Fallback element analysis also failed for ${selector}`, {
          error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        });
        return null;
      }
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
  private filterElementsByPatterns(
    elements: StagehandElement[],
    target: ExplorationTarget
  ): StagehandElement[] {
    if (!target.patterns && !target.excludePatterns) {
      return elements;
    }

    return elements.filter((element) => {
      const text = element.description?.toLowerCase() || '';
      const selector = element.selector?.toLowerCase() || '';

      // Check include patterns
      if (target.patterns) {
        const matchesInclude = target.patterns.some(
          (pattern) =>
            text.includes(pattern.toLowerCase()) || selector.includes(pattern.toLowerCase())
        );
        if (!matchesInclude) return false;
      }

      // Check exclude patterns
      if (target.excludePatterns) {
        const matchesExclude = target.excludePatterns.some(
          (pattern) =>
            text.includes(pattern.toLowerCase()) || selector.includes(pattern.toLowerCase())
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
    // this.on('error', (error) => {
    // logger.error('ExplorerAgent error', {
    //   error: error.message,
    //   stack: error.stack,
    // });
    // this.monitoring?.recordCounter('agent_errors', 1, { type: 'uncaught' });
    // });

    // Periodic metrics reporting
    setInterval(() => {
      if (this.monitoring) {
        this.monitoring.recordGauge('agent_tasks_completed', this.metrics.tasksCompleted);
        this.monitoring.recordGauge(
          'agent_success_rate',
          this.metrics.tasksCompleted > 0
            ? this.metrics.tasksSuccessful / this.metrics.tasksCompleted
            : 0
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
