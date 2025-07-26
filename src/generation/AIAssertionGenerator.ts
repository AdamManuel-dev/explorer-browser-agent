import { Page } from 'playwright';
import { logger } from '../utils/logger';
import { AIElementDetector } from '../detectors/AIElementDetector';

/**
 * Context information for generating assertions
 * 
 * Provides the AI assertion generator with information about the current
 * action, element, page state, and previous assertions to generate
 * contextually appropriate test assertions.
 */
export interface AssertionContext {
  /** The action that was performed (e.g., 'click', 'type', 'submit') */
  action: string;
  /** Information about the element that was interacted with */
  element?: {
    /** CSS selector for the element */
    selector: string;
    /** Type of element (button, input, etc.) */
    type: string;
    /** Text content of the element */
    text?: string;
  };
  /** Current state of the page */
  pageState: {
    /** Current page URL */
    url: string;
    /** Page title */
    title: string;
    /** Timestamp of the state capture */
    timestamp: number;
  };
  /** Previously generated assertions to avoid duplication */
  previousAssertions: SmartAssertion[];
}

/**
 * Represents an AI-generated test assertion
 * 
 * Smart assertions include confidence scores, reasoning, and categorization
 * to help developers understand why the assertion was generated and how
 * important it is to the test.
 */
export interface SmartAssertion {
  /** Type of assertion to perform */
  type: 'visible' | 'hidden' | 'enabled' | 'disabled' | 'contains' | 'equals' | 'count' | 'url' | 'custom';
  /** Element selector or target for the assertion */
  target: string;
  /** Expected value or state */
  expected: any;
  /** Confidence level (0-1) in this assertion */
  confidence: number;
  /** AI's reasoning for generating this assertion */
  reasoning: string;
  /** Priority level for this assertion */
  priority: 'high' | 'medium' | 'low';
  /** Category of testing this assertion covers */
  category: 'functional' | 'ui' | 'performance' | 'accessibility';
}

/**
 * AI-powered test assertion generator
 * 
 * Generates intelligent, context-aware test assertions based on user actions,
 * page state, and business logic patterns. The generator uses AI to understand
 * the intent behind actions and creates meaningful assertions that go beyond
 * simple UI state checks.
 * 
 * @example <caption>Basic usage</caption>
 * ```typescript
 * const generator = new AIAssertionGenerator();
 * const context: AssertionContext = {
 *   action: 'click submit button',
 *   element: { selector: '#submit', type: 'button', text: 'Submit' },
 *   pageState: { url: 'https://example.com/form', title: 'Form', timestamp: Date.now() },
 *   previousAssertions: []
 * };
 * 
 * const assertions = await generator.generateAssertions(page, context);
 * console.log(`Generated ${assertions.length} assertions`);
 * ```
 * 
 * @example <caption>Using with test generation</caption>
 * ```typescript
 * const generator = new AIAssertionGenerator();
 * const testSteps = recordedActions.map(async (action) => {
 *   const assertions = await generator.generateAssertions(page, {
 *     action: action.type,
 *     element: action.element,
 *     pageState: await capturePageState(page),
 *     previousAssertions: allAssertions
 *   });
 *   allAssertions.push(...assertions);
 *   return { action, assertions };
 * });
 * ```
 * 
 * @since 1.0.0
 */
export class AIAssertionGenerator {
  private detector: AIElementDetector;
  private actionAssertionMap: Map<string, string[]>;

  constructor() {
    this.detector = new AIElementDetector();
    this.initializeActionMapping();
  }

