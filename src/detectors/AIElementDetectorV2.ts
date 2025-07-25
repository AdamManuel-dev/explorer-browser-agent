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

    // Radio patterns (check before button to avoid conflict)
    if (lowerDesc.includes('radio button') || (lowerDesc.includes('radio') && !lowerDesc.includes('button'))) {
      return 'radio';
    }

    // Password input patterns (check before general input)
    if (lowerDesc.includes('password')) {
      return 'password-input';
    }

    // Email input patterns (check before general input)
    if (lowerDesc.includes('email')) {
      return 'email-input';
    }

    // Phone/tel input patterns (check before general input)
    if (lowerDesc.includes('phone') || lowerDesc.includes('tel')) {
      return 'tel-input';
    }

    // Number input patterns (check before general input)
    if (lowerDesc.includes('number')) {
      return 'number-input';
    }

    // File upload patterns (check before button patterns)
    if ((lowerDesc.includes('file') && lowerDesc.includes('upload')) || 
        lowerDesc.includes('file upload')) {
      return 'file-upload';
    }

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
      lowerDesc.includes('field') ||
      lowerDesc.includes('search') ||
      lowerDesc.includes('enter') ||
      lowerDesc.includes('type')
    ) {
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

    // Select/dropdown patterns
    if (
      lowerDesc.includes('dropdown') ||
      lowerDesc.includes('select') ||
      lowerDesc.includes('menu') ||
      lowerDesc.includes('choose')
    ) {
      return 'select';
    }

    // This is now handled earlier in the function

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
   * Self-adapting element detection for UI changes
   * This method attempts to re-detect elements when their selectors fail
   */
  async adaptiveElementDetection(
    page: Page,
    previousElements: InteractiveElement[],
    retryAttempts: number = 3
  ): Promise<InteractiveElement[]> {
    if (!this.stagehand) {
      logger.warn('Stagehand not available for adaptive detection');
      return [];
    }

    const adaptedElements: InteractiveElement[] = [];
    const failedElements: InteractiveElement[] = [];

    // First, try to find elements using their previous selectors
    for (const element of previousElements) {
      try {
        const foundElement = await page.$(element.selector);
        if (foundElement) {
          // Element still exists, add it to adapted elements
          const updatedElement = await this.createElementFromHandle(
            foundElement,
            element.type,
            element.selector
          );
          if (updatedElement) {
            adaptedElements.push(updatedElement);
          }
        } else {
          // Element not found, mark for re-detection
          failedElements.push(element);
        }
      } catch (error) {
        logger.debug('Element selector failed', { selector: element.selector, error });
        failedElements.push(element);
      }
    }

    // For failed elements, use AI to find them based on their previous context
    for (const failedElement of failedElements) {
      let attempts = 0;
      let found = false;

      while (attempts < retryAttempts && !found) {
        try {
          // Build adaptive search instruction using previous element context
          const context = failedElement.metadata?.context || '';
          const elementText = failedElement.text || '';
          const elementRole = failedElement.attributes?.role || '';
          
          const searchInstruction = this.buildAdaptiveSearchInstruction(
            failedElement.type,
            context,
            elementText,
            elementRole
          );

          logger.info('Attempting adaptive detection', {
            originalSelector: failedElement.selector,
            searchInstruction,
            attempt: attempts + 1,
          });

          const result = await this.stagehand.observe({ instruction: searchInstruction });

          if (result && result.length > 0) {
            // Found potential replacement, validate it's similar to the original
            const newElement = await this.createElementFromObservation(page, result[0]);
            if (newElement && this.isElementSimilar(failedElement, newElement)) {
              // Update the element with new selector but preserve original metadata
              newElement.metadata = {
                ...newElement.metadata,
                ...failedElement.metadata,
                adaptedFrom: failedElement.selector,
                adaptationReason: 'UI change detected',
                adaptationTimestamp: new Date().toISOString(),
              };
              adaptedElements.push(newElement);
              found = true;
              logger.info('Successfully adapted element', {
                originalSelector: failedElement.selector,
                newSelector: newElement.selector,
              });
            }
          }
        } catch (error) {
          logger.debug('Adaptive detection attempt failed', { attempt: attempts + 1, error });
        }
        attempts++;
      }

      if (!found) {
        logger.warn('Could not adapt element after retries', {
          originalSelector: failedElement.selector,
          attempts: retryAttempts,
        });
      }
    }

    return adaptedElements;
  }

  /**
   * Build an AI search instruction for adaptive element detection
   */
  private buildAdaptiveSearchInstruction(
    elementType: ElementType,
    context: string,
    text: string,
    role: string
  ): string {
    const parts: string[] = [];

    // Base instruction
    parts.push(`Find a ${elementType.replace('-', ' ')} element`);

    // Add text context if available
    if (text) {
      parts.push(`with text similar to "${text}"`);
    }

    // Add role context if available
    if (role) {
      parts.push(`with role "${role}"`);
    }

    // Add surrounding context if available
    if (context) {
      parts.push(`in the context of ${context}`);
    }

    // Add type-specific hints
    switch (elementType) {
      case 'button':
        parts.push('that users can click to trigger actions');
        break;
      case 'text-input':
        parts.push('where users can enter text');
        break;
      case 'link':
        parts.push('that navigates to another page or section');
        break;
      case 'checkbox':
        parts.push('that can be checked or unchecked');
        break;
      case 'select':
        parts.push('where users can choose from options');
        break;
    }

    return parts.join(' ');
  }

  /**
   * Check if two elements are similar enough to be considered the same
   */
  private isElementSimilar(original: InteractiveElement, candidate: InteractiveElement): boolean {
    // Type must match
    if (original.type !== candidate.type) {
      return false;
    }

    // Check text similarity (allow some variation)
    if (original.text && candidate.text) {
      const textSimilarity = this.calculateTextSimilarity(original.text, candidate.text);
      if (textSimilarity < 0.7) {
        return false;
      }
    }

    // Check position similarity (elements shouldn't move too far)
    if (original.boundingBox && candidate.boundingBox) {
      const positionDistance = Math.sqrt(
        Math.pow(original.boundingBox.x - candidate.boundingBox.x, 2) +
        Math.pow(original.boundingBox.y - candidate.boundingBox.y, 2)
      );
      // Allow up to 200 pixels of movement
      if (positionDistance > 200) {
        return false;
      }
    }

    // Check attribute similarity
    const criticalAttributes = ['type', 'name', 'id', 'class'];
    let matchingAttributes = 0;
    let totalAttributes = 0;

    for (const attr of criticalAttributes) {
      if (original.attributes[attr] || candidate.attributes[attr]) {
        totalAttributes++;
        if (original.attributes[attr] === candidate.attributes[attr]) {
          matchingAttributes++;
        }
      }
    }

    // Require at least 50% attribute similarity
    const attributeSimilarity = totalAttributes > 0 ? matchingAttributes / totalAttributes : 1;
    return attributeSimilarity >= 0.5;
  }

  /**
   * Calculate text similarity between two strings
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;
    
    const s1 = text1.toLowerCase().trim();
    const s2 = text2.toLowerCase().trim();
    
    if (s1 === s2) return 1;
    
    // Simple Jaccard similarity based on words
    const words1 = new Set(s1.split(/\s+/));
    const words2 = new Set(s2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Monitor page for UI changes and trigger adaptive detection
   */
  async monitorForUIChanges(
    page: Page,
    elements: InteractiveElement[],
    callback: (adaptedElements: InteractiveElement[]) => void
  ): Promise<void> {
    if (!this.stagehand || elements.length === 0) {
      return;
    }

    try {
      // Set up mutation observer to detect DOM changes
      await page.evaluate(() => {
        const observer = new MutationObserver((mutations) => {
          const hasStructuralChanges = mutations.some(mutation => 
            mutation.type === 'childList' && 
            (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)
          );
          
          if (hasStructuralChanges) {
            // Trigger UI change detection
            (window as any).uiChangeDetected = true;
          }
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class', 'id', 'data-testid'],
        });
        
        (window as any).stopUIMonitoring = () => observer.disconnect();
      });

      // Periodically check for UI changes
      const checkInterval = setInterval(async () => {
        try {
          const uiChanged = await page.evaluate(() => {
            const changed = (window as any).uiChangeDetected;
            (window as any).uiChangeDetected = false;
            return changed;
          });

          if (uiChanged) {
            logger.info('UI changes detected, triggering adaptive element detection');
            const adaptedElements = await this.adaptiveElementDetection(page, elements);
            callback(adaptedElements);
          }
        } catch (error) {
          logger.debug('Error checking for UI changes', { error });
        }
      }, 2000); // Check every 2 seconds

      // Clean up on page close
      page.on('close', () => {
        clearInterval(checkInterval);
      });

    } catch (error) {
      logger.error('Failed to set up UI change monitoring', { error });
    }
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