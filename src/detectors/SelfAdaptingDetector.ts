import { Page, ElementHandle } from 'playwright';
import { logger } from '../utils/logger';
import { AIElementDetector } from './AIElementDetector';
import {
  InteractiveElement,
  ElementDetectionResult,
} from '../types/elements';

/**
 * Represents a cached snapshot of an element detection result
 */
interface ElementSnapshot {
  /** The detected interactive element */
  element: InteractiveElement;
  /** Timestamp when the element was cached */
  timestamp: number;
  /** URL of the page where element was detected */
  pageUrl: string;
  /** History of adaptation attempts for this element */
  adaptationHistory: AdaptationAttempt[];
}

/**
 * Records an attempt to adapt an element selector that has changed
 */
interface AdaptationAttempt {
  /** When the adaptation was attempted */
  timestamp: number;
  /** The original selector that failed */
  originalSelector: string;
  /** The new selector that was found (empty if failed) */
  newSelector: string;
  /** The strategy used for adaptation */
  strategy: string;
  /** Whether the adaptation succeeded */
  success: boolean;
  /** Error message if adaptation failed */
  error?: string;
}

/**
 * Cache storage for element snapshots indexed by cache key
 */
interface DetectionCache {
  [key: string]: ElementSnapshot;
}

/**
 * Self-adapting element detector that automatically handles UI changes
 * 
 * This detector wraps the AIElementDetector and adds intelligent adaptation capabilities
 * to handle cases where elements change their selectors or structure. It uses multiple
 * strategies including AI-based adaptation, structural similarity matching, and fuzzy
 * text matching to find elements even after UI updates.
 * 
 * @example <caption>Basic usage</caption>
 * ```typescript
 * const detector = new SelfAdaptingDetector();
 * await detector.initialize(page);
 * 
 * // Detect elements with automatic adaptation
 * const result = await detector.detectInteractiveElements(page);
 * console.log(`Found ${result.totalFound} elements`);
 * 
 * // Get an adaptive element that will retry if selector fails
 * const button = result.elements.find(e => e.type === 'button');
 * const adaptedButton = await detector.getAdaptiveElement(page, button);
 * ```
 * 
 * @example <caption>Monitoring adaptation statistics</caption>
 * ```typescript
 * // After running detection on changing UIs
 * const stats = detector.getAdaptationStats();
 * console.log(`Success rate: ${stats.successfulAdaptations / stats.totalAttempts * 100}%`);
 * console.log('Strategies used:', stats.strategiesUsed);
 * ```
 * 
 * @since 1.0.0
 */
export class SelfAdaptingDetector {
  private detector: AIElementDetector;
  private elementCache: DetectionCache = {};
  private adaptationHistory: Map<string, AdaptationAttempt[]> = new Map();
  private maxAdaptationAttempts = 3;
  private cacheExpirationMs = 300000; // 5 minutes

  constructor() {
    this.detector = new AIElementDetector();
  }

  /**
   * Initialize the detector with a Playwright page
   * 
   * This must be called before using any detection methods. It sets up the
   * underlying AI detector and prepares the adaptation system.
   * 
   * @param page - The Playwright page to use for detection
   * @throws {Error} If initialization fails
   * 
   * @example
   * ```typescript
   * const browser = await chromium.launch();
   * const page = await browser.newPage();
   * const detector = new SelfAdaptingDetector();
   * await detector.initialize(page);
   * ```
   */
  async initialize(page: Page): Promise<void> {
    await this.detector.initialize(page);
  }

