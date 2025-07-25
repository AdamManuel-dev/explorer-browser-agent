import { Page, ElementHandle } from 'playwright';
import { Stagehand } from '@browserbasehq/stagehand';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import {
  InteractiveElement,
  ElementType,
  ElementDetectionResult,
  ElementClassification,
} from '../types/elements';
import { StagehandConfig } from '../mastra/types';

export interface AIElementDetectorConfig {
  stagehandConfig?: StagehandConfig;
  enableSelectorFallback?: boolean;
  maxElementsPerQuery?: number;
  cacheResults?: boolean;
}

export class AIElementDetectorV2 {
  private stagehand: Stagehand | null = null;
  private config: AIElementDetectorConfig;
  private detectionCache: Map<string, InteractiveElement[]> = new Map();
  private selectorPatterns: Map<ElementType, string[]>;

  constructor(config: AIElementDetectorConfig = {}) {
    this.config = {
      enableSelectorFallback: true,
      maxElementsPerQuery: 50,
      cacheResults: true,
      ...config,
    };
    this.selectorPatterns = this.initializeSelectorPatterns();
  }

  /**
   * Initialize the detector with a Stagehand instance
   */
  async initialize(stagehand: Stagehand): Promise<void> {
    try {
      this.stagehand = stagehand;
      logger.info('AI Element Detector V2 initialized with Stagehand');
    } catch (error) {
      logger.error('Failed to initialize AI Element Detector V2', error);
      throw error;
    }
  }

  /**
   * Initialize with a page (creates new Stagehand instance)
   */
  async initializeWithPage(page: Page): Promise<void> {
    try {
      this.stagehand = new Stagehand({
        ...this.config.stagehandConfig,
        env: 'LOCAL',
      });
      
      // Set the page
      (this.stagehand as any).page = page;
      
      logger.info('AI Element Detector V2 initialized with page');
    } catch (error) {
      logger.error('Failed to initialize AI Element Detector V2 with page', error);
      throw error;
    }
  }

  /**
   * Detect interactive elements on the page using AI
   */
  async detectInteractiveElements(page: Page): Promise<ElementDetectionResult> {
    const startTime = Date.now();
    const errors: Array<{ selector: string; error: string }> = [];

    try {
      // Check cache first
      const pageUrl = page.url();
      if (this.config.cacheResults && this.detectionCache.has(pageUrl)) {
        logger.debug('Using cached detection results', { url: pageUrl });
        const cachedElements = this.detectionCache.get(pageUrl)!;
        return {
          elements: cachedElements,
          totalFound: cachedElements.length,
          detectionTime: Date.now() - startTime,
          errors,
        };
      }

      // Primary AI-powered detection
      const aiDetectedElements = await this.detectWithAI(page);

      // Fallback to selector-based detection if enabled and AI detection yields few results
      let selectorDetectedElements: InteractiveElement[] = [];
      if (this.config.enableSelectorFallback && aiDetectedElements.length < 5) {
        logger.info('Enhancing with selector-based detection', {
          aiElementCount: aiDetectedElements.length,
        });
        selectorDetectedElements = await this.detectBySelectors(page);
      }

      // Merge and deduplicate results
      const mergedElements = this.mergeAndDeduplicate(aiDetectedElements, selectorDetectedElements);

      // Classify unknown elements
      const classifiedElements = await this.classifyElements(mergedElements);

      // Cache results
      if (this.config.cacheResults) {
        this.detectionCache.set(pageUrl, classifiedElements);
      }

      return {
        elements: classifiedElements,
        totalFound: classifiedElements.length,
        detectionTime: Date.now() - startTime,
        errors,
      };
    } catch (error) {
      logger.error('Element detection failed', error);
      throw error;
    }
  }

