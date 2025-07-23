import { Page, BrowserContext } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import {
  UserPath,
  InteractionStep,
  StepType,
  Assertion,
  RecordingSession,
  RecordingOptions,
  PathMetadata,
  PathAnalysis,
} from '../types/recording';
import { InteractiveElement } from '../types/elements';
import { InteractionResult, NetworkActivity } from '../types/interactions';

export class UserPathRecorder {
  private session: RecordingSession | null = null;

  private steps: InteractionStep[] = [];

  private assertions: Assertion[] = [];

  private startTime: number = 0;

  private page: Page | null = null;

  private context: BrowserContext | null = null;

  private networkActivity: NetworkActivity[] = [];

  private consoleMessages: Array<{
    type: string;
    message: string;
    timestamp: Date;
  }> = [];

  constructor(
    private options: RecordingOptions = {
      captureScreenshots: true,
      captureNetwork: true,
      captureConsole: true,
      generateAssertions: true,
      assertionTypes: ['url', 'visible', 'text', 'value'],
      screenshotQuality: 80,
    }
  ) {}

  async startRecording(page: Page, metadata?: Partial<PathMetadata>): Promise<void> {
    if (this.session) {
      throw new Error('Recording already in progress');
    }

    this.page = page;
    this.context = page.context();
    this.startTime = Date.now();
    this.steps = [];
    this.assertions = [];
    this.networkActivity = [];
    this.consoleMessages = [];

    // Set up event listeners
    await this.setupEventListeners();

    // Create session
    this.session = {
      id: uuidv4(),
      startTime: new Date(),
      status: 'recording',
      currentPath: {
        id: uuidv4(),
        name: `Recording ${new Date().toISOString()}`,
        startUrl: page.url(),
        steps: [],
        assertions: [],
        duration: 0,
        metadata: {
          browser: 'chromium',
          viewport: page.viewportSize() || { width: 1920, height: 1080 },
          userAgent: await page.evaluate(() => navigator.userAgent),
          ...metadata,
        },
        createdAt: new Date(),
      },
      options: this.options,
    };

    logger.info('Started recording user path', {
      sessionId: this.session.id,
      url: page.url(),
    });
  }

  async stopRecording(): Promise<UserPath> {
    if (!this.session || !this.session.currentPath) {
      throw new Error('No recording in progress');
    }

    this.session.status = 'completed';
    this.session.endTime = new Date();

    // Clean up event listeners
    await this.cleanupEventListeners();

    // Finalize the path
    const path = this.session.currentPath;
    path.endUrl = this.page?.url();
    path.duration = Date.now() - this.startTime;
    path.steps = this.steps;
    path.assertions = this.assertions;

    // Generate final assertions
    if (this.options.generateAssertions) {
      await this.generateFinalAssertions();
    }

    // Analyze the path
    const analysis = this.analyzePath(path);
    logger.info('Recording completed', {
      sessionId: this.session.id,
      duration: path.duration,
      steps: path.steps.length,
      analysis,
    });

    // Reset state
    this.session = null;
    this.page = null;
    this.context = null;

    return path;
  }

  async recordNavigation(url: string): Promise<void> {
    if (!this.session) {
      throw new Error('No recording in progress');
    }

    const step: InteractionStep = {
      id: uuidv4(),
      type: 'navigation',
      action: 'navigate',
      value: url,
      timestamp: Date.now(),
      duration: 0,
      networkActivity: [],
      stateChanges: [],
    };

    const startTime = Date.now();

    try {
      // Record network activity during navigation
      const networkCapture = this.captureNetworkActivity();

      await this.page!.goto(url);

      step.duration = Date.now() - startTime;
      step.networkActivity = await networkCapture;

      // Take screenshot if enabled
      if (this.options.captureScreenshots) {
        step.screenshot = await this.captureScreenshot('navigation');
      }

      // Generate assertions
      if (this.options.generateAssertions) {
        await this.generateNavigationAssertions(url);
      }

      this.steps.push(step);
    } catch (error) {
      step.error = error instanceof Error ? error.message : String(error);
      this.steps.push(step);
      throw error;
    }
  }