  /**
   * Detect interactive elements with self-adaptation capabilities
   * 
   * Performs element detection using AI and caches results. If cached elements
   * are found, they are validated and adapted if their selectors have changed.
   * This method combines the power of AI detection with resilient adaptation.
   * 
   * @param page - The Playwright page to scan for elements
   * @returns Detection results including adapted elements
   * @throws {Error} If detection fails completely
   * 
   * @example
   * ```typescript
   * const result = await detector.detectInteractiveElements(page);
   * 
   * // Process detected elements
   * for (const element of result.elements) {
   *   console.log(`Found ${element.type}: ${element.selector}`);
   *   
   *   // Check if element was adapted
   *   if (element.metadata?.adaptedFrom) {
   *     console.log(`Element was adapted from: ${element.metadata.adaptedFrom}`);
   *   }
   * }
   * ```
   */
  async detectInteractiveElements(page: Page): Promise<ElementDetectionResult> {
    const startTime = Date.now();
    const pageUrl = page.url();

    try {
      // First, perform standard detection
      const result = await this.detector.detectInteractiveElements(page);

      // Cache the detected elements
      this.cacheElements(result.elements, pageUrl);

      // Validate and adapt cached elements
      const adaptedElements = await this.validateAndAdaptElements(page, result.elements);

      return {
        elements: adaptedElements,
        totalFound: adaptedElements.length,
        detectionTime: Date.now() - startTime,
        errors: result.errors || [],
      };
    } catch (error) {
      logger.error('Self-adapting detection failed', error);
      throw error;
    }
  }