  /**
   * Detect elements using AI-powered natural language queries
   */
  private async detectWithAI(page: Page): Promise<InteractiveElement[]> {
    if (!this.stagehand) {
      logger.warn('Stagehand not initialized, skipping AI detection');
      return [];
    }

    const elements: InteractiveElement[] = [];

    try {
      // Define natural language queries for different element types
      const queries = [
        'Find all clickable buttons and submit elements',
        'Find all text input fields, including search boxes and forms',
        'Find all links and navigation elements',
        'Find all checkboxes and radio buttons',
        'Find all dropdown menus and select elements',
        'Find all file upload buttons',
        'Find all interactive elements like toggles and switches',
      ];

      // Execute queries in parallel for better performance
      const queryPromises = queries.map(async (instruction) => {
        try {
          const result = await this.stagehand!.observe({ instruction });
          return Array.isArray(result) ? result : [];
        } catch (error) {
          logger.debug('AI query failed', { instruction, error });
          return [];
        }
      });

      const queryResults = await Promise.all(queryPromises);
      const allObservations = queryResults.flat();

      logger.info('AI detection completed', { 
        totalQueries: queries.length,
        totalObservations: allObservations.length,
      });

      // Convert observations to InteractiveElements
      for (const observation of allObservations) {
        const element = await this.createElementFromObservation(page, observation);
        if (element) {
          elements.push(element);
        }
      }

      // Apply limit if configured
      if (this.config.maxElementsPerQuery && elements.length > this.config.maxElementsPerQuery) {
        return elements.slice(0, this.config.maxElementsPerQuery);
      }

      return elements;
    } catch (error) {
      logger.error('AI detection failed', error);
      return [];
    }
  }

  /**
   * Create an InteractiveElement from a Stagehand observation
   */
  private async createElementFromObservation(
    page: Page,
    observation: any
  ): Promise<InteractiveElement | null> {
    try {
      const selector = observation.selector || observation.xpath;
      if (!selector) {
        return null;
      }

      const element = await page.$(selector);
      if (!element) {
        return null;
      }

      // Infer element type from description using AI context
      const elementType = this.inferTypeFromDescription(observation.description || '');

      return this.createElementFromHandle(element, elementType, selector, observation.description);
    } catch (error) {
      logger.debug('Failed to create element from observation', { observation, error });
      return null;
    }
  }

  /**
   * Infer element type from AI-generated description
   */
  private inferTypeFromDescription(description: string): ElementType {
    const lowerDesc = description.toLowerCase();

    // Button patterns
    if (
      lowerDesc.includes('button') ||
      lowerDesc.includes('submit') ||
      lowerDesc.includes('click to') ||
      lowerDesc.includes('press to')
    ) {
      return 'button';
    }

    // Text input patterns
    if (
      lowerDesc.includes('input') ||
      lowerDesc.includes('text field') ||
      lowerDesc.includes('search') ||
      lowerDesc.includes('enter') ||
      lowerDesc.includes('type')
    ) {
      if (lowerDesc.includes('password')) return 'password-input';
      if (lowerDesc.includes('email')) return 'email-input';
      if (lowerDesc.includes('number')) return 'number-input';
      if (lowerDesc.includes('phone') || lowerDesc.includes('tel')) return 'tel-input';
      return 'text-input';
    }

    // Link patterns
    if (
      lowerDesc.includes('link') ||
      lowerDesc.includes('navigate') ||
      lowerDesc.includes('go to') ||
      lowerDesc.includes('href')
    ) {
      return 'link';
    }

    // Checkbox patterns
    if (lowerDesc.includes('checkbox') || lowerDesc.includes('check box')) {
      return 'checkbox';
    }

    // Radio patterns (be more specific to avoid conflict with button)
    if (lowerDesc.includes('radio button') || lowerDesc.includes('radio')) {
      return 'radio';
    }

    // Select/dropdown patterns
    if (
      lowerDesc.includes('dropdown') ||
      lowerDesc.includes('select') ||
      lowerDesc.includes('menu') ||
      lowerDesc.includes('choose')
    ) {
      return 'select';
    }

    // File upload patterns
    if (lowerDesc.includes('file') || lowerDesc.includes('upload')) {
      return 'file-upload';
    }

    // Toggle/switch patterns
    if (lowerDesc.includes('toggle') || lowerDesc.includes('switch')) {
      return 'toggle';
    }

    return 'unknown';
  }

  /**
   * Fallback to selector-based detection
   */
  private async detectBySelectors(page: Page): Promise<InteractiveElement[]> {
    const elements: InteractiveElement[] = [];

    for (const [elementType, selectors] of this.selectorPatterns) {
      for (const selector of selectors) {
        try {
          const foundElements = await page.$$(selector);

          for (const el of foundElements) {
            const element = await this.createElementFromHandle(el, elementType, selector);
            if (element) {
              elements.push(element);
            }
          }
        } catch (error) {
          logger.debug('Selector detection error', { selector, error });
        }
      }
    }

    return elements;
  }