  async recordInteraction(element: InteractiveElement, result: InteractionResult): Promise<void> {
    if (!this.session) {
      throw new Error('No recording in progress');
    }

    const stepType = this.mapElementTypeToStepType(element.type);

    const step: InteractionStep = {
      id: uuidv4(),
      type: stepType,
      element,
      action: this.getActionDescription(element, result),
      value: result.value,
      timestamp: Date.now(),
      duration: result.timing,
      networkActivity: result.networkActivity || [],
      stateChanges: result.stateChanges || [],
      error: result.error,
    };

    // Capture screenshot if available
    if (result.screenshot) {
      step.screenshot = result.screenshot;
    } else if (this.options.captureScreenshots && !result.error) {
      step.screenshot = await this.captureScreenshot(stepType);
    }

    // Generate assertions based on the interaction
    if (this.options.generateAssertions && result.success) {
      await this.generateInteractionAssertions(element, result);
    }

    this.steps.push(step);

    logger.debug('Recorded interaction', {
      type: stepType,
      element: element.selector,
      success: result.success,
    });
  }

  async recordAssertion(assertion: Assertion): Promise<void> {
    if (!this.session) {
      throw new Error('No recording in progress');
    }

    this.assertions.push(assertion);

    // Also add as a step for visibility
    const step: InteractionStep = {
      id: uuidv4(),
      type: 'assertion',
      action: `Assert ${assertion.type}`,
      value: assertion.expected,
      timestamp: Date.now(),
      duration: 0,
      networkActivity: [],
      stateChanges: [],
    };

    this.steps.push(step);
  }

  async recordWait(duration: number, reason?: string): Promise<void> {
    if (!this.session) {
      throw new Error('No recording in progress');
    }

    const step: InteractionStep = {
      id: uuidv4(),
      type: 'wait',
      action: reason || `Wait for ${duration}ms`,
      value: duration,
      timestamp: Date.now(),
      duration,
      networkActivity: [],
      stateChanges: [],
    };

    await this.page!.waitForTimeout(duration);
    this.steps.push(step);
  }

  async recordScreenshot(name: string): Promise<void> {
    if (!this.session || !this.page) {
      throw new Error('No recording in progress');
    }

    const filename = await this.captureScreenshot(name);

    const step: InteractionStep = {
      id: uuidv4(),
      type: 'screenshot',
      action: `Capture screenshot: ${name}`,
      timestamp: Date.now(),
      duration: 0,
      screenshot: filename,
      networkActivity: [],
      stateChanges: [],
    };

    this.steps.push(step);
  }

