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
      // Primary: Use AI-powered detection
      const aiDetectedElements = await this.detectWithAI(page);

      // Fallback: Only use selector detection if AI fails or returns too few results
      let selectorDetectedElements: InteractiveElement[] = [];
      if (aiDetectedElements.length < 3 && !this.stagehand) {
        logger.info('Using selector fallback due to limited AI results');
        selectorDetectedElements = await this.detectBySelectors(page);
      }

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

  private async detectWithAI(page: Page): Promise<InteractiveElement[]> {
    if (!this.stagehand) {
      logger.warn('Stagehand not initialized, AI detection unavailable');
      return [];
    }

    const elements: InteractiveElement[] = [];

    try {
      // Natural language queries for comprehensive element detection
      const queries = [
        'Find all interactive elements that users can click or interact with',
        'Find all form inputs where users can enter data',
        'Find all navigation links and menu items',
        'Find all toggles, switches, and selection controls',
        'Find all buttons for submitting forms or triggering actions',
        'Find all dropdown menus and selection lists',
      ];

      const queryPromises = queries.map(async (instruction) => {
        try {
          const result = await (this.stagehand as any).observe({ instruction });
          return Array.isArray(result) ? result : [];
        } catch (error) {
          logger.debug('AI query failed', { instruction, error });
          return [];
        }
      });

      const queryResults = await Promise.all(queryPromises);
      const allObservations = queryResults.flat();

      logger.info('AI detection completed', { 
        queriesExecuted: queries.length,
        elementsFound: allObservations.length,
      });

      // Convert observations to InteractiveElements
      for (const observation of allObservations) {
        const element = await this.createElementFromObservation(page, observation);
        if (element) {
          elements.push(element);
        }
      }

      return elements;
    } catch (error) {
      logger.error('AI detection failed', error);
      return [];
    }
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

  private async createElementFromObservation(
    page: Page,
    observation: any
  ): Promise<InteractiveElement | null> {
    try {
      const selector = observation.selector || observation.xpath;
      const element = await page.$(selector);

      if (!element) {
        return null;
      }

      // Infer type from AI observation description
      const elementType = this.inferTypeFromAIDescription(observation.description || '');
      
      // Create element with AI context
      const interactiveElement = await this.createElementFromHandle(element, elementType, selector);
      
      if (interactiveElement && observation.description) {
        // Add AI-provided context to metadata
        if (!interactiveElement.metadata) {
          interactiveElement.metadata = {};
        }
        interactiveElement.metadata.context = interactiveElement.metadata.context 
          ? `${interactiveElement.metadata.context}. AI: ${observation.description}`
          : `AI: ${observation.description}`;
        interactiveElement.metadata.aiDetected = true;
      }
      
      return interactiveElement;
    } catch (error) {
      logger.debug('Failed to create element from observation', { observation, error });
      return null;
    }
  }

  private inferTypeFromAIDescription(description: string): ElementType {
    const lowerDesc = description.toLowerCase();

    // Pattern matching based on AI descriptions
    if (lowerDesc.includes('button') || lowerDesc.includes('click')) {
      return 'button';
    }
    if (lowerDesc.includes('input') || lowerDesc.includes('text') || lowerDesc.includes('field')) {
      if (lowerDesc.includes('password')) return 'password-input';
      if (lowerDesc.includes('email')) return 'email-input';
      if (lowerDesc.includes('number')) return 'number-input';
      return 'text-input';
    }
    if (lowerDesc.includes('link') || lowerDesc.includes('navigate')) {
      return 'link';
    }
    if (lowerDesc.includes('checkbox')) {
      return 'checkbox';
    }
    if (lowerDesc.includes('radio')) {
      return 'radio';
    }
    if (lowerDesc.includes('select') || lowerDesc.includes('dropdown')) {
      return 'select';
    }
    if (lowerDesc.includes('toggle') || lowerDesc.includes('switch')) {
      return 'toggle';
    }

    return 'unknown';
  }

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
    if (!this.stagehand) {
      return {
        element,
        confidence: 0.5,
        suggestedType: 'unknown',
        reasoning: 'Stagehand not available for classification',
      };
    }

    try {
      // Build context-aware instruction for AI
      const contextInfo = element.metadata?.context ? ` in the context of ${element.metadata.context}` : '';
      const instruction = `Analyze the element at selector "${element.selector}"${contextInfo}. What type of interactive element is this? Consider its tag, attributes, and surrounding context.`;

      const result = await (this.stagehand as any).observe({ instruction });

      if (result && result.length > 0) {
        const observation = result[0];
        const suggestedType = this.inferTypeFromAIDescription(observation.description || '');

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

    // Minimal patterns for critical fallback only
    // These should only be used when AI detection is unavailable
    patterns.set('button', ['button', 'input[type="submit"]']);
    patterns.set('text-input', ['input[type="text"]']);
    patterns.set('link', ['a[href]']);
    patterns.set('checkbox', ['input[type="checkbox"]']);
    patterns.set('radio', ['input[type="radio"]']);
    patterns.set('select', ['select']);

    return patterns;
  }

  classifyElementType(element: Element): ElementType {
    const tagName = element.tagName.toLowerCase();
    const attributes: Record<string, string> = {};

    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      if (attr) {
        attributes[attr.name] = attr.value;
      }
    }

    return this.inferElementType(tagName, attributes);
  }

  private async extractElementContext(element: ElementHandle): Promise<string | undefined> {
    try {
      const context = await element.evaluate((el) => {
        const elem = el as Element;
        const contextParts: string[] = [];

        // Get parent form context
        const form = elem.closest('form');
        if (form) {
          const formName = form.getAttribute('name') || form.getAttribute('id');
          if (formName) {
            contextParts.push(`Form: ${formName}`);
          }
        }

        // Get fieldset context
        const fieldset = elem.closest('fieldset');
        if (fieldset) {
          const legend = fieldset.querySelector('legend');
          if (legend?.textContent) {
            contextParts.push(`Fieldset: ${legend.textContent.trim()}`);
          }
        }

        // Get section context
        const section = elem.closest('section, article, [role="region"]');
        if (section) {
          const heading = section.querySelector('h1, h2, h3, h4, h5, h6');
          if (heading?.textContent) {
            contextParts.push(`Section: ${heading.textContent.trim()}`);
          }
        }

        // Get navigation context
        const nav = elem.closest('nav, [role="navigation"]');
        if (nav) {
          contextParts.push('Navigation area');
        }

        // Get modal/dialog context
        const modal = elem.closest('[role="dialog"], [role="alertdialog"], .modal, .dialog');
        if (modal) {
          contextParts.push('Modal/Dialog');
        }

        // Get table context
        const table = elem.closest('table');
        if (table) {
          const caption = table.querySelector('caption');
          if (caption?.textContent) {
            contextParts.push(`Table: ${caption.textContent.trim()}`);
          }
        }

        // Get list context
        const list = elem.closest('ul, ol, dl');
        if (list) {
          const listType = (list as Element).tagName.toLowerCase();
          contextParts.push(`In ${listType === 'ul' ? 'unordered' : listType === 'ol' ? 'ordered' : 'description'} list`);
        }

        return contextParts.length > 0 ? contextParts.join(', ') : null;
      });

      return context || undefined;
    } catch (error) {
      logger.debug('Failed to extract element context', { error });
      return undefined;
    }
  }

  /**
   * Attempt to re-detect a failed element using AI context
   */
  async adaptElement(
    page: Page, 
    failedElement: InteractiveElement
  ): Promise<InteractiveElement | null> {
    if (!this.stagehand) {
      logger.warn('Cannot adapt element without Stagehand');
      return null;
    }

    try {
      // Build search instruction from element context
      const context = failedElement.metadata?.context || '';
      const text = failedElement.text || '';
      const type = failedElement.type;
      
      const instruction = `Find a ${type.replace('-', ' ')} element${text ? ` with text "${text}"` : ''}${context ? ` in ${context}` : ''}`;
      
      logger.info('Attempting element adaptation', {
        originalSelector: failedElement.selector,
        instruction,
      });

      const result = await (this.stagehand as any).observe({ instruction });
      
      if (result && result.length > 0) {
        const adaptedElement = await this.createElementFromObservation(page, result[0]);
        if (adaptedElement) {
          // Preserve original metadata and add adaptation info
          adaptedElement.metadata = {
            ...adaptedElement.metadata,
            ...failedElement.metadata,
            adaptedFrom: failedElement.selector,
            adaptationTimestamp: new Date().toISOString(),
          };
          
          logger.info('Element successfully adapted', {
            originalSelector: failedElement.selector,
            newSelector: adaptedElement.selector,
          });
          
          return adaptedElement;
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Element adaptation failed', { error });
      return null;
    }
  }

  async cleanup(): Promise<void> {
    if (this.stagehand) {
      this.stagehand = null;
    }
  }
}