  /**
   * Create an InteractiveElement from an ElementHandle
   */
  private async createElementFromHandle(
    element: ElementHandle,
    suggestedType: ElementType,
    selector: string,
    aiDescription?: string
  ): Promise<InteractiveElement | null> {
    try {
      const [tagName, attributes, isVisible, isEnabled, boundingBox, text] = await Promise.all([
        element.evaluate((el) => (el as Element).tagName.toLowerCase()),
        element.evaluate((el) => {
          const attrs: Record<string, string> = {};
          const elem = el as Element;
          for (let i = 0; i < elem.attributes.length; i++) {
            const attr = elem.attributes[i];
            if (attr) {
              attrs[attr.name] = attr.value;
            }
          }
          return attrs;
        }),
        element.isVisible(),
        element.isEnabled(),
        element.boundingBox(),
        element.textContent(),
      ]);

      // Use suggested type or infer from element
      const type =
        suggestedType === 'unknown' ? this.inferElementType(tagName, attributes) : suggestedType;

      const metadata = await this.extractMetadata(element, type);

      // Add AI description to context if available
      if (aiDescription && metadata) {
        metadata.context = aiDescription;
        metadata.aiDetected = true;
      }

      return {
        id: uuidv4(),
        type,
        selector,
        text: text?.trim() || undefined,
        attributes,
        isVisible,
        isEnabled,
        boundingBox: boundingBox || undefined,
        metadata,
      };
    } catch (error) {
      logger.debug('Failed to create element from handle', { selector, error });
      return null;
    }
  }

  /**
   * Infer element type from tag and attributes
   */
  private inferElementType(tagName: string, attributes: Record<string, string>): ElementType {
    // Input elements
    if (tagName === 'input') {
      const type = attributes.type?.toLowerCase() || 'text';
      switch (type) {
        case 'text':
          return 'text-input';
        case 'password':
          return 'password-input';
        case 'email':
          return 'email-input';
        case 'number':
          return 'number-input';
        case 'tel':
          return 'tel-input';
        case 'checkbox':
          return 'checkbox';
        case 'radio':
          return 'radio';
        case 'date':
          return 'date-picker';
        case 'time':
          return 'time-picker';
        case 'color':
          return 'color-picker';
        case 'range':
          return 'range-slider';
        case 'file':
          return 'file-upload';
        case 'submit':
        case 'button':
          return 'button';
        default:
          return 'text-input';
      }
    }

    // Other form elements
    if (tagName === 'textarea') return 'textarea';
    if (tagName === 'select') {
      return attributes.multiple ? 'multi-select' : 'select';
    }
    if (tagName === 'button') return 'button';
    if (tagName === 'a') return 'link';

    // Check for custom components by attributes
    if (attributes.role) {
      switch (attributes.role) {
        case 'button':
          return 'button';
        case 'link':
          return 'link';
        case 'checkbox':
          return 'checkbox';
        case 'radio':
          return 'radio';
        case 'tab':
          return 'tab';
        case 'switch':
          return 'toggle';
        case 'combobox':
          return 'select';
        default:
          break;
      }
    }

    return 'unknown';
  }

  /**
   * Extract metadata from element
   */
  private async extractMetadata(
    element: ElementHandle,
    type: ElementType
  ): Promise<InteractiveElement['metadata']> {
    try {
      const metadata: InteractiveElement['metadata'] = {};

      // Extract label
      const label = await element.evaluate((el) => {
        const elem = el as Element;
        const id = elem.getAttribute('id');
        if (id) {
          const labelEl = document.querySelector(`label[for="${id}"]`);
          if (labelEl) return labelEl.textContent?.trim();
        }
        const closestLabel = elem.closest('label');
        return closestLabel?.textContent?.trim();
      });

      if (label) metadata.label = label;

      // Extract placeholder
      const placeholder = await element.getAttribute('placeholder');
      if (placeholder) metadata.placeholder = placeholder;

      // Check if required
      const required = await element.getAttribute('required');
      if (required !== null) metadata.required = true;

      // Extract aria-label into context
      const ariaLabel = await element.getAttribute('aria-label');
      if (ariaLabel) {
        metadata.context = metadata.context ? `${metadata.context}, ${ariaLabel}` : ariaLabel;
      }

      // Extract options for select elements
      if (type === 'select' || type === 'multi-select') {
        const options = await element.evaluate((el) => {
          if ((el as Element).tagName.toLowerCase() === 'select') {
            const selectEl = el as HTMLSelectElement;
            return Array.from(selectEl.options).map((opt) => ({
              value: opt.value,
              text: opt.text,
            }));
          }
          return [];
        });
        if (options.length > 0) metadata.options = options;
      }

      return Object.keys(metadata).length > 0 ? metadata : undefined;
    } catch (error) {
      logger.debug('Failed to extract metadata', { error });
      return undefined;
    }
  }