  /**
   * Generate AI-driven assertions based on context
   * 
   * Analyzes the provided context including the action performed, element interacted with,
   * and current page state to generate relevant test assertions. The AI considers multiple
   * factors including UI state, business logic patterns, accessibility, and common
   * testing patterns.
   * 
   * @param page - The Playwright page to analyze
   * @param context - Context information about the action and state
   * @returns Array of smart assertions with confidence scores and reasoning
   * @throws {Error} If assertion generation fails
   * 
   * @example
   * ```typescript
   * // After clicking a submit button
   * const assertions = await generator.generateAssertions(page, {
   *   action: 'click',
   *   element: { selector: '#submit-btn', type: 'button', text: 'Submit' },
   *   pageState: { url: page.url(), title: await page.title(), timestamp: Date.now() },
   *   previousAssertions: []
   * });
   * 
   * // Filter high-priority assertions
   * const critical = assertions.filter(a => a.priority === 'high');
   * ```
   */
  async generateAssertions(page: Page, context: AssertionContext): Promise<SmartAssertion[]> {
    logger.info('Generating AI-driven assertions', {
      action: context.action,
      element: context.element?.type,
      url: context.pageState.url,
    });

    try {
      // Initialize detector with current page
      await this.detector.initialize(page);

      const assertions: SmartAssertion[] = [];

      // 1. Context-aware assertions based on action
      const contextAssertions = await this.generateContextualAssertions(page, context);
      assertions.push(...contextAssertions);

      // 2. Page state assertions
      const stateAssertions = await this.generatePageStateAssertions(page, context);
      assertions.push(...stateAssertions);

      // 3. Element relationship assertions
      if (context.element) {
        const relationshipAssertions = await this.generateElementRelationshipAssertions(page, context);
        assertions.push(...relationshipAssertions);
      }

      // 4. Business logic assertions
      const businessAssertions = await this.generateBusinessLogicAssertions(page, context);
      assertions.push(...businessAssertions);

      // 5. Filter and prioritize assertions
      const optimizedAssertions = this.optimizeAssertions(assertions, context);

      logger.info(`Generated ${optimizedAssertions.length} AI-driven assertions`);
      return optimizedAssertions;

    } catch (error) {
      logger.error('AI assertion generation failed:', error);
      // Fallback to basic assertions
      return this.generateFallbackAssertions(context);
    }
  }

  private async generateContextualAssertions(page: Page, context: AssertionContext): Promise<SmartAssertion[]> {
    const assertions: SmartAssertion[] = [];
    const action = context.action.toLowerCase();

    // Action-specific assertion generation
    if (action.includes('click') || action.includes('submit')) {
      // After click/submit, check for navigation, loading states, or UI changes
      assertions.push({
        type: 'url',
        target: '',
        expected: context.pageState.url,
        confidence: 0.7,
        reasoning: 'Verify page navigation after click action',
        priority: 'high',
        category: 'functional',
      });

      // Check for loading indicators
      const loadingElements = await page.locator('[data-testid*="loading"], .loading, .spinner').count();
      if (loadingElements > 0) {
        assertions.push({
          type: 'hidden',
          target: '[data-testid*="loading"], .loading, .spinner',
          expected: true,
          confidence: 0.8,
          reasoning: 'Ensure loading state completes after action',
          priority: 'medium',
          category: 'ui',
        });
      }
    }

    if (action.includes('type') || action.includes('fill')) {
      // After typing, verify form validation
      const errorElements = await page.locator('.error, .invalid, [role="alert"]').count();
      if (errorElements > 0) {
        assertions.push({
          type: 'hidden',
          target: '.error, .invalid, [role="alert"]',
          expected: true,
          confidence: 0.9,
          reasoning: 'Verify no validation errors after input',
          priority: 'high',
          category: 'functional',
        });
      }

      // Check if submit button becomes enabled
      const submitButtons = await page.locator('button[type="submit"], input[type="submit"]').count();
      if (submitButtons > 0) {
        assertions.push({
          type: 'enabled',
          target: 'button[type="submit"], input[type="submit"]',
          expected: true,
          confidence: 0.7,
          reasoning: 'Submit button should be enabled after form input',
          priority: 'medium',
          category: 'functional',
        });
      }
    }

    return assertions;
  }

  private async generatePageStateAssertions(page: Page, context: AssertionContext): Promise<SmartAssertion[]> {
    const assertions: SmartAssertion[] = [];

    // Page title assertion
    const title = await page.title();
    if (title && title.trim()) {
      assertions.push({
        type: 'custom',
        target: 'document.title',
        expected: title,
        confidence: 0.6,
        reasoning: 'Verify page title is set correctly',
        priority: 'low',
        category: 'ui',
      });
    }

    // Check for common success/error indicators
    const successElements = await page.locator('.success, .alert-success, [data-testid*="success"]').count();
    if (successElements > 0) {
      assertions.push({
        type: 'visible',
        target: '.success, .alert-success, [data-testid*="success"]',
        expected: true,
        confidence: 0.8,
        reasoning: 'Success message should be visible after action',
        priority: 'high',
        category: 'functional',
      });
    }

    const errorElements = await page.locator('.error, .alert-error, [data-testid*="error"]').count();
    if (errorElements > 0) {
      assertions.push({
        type: 'hidden',
        target: '.error, .alert-error, [data-testid*="error"]',
        expected: true,
        confidence: 0.8,
        reasoning: 'Error messages should not be present',
        priority: 'high',
        category: 'functional',
      });
    }

    return assertions;
  }

