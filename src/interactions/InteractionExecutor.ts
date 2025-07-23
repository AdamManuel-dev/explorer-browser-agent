import { Page } from 'playwright';
import { InteractiveElement, ElementType } from '../types/elements';
import {
  InteractionStrategy,
  InteractionContext,
  InteractionResult,
  InteractionOptions,
  NetworkActivity,
  StateChange,
} from '../types/interactions';
import { logger } from '../utils/logger';
import { TestDataGenerator } from './TestDataGenerator';
import * as strategies from './strategies';

export class InteractionExecutor {
  private strategies: Map<ElementType, InteractionStrategy>;
  private testDataGenerator: TestDataGenerator;
  private page: Page | null = null;

  constructor() {
    this.strategies = this.initializeStrategies();
    this.testDataGenerator = new TestDataGenerator();
  }

  setPage(page: Page): void {
    this.page = page;
  }

  async executeInteraction(
    element: InteractiveElement,
    options?: InteractionOptions
  ): Promise<InteractionResult> {
    if (!this.page) {
      throw new Error('Page not set. Call setPage() first.');
    }

    const startTime = Date.now();
    const networkActivity: NetworkActivity[] = [];
    const stateChanges: StateChange[] = [];

    try {
      // Record initial state
      const initialState = await this.captureState();

      // Set up network monitoring
      const networkPromise = this.monitorNetwork(networkActivity);

      // Get strategy for element type
      const strategy = this.strategies.get(element.type);
      if (!strategy) {
        throw new Error(`No strategy found for element type: ${element.type}`);
      }

      // Generate test data if needed
      const testData = await this.testDataGenerator.generateForElement(element);

      // Create interaction context
      const context: InteractionContext = {
        page: this.page,
        testData,
        options,
      };

      // Validate element can be interacted with
      if (strategy.validate) {
        const isValid = await strategy.validate(element);
        if (!isValid) {
          throw new Error('Element validation failed');
        }
      }

      // Execute the interaction
      logger.info('Executing interaction', {
        elementType: element.type,
        selector: element.selector,
      });

      const result = await strategy.execute(element, context);

      // Wait for network activity to settle
      await this.waitForNetworkIdle();

      // Record final state
      const finalState = await this.captureState();
      stateChanges.push(...this.compareStates(initialState, finalState));

      // Take screenshot if requested
      let screenshot: string | undefined;
      if (options?.screenshot) {
        screenshot = await this.takeScreenshot(element);
      }

      return {
        ...result,
        timing: Date.now() - startTime,
        screenshot,
        networkActivity,
        stateChanges,
      };
    } catch (error) {
      logger.error('Interaction execution failed', {
        element,
        error,
      });

      return {
        success: false,
        timing: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        networkActivity,
        stateChanges,
      };
    }
  }