  /**
   * Try to interact with an element, adapting if it fails
   * 
   * This method first attempts to use the original element selector. If that fails,
   * it triggers the adaptation process to find the element using alternative strategies.
   * This is useful when you have a reference to an element that may have changed.
   * 
   * @param page - The Playwright page containing the element
   * @param element - The element to find and potentially adapt
   * @returns The original element if valid, adapted element if found, or null if adaptation fails
   * 
   * @example <caption>Basic usage</caption>
   * ```typescript
   * const button = { selector: '#submit-btn', type: 'button', text: 'Submit' };
   * const adaptedButton = await detector.getAdaptiveElement(page, button);
   * 
   * if (adaptedButton) {
   *   await page.click(adaptedButton.selector);
   * } else {
   *   console.error('Could not find or adapt the button');
   * }
   * ```
   * 
   * @example <caption>Checking adaptation</caption>
   * ```typescript
   * const result = await detector.getAdaptiveElement(page, element);
   * if (result && result.selector !== element.selector) {
   *   console.log(`Element adapted from ${element.selector} to ${result.selector}`);
   *   console.log(`Strategy: ${result.metadata?.adaptationStrategy}`);
   * }
   * ```
   */
  async getAdaptiveElement(
    page: Page,
    element: InteractiveElement
  ): Promise<InteractiveElement | null> {
    const pageUrl = page.url();
    
    // Try the original selector first
    try {
      const elementHandle = await page.$(element.selector);
      if (elementHandle && await elementHandle.isVisible()) {
        logger.debug('Original element still valid', { selector: element.selector });
        return element;
      }
    } catch (error) {
      logger.debug('Original element not found, attempting adaptation', {
        selector: element.selector,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Element not found, try adaptation
    return await this.adaptElement(page, element, pageUrl);
  }

  /**
   * Validate cached elements and adapt those that have changed
   * 
   * Internal method that processes a list of elements, checking if cached versions
   * are still valid and adapting them if necessary.
   * 
   * @param page - The Playwright page to validate against
   * @param elements - Array of elements to validate
   * @returns Array of validated/adapted elements
   */
  private async validateAndAdaptElements(
    page: Page,
    elements: InteractiveElement[]
  ): Promise<InteractiveElement[]> {
    const validatedElements: InteractiveElement[] = [];
    const pageUrl = page.url();

    for (const element of elements) {
      const cacheKey = this.getCacheKey(element, pageUrl);
      const cached = this.elementCache[cacheKey];

      if (cached && this.isCacheValid(cached)) {
        // Check if the cached element is still valid
        try {
          const elementHandle = await page.$(cached.element.selector);
          if (elementHandle && await elementHandle.isVisible()) {
            validatedElements.push(cached.element);
            continue;
          }
        } catch {
          // Element no longer valid, will attempt adaptation
        }
      }

      // Element needs validation or adaptation
      const adaptedElement = await this.validateOrAdaptElement(page, element, pageUrl);
      if (adaptedElement) {
        validatedElements.push(adaptedElement);
      }
    }

    return validatedElements;
  }

  /**
   * Validate or adapt a single element
   */
  private async validateOrAdaptElement(
    page: Page,
    element: InteractiveElement,
    pageUrl: string
  ): Promise<InteractiveElement | null> {
    try {
      // First, check if element is still valid
      const elementHandle = await page.$(element.selector);
      if (elementHandle && await elementHandle.isVisible()) {
        return element;
      }
    } catch {
      // Element not found, will try adaptation
    }

    // Try to adapt the element
    return await this.adaptElement(page, element, pageUrl);
  }

  /**
   * Adapt an element that can no longer be found
   */
  private async adaptElement(
    page: Page,
    element: InteractiveElement,
    pageUrl: string
  ): Promise<InteractiveElement | null> {
    const attemptKey = `${element.selector}_${pageUrl}`;
    const previousAttempts = this.adaptationHistory.get(attemptKey) || [];

    if (previousAttempts.length >= this.maxAdaptationAttempts) {
      logger.warn('Max adaptation attempts reached', {
        selector: element.selector,
        attempts: previousAttempts.length,
      });
      return null;
    }

    logger.info('Attempting element adaptation', {
      originalSelector: element.selector,
      attempt: previousAttempts.length + 1,
    });

    // Strategy 1: Try the AI detector's built-in adaptation
    try {
      const adaptedElement = await this.detector.adaptElement(page, element);
      if (adaptedElement) {
        this.recordAdaptationAttempt(attemptKey, {
          timestamp: Date.now(),
          originalSelector: element.selector,
          newSelector: adaptedElement.selector,
          strategy: 'AI-based adaptation',
          success: true,
        });

        // Update cache with adapted element
        this.cacheElement(adaptedElement, pageUrl);
        
        return adaptedElement;
      }
    } catch (error) {
      logger.debug('AI adaptation failed', { error });
    }

    // Strategy 2: Try structural similarity matching
    try {
      const structuralMatch = await this.findStructuralMatch(page, element);
      if (structuralMatch) {
        this.recordAdaptationAttempt(attemptKey, {
          timestamp: Date.now(),
          originalSelector: element.selector,
          newSelector: structuralMatch.selector,
          strategy: 'Structural similarity',
          success: true,
        });

        return structuralMatch;
      }
    } catch (error) {
      logger.debug('Structural matching failed', { error });
    }

    // Strategy 3: Try fuzzy text matching
    if (element.text) {
      try {
        const fuzzyMatch = await this.findFuzzyTextMatch(page, element);
        if (fuzzyMatch) {
          this.recordAdaptationAttempt(attemptKey, {
            timestamp: Date.now(),
            originalSelector: element.selector,
            newSelector: fuzzyMatch.selector,
            strategy: 'Fuzzy text matching',
            success: true,
          });

          return fuzzyMatch;
        }
      } catch (error) {
        logger.debug('Fuzzy text matching failed', { error });
      }
    }

    // All strategies failed
    this.recordAdaptationAttempt(attemptKey, {
      timestamp: Date.now(),
      originalSelector: element.selector,
      newSelector: '',
      strategy: 'All strategies failed',
      success: false,
      error: 'Could not adapt element',
    });

    return null;
  }

  /**
   * Find element by structural similarity
   */
  private async findStructuralMatch(
    page: Page,
    originalElement: InteractiveElement
  ): Promise<InteractiveElement | null> {
    const candidates = await page.evaluate((elementInfo) => {
      const { type, attributes, metadata } = elementInfo;
      const allElements = document.querySelectorAll('*');
      const matches: Array<{ selector: string; score: number }> = [];

      allElements.forEach((el, index) => {
        let score = 0;
        const element = el as HTMLElement;

        // Type similarity
        const tagName = element.tagName.toLowerCase();
        if (
          (type === 'button' && tagName === 'button') ||
          (type === 'link' && tagName === 'a') ||
          (type.includes('input') && tagName === 'input')
        ) {
          score += 3;
        }

        // Attribute similarity
        if (attributes) {
          Object.entries(attributes).forEach(([key, value]) => {
            if (element.getAttribute(key) === value) {
              score += 2;
            }
          });
        }

        // Class similarity
        if (attributes?.class) {
          const originalClasses = typeof attributes.class === 'string' ? attributes.class.split(' ') : [];
          const elementClasses = element.className.split(' ');
          const commonClasses = originalClasses.filter(c => elementClasses.includes(c));
          score += commonClasses.length;
        }

        // Context similarity
        if (metadata?.context) {
          const contextParts = metadata.context.toLowerCase().split(',');
          let contextMatch = 0;
          
          // Check parent elements
          let parent = element.parentElement;
          while (parent && contextMatch < contextParts.length) {
            const parentText = parent.textContent?.toLowerCase() || '';
            contextParts.forEach(part => {
              if (parentText.includes(part.trim())) {
                contextMatch++;
              }
            });
            parent = parent.parentElement;
          }
          
          score += contextMatch;
        }

        if (score > 3) {
          // Generate selector
          let selector = '';
          if (element.id) {
            selector = `#${element.id}`;
          } else if (element.className) {
            selector = `.${element.className.split(' ').join('.')}`;
          } else {
            selector = `${tagName}:nth-of-type(${index + 1})`;
          }

          matches.push({ selector, score });
        }
      });

      // Sort by score and return best match
      matches.sort((a, b) => b.score - a.score);
      return matches[0] || null;
    }, {
      type: originalElement.type,
      attributes: originalElement.attributes,
      metadata: originalElement.metadata,
    });

    if (!candidates) {
      return null;
    }

    try {
      const elementHandle = await page.$(candidates.selector);
      if (!elementHandle) {
        return null;
      }

      // Create new element from the match
      const newElement: InteractiveElement = {
        ...originalElement,
        selector: candidates.selector,
        metadata: {
          ...originalElement.metadata,
          adaptedFrom: originalElement.selector,
          adaptationStrategy: 'structural-similarity',
          adaptationScore: candidates.score,
        } as any,
      };

      return newElement;
    } catch (error) {
      logger.debug('Failed to create element from structural match', { error });
      return null;
    }
  }

  /**
   * Find element by fuzzy text matching
   */
  private async findFuzzyTextMatch(
    page: Page,
    originalElement: InteractiveElement
  ): Promise<InteractiveElement | null> {
    if (!originalElement.text) {
      return null;
    }

    const targetText = originalElement.text.toLowerCase().trim();
    
    const match = await page.evaluate((searchText) => {
      const allElements = document.querySelectorAll('button, a, input, select, textarea, [role="button"], [role="link"]');
      let bestMatch: { element: Element; score: number } | null = null;
      let bestScore = 0;

      // Simple fuzzy matching function
      const fuzzyScore = (text1: string, text2: string): number => {
        const t1 = text1.toLowerCase().trim();
        const t2 = text2.toLowerCase().trim();
        
        if (t1 === t2) return 1.0;
        if (t1.includes(t2) || t2.includes(t1)) return 0.8;
        
        // Calculate character similarity
        let matches = 0;
        const minLength = Math.min(t1.length, t2.length);
        for (let i = 0; i < minLength; i++) {
          if (t1[i] === t2[i]) matches++;
        }
        
        return matches / Math.max(t1.length, t2.length);
      };

      allElements.forEach((element) => {
        const elementText = (element.textContent || '').toLowerCase().trim();
        const score = fuzzyScore(searchText, elementText);
        
        if (score > bestScore && score > 0.6) {
          bestScore = score;
          bestMatch = { element, score };
        }
      });

      if (!bestMatch) {
        return null;
      }

      // Generate selector for best match
      const element = bestMatch.element as HTMLElement;
      let selector = '';
      
      if (element.id) {
        selector = `#${element.id}`;
      } else if (element.getAttribute('data-testid')) {
        selector = `[data-testid="${element.getAttribute('data-testid')}"]`;
      } else if (element.className) {
        selector = `.${element.className.split(' ').filter(c => c).join('.')}`;
      } else {
        const tag = element.tagName.toLowerCase();
        const parent = element.parentElement;
        if (parent) {
          const index = Array.from(parent.children).indexOf(element) + 1;
          selector = `${parent.tagName.toLowerCase()} > ${tag}:nth-child(${index})`;
        }
      }

      return { selector, score: bestScore };
    }, targetText);

    if (!match) {
      return null;
    }

    try {
      const elementHandle = await page.$(match.selector);
      if (!elementHandle) {
        return null;
      }

      // Create adapted element
      const newElement: InteractiveElement = {
        ...originalElement,
        selector: match.selector,
        metadata: {
          ...originalElement.metadata,
          adaptedFrom: originalElement.selector,
          adaptationStrategy: 'fuzzy-text-matching',
          adaptationScore: match.score,
        } as any,
      };

      return newElement;
    } catch (error) {
      logger.debug('Failed to create element from fuzzy match', { error });
      return null;
    }
  }

  /**
   * Cache management methods
   */
  private cacheElements(elements: InteractiveElement[], pageUrl: string): void {
    const timestamp = Date.now();
    
    for (const element of elements) {
      const cacheKey = this.getCacheKey(element, pageUrl);
      this.elementCache[cacheKey] = {
        element,
        timestamp,
        pageUrl,
        adaptationHistory: [],
      };
    }
  }

  private cacheElement(element: InteractiveElement, pageUrl: string): void {
    const cacheKey = this.getCacheKey(element, pageUrl);
    const existing = this.elementCache[cacheKey];
    
    this.elementCache[cacheKey] = {
      element,
      timestamp: Date.now(),
      pageUrl,
      adaptationHistory: existing?.adaptationHistory || [],
    };
  }

  private getCacheKey(element: InteractiveElement, pageUrl: string): string {
    return `${pageUrl}_${element.type}_${element.selector}_${element.text || ''}`;
  }

  private isCacheValid(snapshot: ElementSnapshot): boolean {
    const age = Date.now() - snapshot.timestamp;
    return age < this.cacheExpirationMs;
  }

  private recordAdaptationAttempt(key: string, attempt: AdaptationAttempt): void {
    const history = this.adaptationHistory.get(key) || [];
    history.push(attempt);
    this.adaptationHistory.set(key, history);
  }

  /**
   * Get adaptation statistics
   * 
   * Returns comprehensive statistics about element adaptation attempts,
   * including success rates and strategy usage. This is useful for
   * monitoring the effectiveness of the adaptation system.
   * 
   * @returns Statistics object with adaptation metrics
   * 
   * @example
   * ```typescript
   * const stats = detector.getAdaptationStats();
   * 
   * console.log('Adaptation Performance:');
   * console.log(`Total attempts: ${stats.totalAttempts}`);
   * console.log(`Success rate: ${(stats.successfulAdaptations / stats.totalAttempts * 100).toFixed(2)}%`);
   * console.log(`Failed adaptations: ${stats.failedAdaptations}`);
   * 
   * console.log('\nStrategies used:');
   * for (const [strategy, count] of Object.entries(stats.strategiesUsed)) {
   *   console.log(`  ${strategy}: ${count} times`);
   * }
   * ```
   */
  getAdaptationStats(): {
    totalAttempts: number;
    successfulAdaptations: number;
    failedAdaptations: number;
    strategiesUsed: Record<string, number>;
  } {
    let totalAttempts = 0;
    let successfulAdaptations = 0;
    let failedAdaptations = 0;
    const strategiesUsed: Record<string, number> = {};

    for (const attempts of this.adaptationHistory.values()) {
      for (const attempt of attempts) {
        totalAttempts++;
        if (attempt.success) {
          successfulAdaptations++;
        } else {
          failedAdaptations++;
        }
        strategiesUsed[attempt.strategy] = (strategiesUsed[attempt.strategy] || 0) + 1;
      }
    }

    return {
      totalAttempts,
      successfulAdaptations,
      failedAdaptations,
      strategiesUsed,
    };
  }

  /**
   * Clean up resources
   * 
   * Clears all caches, adaptation history, and closes the underlying AI detector.
   * Should be called when the detector is no longer needed to free resources.
   * 
   * @example
   * ```typescript
   * const detector = new SelfAdaptingDetector();
   * try {
   *   await detector.initialize(page);
   *   // Use detector...
   * } finally {
   *   await detector.cleanup();
   * }
   * ```
   */
  async cleanup(): Promise<void> {
    this.elementCache = {};
    this.adaptationHistory.clear();
    await this.detector.cleanup();
  }
}