  private async generateElementRelationshipAssertions(page: Page, context: AssertionContext): Promise<SmartAssertion[]> {
    const assertions: SmartAssertion[] = [];

    if (!context.element) return assertions;

    const element = page.locator(context.element.selector);
    
    // Check element visibility
    const isVisible = await element.isVisible();
    assertions.push({
      type: isVisible ? 'visible' : 'hidden',
      target: context.element.selector,
      expected: true,
      confidence: 0.9,
      reasoning: `Element should be ${isVisible ? 'visible' : 'hidden'} after interaction`,
      priority: 'high',
      category: 'ui',
    });

    // For form elements, check related labels
    if (context.element.type === 'input') {
      const label = await page.locator(`label[for="${context.element.selector.replace('#', '')}"]`).count();
      if (label > 0) {
        assertions.push({
          type: 'visible',
          target: `label[for="${context.element.selector.replace('#', '')}"]`,
          expected: true,
          confidence: 0.7,
          reasoning: 'Form label should be visible with input field',
          priority: 'medium',
          category: 'accessibility',
        });
      }
    }

    return assertions;
  }

  private async generateBusinessLogicAssertions(page: Page, context: AssertionContext): Promise<SmartAssertion[]> {
    const assertions: SmartAssertion[] = [];

    // Detect common business scenarios
    const pageContent = await page.textContent('body') || '';
    
    // E-commerce patterns
    if (pageContent.includes('cart') || pageContent.includes('checkout')) {
      const cartCount = await page.locator('[data-testid*="cart"], .cart-count, .cart-item').count();
      if (cartCount > 0) {
        assertions.push({
          type: 'visible',
          target: '[data-testid*="cart"], .cart-count',
          expected: true,
          confidence: 0.8,
          reasoning: 'Shopping cart should be visible in e-commerce context',
          priority: 'medium',
          category: 'functional',
        });
      }
    }

    // Login/authentication patterns
    if (pageContent.includes('login') || pageContent.includes('sign in')) {
      const loginForms = await page.locator('form[action*="login"], form[action*="signin"]').count();
      if (loginForms > 0) {
        assertions.push({
          type: 'visible',
          target: 'form[action*="login"], form[action*="signin"]',
          expected: true,
          confidence: 0.9,
          reasoning: 'Login form should be present on authentication pages',
          priority: 'high',
          category: 'functional',
        });
      }
    }

    return assertions;
  }

  private optimizeAssertions(assertions: SmartAssertion[], context: AssertionContext): SmartAssertion[] {
    // Remove duplicates
    const uniqueAssertions = assertions.filter((assertion, index) => 
      assertions.findIndex(a => 
        a.type === assertion.type && 
        a.target === assertion.target
      ) === index
    );

    // Sort by priority and confidence
    const sortedAssertions = uniqueAssertions.sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      const priorityA = priorityWeight[a.priority];
      const priorityB = priorityWeight[b.priority];
      
      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }
      
      return b.confidence - a.confidence;
    });

    // Limit to top assertions to avoid test bloat
    const maxAssertions = 8;
    return sortedAssertions.slice(0, maxAssertions);
  }

  private generateFallbackAssertions(context: AssertionContext): SmartAssertion[] {
    // Basic fallback assertions when AI fails
    const fallbackAssertions: SmartAssertion[] = [
      {
        type: 'url',
        target: '',
        expected: context.pageState.url,
        confidence: 0.5,
        reasoning: 'Fallback: Verify page URL',
        priority: 'medium',
        category: 'functional',
      }
    ];

    if (context.element) {
      fallbackAssertions.push({
        type: 'visible',
        target: context.element.selector,
        expected: true,
        confidence: 0.5,
        reasoning: 'Fallback: Verify element visibility',
        priority: 'medium',
        category: 'ui',
      });
    }

    return fallbackAssertions;
  }

  private initializeActionMapping(): void {
    // Maps common actions to likely assertion types
    this.actionAssertionMap = new Map([
      ['click', ['visible', 'url', 'enabled', 'text']],
      ['type', ['value', 'enabled', 'visible']],
      ['submit', ['url', 'visible', 'text']],
      ['navigate', ['url', 'visible', 'text']],
      ['select', ['value', 'visible']],
      ['hover', ['visible', 'attribute']],
    ]);
  }

  /**
   * Clean up resources
   * 
   * Closes the AI detector and cleans up any resources used by the assertion generator.
   * Should be called when the generator is no longer needed.
   * 
   * @example
   * ```typescript
   * const generator = new AIAssertionGenerator();
   * try {
   *   const assertions = await generator.generateAssertions(page, context);
   *   // Use assertions...
   * } finally {
   *   await generator.close();
   * }
   * ```
   */
  async close(): Promise<void> {
    // Cleanup resources if needed
    logger.debug('AI assertion generator cleanup complete');
  }
}