  private async setupEventListeners(): Promise<void> {
    if (!this.page || !this.context) return;

    // Network monitoring
    if (this.options.captureNetwork) {
      this.page.on('request', (request) => {
        this.networkActivity.push({
          url: request.url(),
          method: request.method(),
          timing: Date.now() - this.startTime,
        });
      });

      this.page.on('response', (response) => {
        const activity = this.networkActivity.find((a) => a.url === response.url() && !a.status);
        if (activity) {
          activity.status = response.status();
        }
      });
    }

    // Console monitoring
    if (this.options.captureConsole) {
      this.page.on('console', (msg) => {
        this.consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
          timestamp: Date.now() - this.startTime,
        });
      });
    }
  }

  private async cleanupEventListeners(): Promise<void> {
    if (!this.page) return;

    this.page.removeAllListeners('request');
    this.page.removeAllListeners('response');
    this.page.removeAllListeners('console');
  }

  private async captureScreenshot(name: string): Promise<string> {
    if (!this.page) return '';

    const timestamp = Date.now();
    const filename = `${name}_${timestamp}.png`;

    try {
      await this.page.screenshot({
        path: `screenshots/${filename}`,
        fullPage: false,
        quality: this.options.screenshotQuality,
      });
      return filename;
    } catch (error) {
      logger.error('Failed to capture screenshot', { name, error });
      return '';
    }
  }

  private async captureNetworkActivity(): Promise<NetworkActivity[]> {
    const startCount = this.networkActivity.length;

    return new Promise((resolve) => {
      setTimeout(() => {
        const endCount = this.networkActivity.length;
        resolve(this.networkActivity.slice(startCount, endCount));
      }, 100);
    });
  }

  private mapElementTypeToStepType(elementType: string): StepType {
    const typeMap: Record<string, StepType> = {
      button: 'click',
      link: 'click',
      'text-input': 'type',
      textarea: 'type',
      select: 'select',
      checkbox: 'check',
      radio: 'check',
    };

    return typeMap[elementType] || 'click';
  }

  private getActionDescription(element: InteractiveElement, result: InteractionResult): string {
    const elementDesc = element.text || element.selector;

    switch (element.type) {
      case 'text-input':
      case 'textarea':
        return `Type "${result.value}" into ${elementDesc}`;
      case 'button':
        return `Click button "${elementDesc}"`;
      case 'link':
        return `Click link "${elementDesc}"`;
      case 'checkbox':
        return result.value ? `Check ${elementDesc}` : `Uncheck ${elementDesc}`;
      case 'select':
        return `Select "${result.value}" from ${elementDesc}`;
      default:
        return `Interact with ${elementDesc}`;
    }
  }

  private async generateNavigationAssertions(expectedUrl: string): Promise<void> {
    if (!this.page) return;

    // URL assertion
    this.assertions.push({
      id: uuidv4(),
      type: 'url',
      target: 'page',
      expected: expectedUrl,
      operator: 'contains',
    });

    // Title assertion
    const title = await this.page.title();
    if (title) {
      this.assertions.push({
        id: uuidv4(),
        type: 'title',
        target: 'page',
        expected: title,
        operator: 'equals',
      });
    }
  }

  private async generateInteractionAssertions(
    element: InteractiveElement,
    result: InteractionResult
  ): Promise<void> {
    if (!this.page) return;

    // Value assertion for inputs
    if (['text-input', 'textarea', 'select'].includes(element.type) && result.value) {
      this.assertions.push({
        id: uuidv4(),
        type: 'value',
        target: element.selector,
        expected: result.value,
        operator: 'equals',
      });
    }

    // State assertion for checkboxes
    if (element.type === 'checkbox' && result.value !== undefined) {
      this.assertions.push({
        id: uuidv4(),
        type: 'attribute',
        target: element.selector,
        expected: result.value ? 'checked' : null,
        operator: result.value ? 'exists' : 'not-exists',
      });
    }

    // Navigation assertion
    if (result.stateChanges?.some((change) => change.type === 'url')) {
      const urlChange = result.stateChanges.find((change) => change.type === 'url');
      if (urlChange) {
        this.assertions.push({
          id: uuidv4(),
          type: 'url',
          target: 'page',
          expected: urlChange.after,
          operator: 'equals',
        });
      }
    }
  }

  private async generateFinalAssertions(): Promise<void> {
    if (!this.page) return;

    // Visibility assertions for key elements
    const importantSelectors = ['h1', 'h2', '[data-testid]', 'form', '.error', '.success'];

    for (const selector of importantSelectors) {
      try {
        const elements = await this.page.$$(selector);
        if (elements.length > 0) {
          this.assertions.push({
            id: uuidv4(),
            type: 'visible',
            target: selector,
            expected: true,
            operator: 'equals',
          });
        }
      } catch {
        // Ignore selector errors
      }
    }
  }

  private analyzePath(path: UserPath): PathAnalysis {
    const uniqueElements = new Set(
      path.steps.filter((step) => step.element).map((step) => step.element!.selector)
    ).size;

    const pageTransitions = path.steps.filter(
      (step) =>
        step.type === 'navigation' || step.stateChanges.some((change) => change.type === 'url')
    ).length;

    const networkRequests = path.steps.reduce((sum, step) => sum + step.networkActivity.length, 0);

    const interactionCount = path.steps.filter((step) =>
      ['click', 'type', 'select', 'check'].includes(step.type)
    ).length;

    let complexity: 'simple' | 'moderate' | 'complex';
    if (interactionCount < 5) {
      complexity = 'simple';
    } else if (interactionCount < 15) {
      complexity = 'moderate';
    } else {
      complexity = 'complex';
    }

    return {
      complexity,
      estimatedDuration: path.duration,
      interactionCount,
      uniqueElements,
      pageTransitions,
      networkRequests,
      assertions: path.assertions.length,
      coverage: {
        elements: uniqueElements,
        elementsTested: uniqueElements,
        percentage: 100,
      },
    };
  }

  getSession(): RecordingSession | null {
    return this.session;
  }

  getCurrentPath(): UserPath | null {
    return this.session?.currentPath || null;
  }

  pauseRecording(): void {
    if (this.session) {
      this.session.status = 'paused';
    }
  }

  resumeRecording(): void {
    if (this.session && this.session.status === 'paused') {
      this.session.status = 'recording';
    }
  }
}