  /**
   * Classify elements with AI assistance
   */
  private async classifyElements(elements: InteractiveElement[]): Promise<InteractiveElement[]> {
    if (!this.stagehand) {
      return elements;
    }

    const classifiedElements: InteractiveElement[] = [];

    for (const element of elements) {
      if (element.type === 'unknown') {
        try {
          const classification = await this.classifyWithAI(element);
          if (classification.confidence > 0.7) {
            element.type = classification.suggestedType;
            if (element.metadata) {
              element.metadata.aiConfidence = classification.confidence;
              element.metadata.context = element.metadata.context 
                ? `${element.metadata.context}. ${classification.reasoning}`
                : classification.reasoning;
            }
          }
        } catch (error) {
          logger.debug('Failed to classify element with AI', { element, error });
        }
      }
      classifiedElements.push(element);
    }

    return classifiedElements;
  }

  /**
   * Classify an element using AI
   */
  private async classifyWithAI(element: InteractiveElement): Promise<ElementClassification> {
    if (!this.stagehand) {
      return {
        element,
        confidence: 0.5,
        suggestedType: 'unknown',
        reasoning: 'Stagehand not available for classification',
      };
    }

    try {
      // Use Stagehand to analyze the element
      const result = await this.stagehand.observe({
        instruction: `Analyze the element at selector "${element.selector}" and determine its type. Is it a button, link, text input, checkbox, select, or something else?`,
      });

      if (result && result.length > 0) {
        const observation = result[0];
        const suggestedType = this.inferTypeFromDescription(observation.description || '');

        return {
          element,
          confidence: 0.9,
          suggestedType,
          reasoning: observation.description || 'AI analysis completed',
        };
      }

      return {
        element,
        confidence: 0.5,
        suggestedType: 'unknown',
        reasoning: 'Could not analyze element with AI',
      };
    } catch (error) {
      logger.debug('AI classification failed', { error });
      return {
        element,
        confidence: 0.5,
        suggestedType: 'unknown',
        reasoning: 'AI classification error',
      };
    }
  }

  /**
   * Merge and deduplicate elements from different sources
   */
  private mergeAndDeduplicate(
    aiElements: InteractiveElement[],
    selectorElements: InteractiveElement[]
  ): InteractiveElement[] {
    const elementMap = new Map<string, InteractiveElement>();

    // Add AI-detected elements first (higher priority)
    for (const element of aiElements) {
      const key = this.generateElementKey(element);
      elementMap.set(key, element);
    }

    // Add selector-detected elements if not already present
    for (const element of selectorElements) {
      const key = this.generateElementKey(element);
      if (!elementMap.has(key)) {
        elementMap.set(key, element);
      }
    }

    return Array.from(elementMap.values());
  }

  /**
   * Generate a unique key for element deduplication
   */
  private generateElementKey(element: InteractiveElement): string {
    return `${element.selector}_${element.type}_${element.text || ''}_${
      element.boundingBox?.x || 0
    }_${element.boundingBox?.y || 0}`;
  }

  /**
   * Initialize minimal selector patterns for fallback
   */
  private initializeSelectorPatterns(): Map<ElementType, string[]> {
    const patterns = new Map<ElementType, string[]>();

    // Keep only the most common patterns as fallback
    patterns.set('button', ['button', 'input[type="submit"]', '[role="button"]']);
    patterns.set('text-input', ['input[type="text"]', 'input:not([type])']);
    patterns.set('link', ['a[href]']);
    patterns.set('checkbox', ['input[type="checkbox"]']);
    patterns.set('radio', ['input[type="radio"]']);
    patterns.set('select', ['select']);

    return patterns;
  }

  /**
   * Clear the detection cache
   */
  clearCache(): void {
    this.detectionCache.clear();
    logger.debug('Detection cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; urls: string[] } {
    return {
      size: this.detectionCache.size,
      urls: Array.from(this.detectionCache.keys()),
    };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.clearCache();
    if (this.stagehand) {
      await this.stagehand.close();
      this.stagehand = null;
    }
  }
}