  private initializeStrategies(): Map<ElementType, InteractionStrategy> {
    const strategyMap = new Map<ElementType, InteractionStrategy>();

    // Text input strategies
    strategyMap.set('text-input', new strategies.TextInputStrategy());
    strategyMap.set('password-input', new strategies.TextInputStrategy());
    strategyMap.set('email-input', new strategies.TextInputStrategy());
    strategyMap.set('number-input', new strategies.TextInputStrategy());
    strategyMap.set('tel-input', new strategies.TextInputStrategy());
    strategyMap.set('textarea', new strategies.TextInputStrategy());

    // Selection strategies
    strategyMap.set('checkbox', new strategies.CheckboxStrategy());
    strategyMap.set('radio', new strategies.RadioStrategy());
    strategyMap.set('select', new strategies.SelectStrategy());
    strategyMap.set('multi-select', new strategies.MultiSelectStrategy());

    // Date/Time strategies
    strategyMap.set('date-picker', new strategies.DatePickerStrategy());
    strategyMap.set('time-picker', new strategies.TimePickerStrategy());

    // Special input strategies
    strategyMap.set('color-picker', new strategies.ColorPickerStrategy());
    strategyMap.set('range-slider', new strategies.RangeSliderStrategy());
    strategyMap.set('file-upload', new strategies.FileUploadStrategy());

    // Interactive element strategies
    strategyMap.set('button', new strategies.ButtonStrategy());
    strategyMap.set('link', new strategies.LinkStrategy());
    strategyMap.set('toggle', new strategies.ToggleStrategy());

    // Complex component strategies
    strategyMap.set('tab', new strategies.TabStrategy());
    strategyMap.set('accordion', new strategies.AccordionStrategy());
    strategyMap.set('modal-trigger', new strategies.ModalTriggerStrategy());
    strategyMap.set('dropdown-menu', new strategies.DropdownMenuStrategy());
    strategyMap.set('carousel', new strategies.CarouselStrategy());

    // Advanced interaction strategies
    strategyMap.set('drag-drop', new strategies.DragDropStrategy());
    strategyMap.set('canvas', new strategies.CanvasStrategy());
    strategyMap.set('video-player', new strategies.VideoPlayerStrategy());
    strategyMap.set('audio-player', new strategies.AudioPlayerStrategy());
    strategyMap.set('rich-text-editor', new strategies.RichTextEditorStrategy());

    // Default strategy for unknown elements
    strategyMap.set('unknown', new strategies.DefaultStrategy());

    return strategyMap;
  }

  private async monitorNetwork(networkActivity: NetworkActivity[]): Promise<void> {
    if (!this.page) return;

    this.page.on('request', (request) => {
      networkActivity.push({
        url: request.url(),
        method: request.method(),
        timing: Date.now(),
      });
    });

    this.page.on('response', (response) => {
      const activity = networkActivity.find(
        (a) => a.url === response.url() && !a.status
      );
      if (activity) {
        activity.status = response.status();
      }
    });
  }

  private async waitForNetworkIdle(): Promise<void> {
    if (!this.page) return;

    try {
      await this.page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
      // Network might not settle, continue anyway
    }
  }

  private async captureState(): Promise<any> {
    if (!this.page) return {};

    return {
      url: this.page.url(),
      localStorage: await this.page.evaluate(() => {
        const items: Record<string, string> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            items[key] = localStorage.getItem(key) || '';
          }
        }
        return items;
      }),
      cookies: await this.page.context().cookies(),
    };
  }

  private compareStates(before: any, after: any): StateChange[] {
    const changes: StateChange[] = [];

    // Check URL changes
    if (before.url !== after.url) {
      changes.push({
        type: 'url',
        before: before.url,
        after: after.url,
        timing: Date.now(),
      });
    }

    // Check localStorage changes
    const beforeKeys = Object.keys(before.localStorage || {});
    const afterKeys = Object.keys(after.localStorage || {});
    const allKeys = new Set([...beforeKeys, ...afterKeys]);

    for (const key of allKeys) {
      if (before.localStorage?.[key] !== after.localStorage?.[key]) {
        changes.push({
          type: 'storage',
          before: { key, value: before.localStorage?.[key] },
          after: { key, value: after.localStorage?.[key] },
          timing: Date.now(),
        });
      }
    }

    // Check cookie changes
    if (JSON.stringify(before.cookies) !== JSON.stringify(after.cookies)) {
      changes.push({
        type: 'cookie',
        before: before.cookies,
        after: after.cookies,
        timing: Date.now(),
      });
    }

    return changes;
  }

  private async takeScreenshot(element: InteractiveElement): Promise<string> {
    if (!this.page) return '';

    const timestamp = Date.now();
    const filename = `interaction_${element.type}_${timestamp}.png`;

    try {
      if (element.selector) {
        const el = await this.page.$(element.selector);
        if (el) {
          await el.screenshot({ path: `screenshots/${filename}` });
        }
      } else {
        await this.page.screenshot({ path: `screenshots/${filename}` });
      }
      return filename;
    } catch (error) {
      logger.error('Failed to take screenshot', { error });
      return '';
    }
  }

  async cleanup(): Promise<void> {
    this.page = null;
  }
}