import { Page, ElementHandle } from 'playwright';
// import { Stagehand } from '@stagehand/playwright';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import {
  InteractiveElement,
  ElementType,
  ElementDetectionResult,
  ElementClassification,
} from '../types/elements';

export class AIElementDetector {
  private stagehand: unknown = null;

  private selectorPatterns: Map<ElementType, string[]>;

  constructor() {
    this.selectorPatterns = this.initializeSelectorPatterns();
  }

  async initialize(_page: Page): Promise<void> {
    try {
      // TODO: Initialize Stagehand when available
      // this.stagehand = new Stagehand({
      //   page,
      //   enableDebugMode: process.env.NODE_ENV === 'development',
      // });
      // await this.stagehand.init();
      logger.info('AI Element Detector initialized');
    } catch (error) {
      logger.error('Failed to initialize Stagehand', error);
      throw error;
    }
  }

  async detectInteractiveElements(page: Page): Promise<ElementDetectionResult> {
    const startTime = Date.now();
    const errors: Array<{ selector: string; error: string }> = [];

    try {
      // Use Stagehand's AI-powered detection
      const aiDetectedElements = await this.detectWithAI(page);

      // Enhance with traditional selector-based detection
      const selectorDetectedElements = await this.detectBySelectors(page);

      // Merge and deduplicate results
      const mergedElements = this.mergeAndDeduplicate(aiDetectedElements, selectorDetectedElements);

      // Classify elements with AI assistance
      const classifiedElements = await this.classifyElements(mergedElements);

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

  private async detectWithAI(_page: Page): Promise<InteractiveElement[]> {
    const elements: InteractiveElement[] = [];

    try {
      // TODO: Implement AI detection with Stagehand when available
      logger.info('AI detection skipped (Stagehand not available)', { found: elements.length });
    } catch (error) {
      logger.error('AI detection failed', error);
    }

    return elements;
  }

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

  // private async createElementFromObservation(
  //   page: Page,
  //   observation: any
  // ): Promise<InteractiveElement | null> {
  //   try {
  //     const selector = observation.selector || observation.xpath;
  //     const element = await page.$(selector);
  //
  //     if (!element) {
  //       return null;
  //     }

  //     return this.createElementFromHandle(element, 'unknown', selector);
  //   } catch (error) {
  //     logger.debug('Failed to create element from observation', { observation, error });
  //     return null;
  //   }
  // }

  private async createElementFromHandle(
    element: ElementHandle,
    suggestedType: ElementType,
    selector: string
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

      const type =
        suggestedType === 'unknown' ? this.inferElementType(tagName, attributes) : suggestedType;

      const metadata = await this.extractMetadata(element, type);

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
          // Unknown role, fall through to other detection methods
          break;
      }
    }

    return 'unknown';
  }

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
          }
        } catch (error) {
          logger.debug('Failed to classify element with AI', { element, error });
        }
      }
      classifiedElements.push(element);
    }

    return classifiedElements;
  }

  private async classifyWithAI(element: InteractiveElement): Promise<ElementClassification> {
    // This would use Stagehand's AI capabilities to classify unknown elements
    // For now, returning a default classification
    return {
      element,
      confidence: 0.5,
      suggestedType: 'unknown',
      reasoning: 'Manual classification needed',
    };
  }

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

  private generateElementKey(element: InteractiveElement): string {
    return `${element.selector}_${element.type}_${element.text || ''}_${
      element.boundingBox?.x || 0
    }_${element.boundingBox?.y || 0}`;
  }

  private initializeSelectorPatterns(): Map<ElementType, string[]> {
    const patterns = new Map<ElementType, string[]>();

    patterns.set('text-input', [
      'input[type="text"]',
      'input:not([type])',
      'input[type=""]',
      '[contenteditable="true"]',
    ]);

    patterns.set('button', [
      'button',
      'input[type="submit"]',
      'input[type="button"]',
      'a.button',
      'a.btn',
      '[role="button"]',
    ]);

    patterns.set('link', ['a[href]', '[role="link"]']);

    patterns.set('checkbox', ['input[type="checkbox"]', '[role="checkbox"]']);

    patterns.set('radio', ['input[type="radio"]', '[role="radio"]']);

    patterns.set('select', ['select:not([multiple])', '[role="combobox"]', '[role="listbox"]']);

    patterns.set('textarea', ['textarea']);

    patterns.set('file-upload', ['input[type="file"]']);

    return patterns;
  }

  async cleanup(): Promise<void> {
    if (this.stagehand) {
      this.stagehand = null;
    }
  }
}
