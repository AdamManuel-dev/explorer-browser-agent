import { Page } from 'playwright';
import { InteractiveElement } from '../types/elements';
import {
  InteractionStrategy,
  InteractionContext,
  InteractionResult,
  InteractionOptions,
} from '../types/interactions';
import { logger } from '../utils/logger';
import { InteractionExecutor } from './InteractionExecutor';
import { SelfAdaptingDetector } from '../detectors/SelfAdaptingDetector';

/**
 * Enhanced interaction executor with self-adapting element detection
 */
export class AdaptiveInteractionExecutor extends InteractionExecutor {
  private adaptiveDetector: SelfAdaptingDetector;
  private adaptationAttempts: Map<string, number> = new Map();
  private maxRetries = 3;

  constructor() {
    super();
    this.adaptiveDetector = new SelfAdaptingDetector();
  }

  /**
   * Initialize the adaptive detector with the page
   */
  async initialize(page: Page): Promise<void> {
    this.setPage(page);
    await this.adaptiveDetector.initialize(page);
  }

  /**
   * Execute interaction with automatic element adaptation on failure
   */
  async executeInteraction(
    element: InteractiveElement,
    options?: InteractionOptions
  ): Promise<InteractionResult> {
    const elementKey = `${element.selector}_${element.type}`;
    const attempts = this.adaptationAttempts.get(elementKey) || 0;

    if (attempts >= this.maxRetries) {
      logger.error('Max retry attempts reached for element', {
        selector: element.selector,
        attempts,
      });
      return {
        success: false,
        timing: 0,
        error: `Max retry attempts (${this.maxRetries}) reached for element`,
        networkActivity: [],
        stateChanges: [],
      };
    }

    try {
      // First, try with the original element
      const result = await super.executeInteraction(element, options);
      
      // Reset attempts on success
      if (result.success) {
        this.adaptationAttempts.delete(elementKey);
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if error is due to element not found
      if (this.isElementNotFoundError(errorMessage)) {
        logger.info('Element not found, attempting adaptation', {
          selector: element.selector,
          error: errorMessage,
        });

        // Try to adapt the element
        const adaptedElement = await this.adaptElement(element);
        
        if (adaptedElement) {
          // Update attempts counter
          this.adaptationAttempts.set(elementKey, attempts + 1);
          
          // Retry with adapted element
          logger.info('Retrying interaction with adapted element', {
            originalSelector: element.selector,
            newSelector: adaptedElement.selector,
          });
          
          return await this.executeInteraction(adaptedElement, options);
        }
      }

      // If not element error or adaptation failed, return error result
      return {
        success: false,
        timing: 0,
        error: errorMessage,
        networkActivity: [],
        stateChanges: [],
      };
    }
  }

  /**
   * Execute interactions on multiple elements with adaptation
   */
  async executeMultipleInteractions(
    elements: InteractiveElement[],
    options?: InteractionOptions
  ): Promise<InteractionResult[]> {
    const results: InteractionResult[] = [];

    for (const element of elements) {
      const result = await this.executeInteraction(element, options);
      results.push(result);

      // Add delay between interactions if specified
      if (options?.delay) {
        await new Promise(resolve => setTimeout(resolve, options.delay));
      }
    }

    return results;
  }

  /**
   * Detect interactive elements with self-adaptation
   */
  async detectElements(): Promise<InteractiveElement[]> {
    if (!this.page) {
      throw new Error('Page not set. Call setPage() or initialize() first.');
    }

    const result = await this.adaptiveDetector.detectInteractiveElements(this.page);
    return result.elements;
  }

  /**
   * Validate that an element can still be interacted with
   */
  async validateElement(element: InteractiveElement): Promise<boolean> {
    if (!this.page) {
      return false;
    }

    try {
      const elementHandle = await this.page.$(element.selector);
      if (!elementHandle) {
        return false;
      }

      const [isVisible, isEnabled] = await Promise.all([
        elementHandle.isVisible(),
        elementHandle.isEnabled(),
      ]);

      return isVisible && isEnabled;
    } catch {
      return false;
    }
  }

  /**
   * Adapt an element that can no longer be found
   */
  private async adaptElement(element: InteractiveElement): Promise<InteractiveElement | null> {
    if (!this.page) {
      return null;
    }

    return await this.adaptiveDetector.getAdaptiveElement(this.page, element);
  }

  /**
   * Check if error indicates element not found
   */
  private isElementNotFoundError(error: string): boolean {
    const notFoundPatterns = [
      'element not found',
      'no element matches selector',
      'failed to find element',
      'element is not attached',
      'stale element reference',
      'element has been removed',
      'unable to locate element',
      'timeout.*waiting for selector',
    ];

    const lowerError = error.toLowerCase();
    return notFoundPatterns.some(pattern => 
      new RegExp(pattern, 'i').test(lowerError)
    );
  }

  /**
   * Get adaptation statistics
   */
  getAdaptationStats(): {
    executorRetries: Map<string, number>;
    detectorStats: {
      totalAttempts: number;
      successfulAdaptations: number;
      failedAdaptations: number;
      strategiesUsed: Record<string, number>;
    };
  } {
    return {
      executorRetries: new Map(this.adaptationAttempts),
      detectorStats: this.adaptiveDetector.getAdaptationStats(),
    };
  }

  /**
   * Reset adaptation attempts
   */
  resetAdaptationAttempts(): void {
    this.adaptationAttempts.clear();
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.adaptationAttempts.clear();
    await this.adaptiveDetector.cleanup();
  }

  /**
   * Create a self-healing test that adapts to UI changes
   */
  async createSelfHealingTest(
    testName: string,
    elements: InteractiveElement[],
    actions: Array<{ elementIndex: number; action: string; data?: any }>
  ): Promise<{
    name: string;
    originalElements: InteractiveElement[];
    adaptedElements: InteractiveElement[];
    executionResults: InteractionResult[];
    healingOccurred: boolean;
  }> {
    const adaptedElements: InteractiveElement[] = [];
    const executionResults: InteractionResult[] = [];
    let healingOccurred = false;

    logger.info(`Starting self-healing test: ${testName}`);

    for (const actionSpec of actions) {
      const { elementIndex, action, data } = actionSpec;
      
      if (elementIndex >= elements.length) {
        logger.error(`Invalid element index: ${elementIndex}`);
        continue;
      }

      let element = elements[elementIndex];
      
      // Check if element needs adaptation
      const isValid = await this.validateElement(element);
      if (!isValid) {
        logger.info('Element needs healing', { selector: element.selector });
        
        const adaptedElement = await this.adaptElement(element);
        if (adaptedElement) {
          element = adaptedElement;
          healingOccurred = true;
          logger.info('Element healed successfully', {
            originalSelector: elements[elementIndex].selector,
            newSelector: adaptedElement.selector,
          });
        } else {
          logger.error('Failed to heal element', { selector: element.selector });
          executionResults.push({
            success: false,
            timing: 0,
            error: 'Failed to heal element',
            networkActivity: [],
            stateChanges: [],
          });
          continue;
        }
      }

      adaptedElements[elementIndex] = element;

      // Execute the action
      const options: InteractionOptions = {
        testData: data,
        delay: 500, // Add delay for stability
      };

      const result = await this.executeInteraction(element, options);
      executionResults.push(result);

      if (!result.success) {
        logger.error('Action failed', {
          action,
          element: element.selector,
          error: result.error,
        });
      }
    }

    return {
      name: testName,
      originalElements: elements,
      adaptedElements,
      executionResults,
      healingOccurred,
    };
  }
}