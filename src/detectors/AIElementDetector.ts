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

export class AIElementDetector {
  private stagehand: Stagehand | null = null;

  constructor() {
    // No longer using hardcoded selector patterns - using dynamic discovery instead
  }

  async initialize(page: Page): Promise<void> {
    try {
      // Initialize Stagehand with proper configuration
      this.stagehand = new Stagehand({
        env: 'LOCAL',
        headless: process.env.NODE_ENV !== 'development',
        enableCaching: true,
        modelName: 'gpt-4o-mini', // Using cost-effective model for element detection
        logger: (message) => {
          logger.debug('Stagehand:', message);
        },
      });
      
      await this.stagehand.init();
      
      // Navigate to the current page's URL to sync with the provided page
      const currentUrl = await page.url();
      if (currentUrl && currentUrl !== 'about:blank') {
        const stagehandPage = await this.stagehand.page;
        if (stagehandPage.url() !== currentUrl) {
          await stagehandPage.goto(currentUrl);
        }
      }
      
      logger.info('✅ AI Element Detector initialized with Stagehand');
    } catch (error) {
      logger.error('❌ Failed to initialize Stagehand', error);
      // Fallback to selector-based detection
      this.stagehand = null;
      logger.warn('Falling back to selector-based element detection');
    }
  }

  async detectInteractiveElements(page: Page): Promise<ElementDetectionResult> {
    const startTime = Date.now();
    const errors: Array<{ selector: string; error: string }> = [];

    try {
      // Primary: Use AI-powered detection
      const aiDetectedElements = await this.detectWithAI(page);

      // Enhanced fallback: Use dynamic selector discovery if AI results are insufficient
      let selectorDetectedElements: InteractiveElement[] = [];
      if (aiDetectedElements.length < 3) {
        if (this.stagehand) {
          logger.info('AI detection returned few results, attempting enhanced AI discovery');
          selectorDetectedElements = await this.discoverElementsWithEnhancedAI(page);
        } else {
          logger.info('Stagehand unavailable, using dynamic selector discovery');
          selectorDetectedElements = await this.discoverElementsDynamically(page);
        }
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
      // Get the Stagehand page
      const stagehandPage = await this.stagehand.page;
      
      // Natural language queries for comprehensive element detection
      const queries = [
        'Find all interactive elements that users can click or interact with, including their context and purpose',
        'Find all form inputs where users can enter data, noting their labels and form context',
        'Find all navigation links and menu items, identifying their navigation context',
        'Find all toggles, switches, and selection controls with their current state',
        'Find all buttons for submitting forms or triggering actions, including their purpose',
        'Find all dropdown menus and selection lists with their available options',
        'Find all interactive elements within modals, dialogs, or popup windows',
        'Find all table-based interactive elements like sortable headers or row actions',
      ];

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
        queriesExecuted: queries.length,
        elementsFound: allObservations.length,
      });

      // Convert observations to InteractiveElements using the Stagehand page
      for (const observation of allObservations) {
        const element = await this.createElementFromObservation(stagehandPage, observation);
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

  private async discoverElementsWithEnhancedAI(page: Page): Promise<InteractiveElement[]> {
    if (!this.stagehand) {
      return [];
    }

    const elements: InteractiveElement[] = [];

    try {
      // Use more specific AI queries to find missed elements
      const enhancedQueries = [
        'Find any clickable elements that may have been missed, including custom components and hidden interactive elements',
        'Search for form elements and input controls that might not be obvious, including file inputs, hidden fields, and custom form components',
        'Locate all navigation elements including breadcrumbs, pagination, tabs, and menu items',
        'Find interactive elements within complex UI components like carousels, accordions, or expandable sections',
        'Identify elements with click handlers or custom event listeners that might appear non-interactive',
        'Search for elements with accessibility roles that indicate interactivity (button, link, tab, menuitem, etc.)',
      ];

      const stagehandPage = await this.stagehand.page;

      for (const query of enhancedQueries) {
        try {
          const result = await this.stagehand.observe({ instruction: query });
          
          if (result && Array.isArray(result)) {
            for (const observation of result) {
              const element = await this.createElementFromObservation(stagehandPage, observation);
              if (element) {
                elements.push(element);
              }
            }
          }
        } catch (error) {
          logger.debug(`Enhanced AI query failed: ${query}`, { error });
        }
      }

      logger.info(`Enhanced AI discovery found ${elements.length} additional elements`);
      return elements;

    } catch (error) {
      logger.error('Enhanced AI discovery failed', error);
      return [];
    }
  }

  private async discoverElementsDynamically(page: Page): Promise<InteractiveElement[]> {
    const elements: InteractiveElement[] = [];

    try {
      // Analyze the page structure and generate selectors dynamically
      const interactiveElements = await page.evaluate(() => {
        const foundElements: Array<{
          selector: string;
          tagName: string;
          type: string;
          hasClickHandler: boolean;
          isInteractive: boolean;
        }> = [];

        // Find all potentially interactive elements
        const allElements = document.querySelectorAll('*');
        
        allElements.forEach((element, index) => {
          const tagName = element.tagName.toLowerCase();
          const computedStyle = window.getComputedStyle(element);
          
          // Check if element is interactive
          const isButton = tagName === 'button';
          const isInput = tagName === 'input';
          const isSelect = tagName === 'select';
          const isTextarea = tagName === 'textarea';
          const isLink = tagName === 'a' && element.hasAttribute('href');
          const hasTabIndex = element.hasAttribute('tabindex') && element.getAttribute('tabindex') !== '-1';
          const hasClickHandler = element.hasAttribute('onclick') || 
                                element.hasAttribute('ng-click') || 
                                element.hasAttribute('@click') ||
                                element.classList.contains('clickable') ||
                                element.classList.contains('btn') ||
                                element.classList.contains('button');
          const hasRole = element.hasAttribute('role') && 
                         ['button', 'link', 'tab', 'menuitem', 'option', 'checkbox', 'radio'].includes(element.getAttribute('role') || '');
          const isCursorPointer = computedStyle.cursor === 'pointer';
          
          const isInteractive = isButton || isInput || isSelect || isTextarea || isLink || 
                               hasTabIndex || hasClickHandler || hasRole || isCursorPointer;

          if (isInteractive && computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden') {
            // Generate a robust selector
            let selector = '';
            
            // Try ID first
            if (element.id) {
              selector = `#${element.id}`;
            }
            // Try data-testid
            else if (element.getAttribute('data-testid')) {
              selector = `[data-testid="${element.getAttribute('data-testid')}"]`;
            }
            // Try unique class combination
            else if (element.className && typeof element.className === 'string') {
              const classes = element.className.trim().split(/\s+/).filter(c => c.length > 0);
              if (classes.length > 0) {
                selector = `.${classes.join('.')}`;
                // Check if this selector is unique
                if (document.querySelectorAll(selector).length > 1) {
                  // Add parent context if needed
                  const parent = element.parentElement;
                  if (parent && parent.tagName.toLowerCase() !== 'body') {
                    const parentTag = parent.tagName.toLowerCase();
                    selector = `${parentTag} ${selector}`;
                  }
                }
              }
            }
            
            // Fallback to nth-child selector
            if (!selector || document.querySelectorAll(selector).length !== 1) {
              const parent = element.parentElement;
              if (parent) {
                const siblings = Array.from(parent.children);
                const childIndex = siblings.indexOf(element) + 1;
                const parentSelector = parent.tagName.toLowerCase();
                selector = `${parentSelector} > ${tagName}:nth-child(${childIndex})`;
              } else {
                selector = `${tagName}:nth-of-type(${index + 1})`;
              }
            }

            foundElements.push({
              selector,
              tagName,
              type: isInput ? element.getAttribute('type') || 'text' : tagName,
              hasClickHandler,
              isInteractive,
            });
          }
        });

        return foundElements;
      });

      // Convert discovered elements to InteractiveElement objects
      for (const elementInfo of interactiveElements) {
        try {
          const elementHandle = await page.$(elementInfo.selector);
          if (elementHandle) {
            const elementType = this.inferElementTypeFromInfo(elementInfo);
            const element = await this.createElementFromHandle(elementHandle, elementType, elementInfo.selector);
            if (element) {
              elements.push(element);
            }
          }
        } catch (error) {
          logger.debug(`Failed to create element for selector: ${elementInfo.selector}`, { error });
        }
      }

      logger.info(`Dynamic discovery found ${elements.length} elements`);
      return elements;

    } catch (error) {
      logger.error('Dynamic element discovery failed', error);
      return [];
    }
  }

  private inferElementTypeFromInfo(elementInfo: {
    tagName: string;
    type: string;
    hasClickHandler: boolean;
  }): ElementType {
    const { tagName, type } = elementInfo;

    switch (tagName) {
      case 'button':
        return 'button';
      case 'input':
        switch (type) {
          case 'text':
          case 'email':
          case 'password':
          case 'search':
          case 'url':
            return 'text-input';
          case 'checkbox':
            return 'checkbox';
          case 'radio':
            return 'radio';
          case 'submit':
          case 'button':
            return 'button';
          case 'file':
            return 'file-upload';
          default:
            return 'text-input';
        }
      case 'select':
        return 'select';
      case 'textarea':
        return 'textarea';
      case 'a':
        return 'link';
      default:
        return elementInfo.hasClickHandler ? 'button' : 'unknown';
    }
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

      // Extract contextual information
      const context = await this.extractElementContext(element);
      if (context) metadata.context = context;

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

        // Get parent container context
        const main = elem.closest('main');
        if (main) {
          contextParts.push('Main content area');
        }

        const aside = elem.closest('aside');
        if (aside) {
          contextParts.push('Sidebar area');
        }

        const header = elem.closest('header');
        if (header) {
          contextParts.push('Header area');
        }

        const footer = elem.closest('footer');
        if (footer) {
          contextParts.push('Footer area');
        }

        // Get role-based context
        const roleElement = elem.closest('[role]');
        if (roleElement && roleElement !== elem) {
          const role = roleElement.getAttribute('role');
          if (role && !contextParts.some(part => part.toLowerCase().includes(role))) {
            contextParts.push(`${role.charAt(0).toUpperCase() + role.slice(1)} area`);
          }
        }

        // Get data attribute context for components
        const componentElement = elem.closest('[data-component], [data-testid]');
        if (componentElement) {
          const component = componentElement.getAttribute('data-component') || 
                           componentElement.getAttribute('data-testid');
          if (component) {
            contextParts.push(`${component} component`);
          }
        }

        // Get sibling context for related elements
        if (elem.previousElementSibling?.tagName.toLowerCase() === 'label') {
          const labelText = elem.previousElementSibling.textContent?.trim();
          if (labelText && !contextParts.some(part => part.includes(labelText))) {
            contextParts.push(`After label: ${labelText}`);
          }
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
      // Build comprehensive search instruction from element context
      const context = failedElement.metadata?.context || '';
      const text = failedElement.text || '';
      const type = failedElement.type;
      const label = failedElement.metadata?.label || '';
      
      // Create multiple search strategies
      const searchStrategies = [
        // Strategy 1: Use text and context
        `Find a ${type.replace('-', ' ')} element${text ? ` with text "${text}"` : ''}${context ? ` in ${context}` : ''}`,
        
        // Strategy 2: Use label and context if available
        label ? `Find a ${type.replace('-', ' ')} element${label ? ` labeled "${label}"` : ''}${context ? ` in ${context}` : ''}` : null,
        
        // Strategy 3: Use context and purpose
        context ? `Find a ${type.replace('-', ' ')} element used for interaction in ${context}` : null,
        
        // Strategy 4: Fallback to type and purpose
        `Find any ${type.replace('-', ' ')} element that serves the same purpose as the missing element`,
      ].filter(Boolean) as string[];
      
      logger.info('Attempting element adaptation with multiple strategies', {
        originalSelector: failedElement.selector,
        strategiesCount: searchStrategies.length,
      });

      // Try each strategy until one succeeds
      for (const instruction of searchStrategies) {
        try {
          const result = await this.stagehand!.observe({ instruction });
          
          if (result && result.length > 0) {
            const stagehandPage = await this.stagehand!.page;
            const adaptedElement = await this.createElementFromObservation(stagehandPage, result[0]);
            
            if (adaptedElement) {
              // Preserve original metadata and add adaptation info
              adaptedElement.metadata = {
                ...adaptedElement.metadata,
                ...failedElement.metadata,
                adaptedFrom: failedElement.selector,
                adaptationTimestamp: new Date().toISOString(),
                adaptationReason: `Adapted using strategy: ${instruction}`,
              };
              
              logger.info('Element successfully adapted', {
                originalSelector: failedElement.selector,
                newSelector: adaptedElement.selector,
                strategy: instruction,
              });
              
              return adaptedElement;
            }
          }
        } catch (strategyError) {
          logger.debug(`Adaptation strategy failed: ${instruction}`, { error: strategyError });
        }
      }
      
      logger.warn('All adaptation strategies failed', {
        originalSelector: failedElement.selector,
        strategiesAttempted: searchStrategies.length,
      });
      
      return null;
    } catch (error) {
      logger.error('Element adaptation failed', { error });
      return null;
    }
  }

  async cleanup(): Promise<void> {
    if (this.stagehand) {
      try {
        await this.stagehand.close();
        logger.debug('Stagehand session closed');
      } catch (error) {
        logger.warn('Error closing Stagehand session', error);
      } finally {
        this.stagehand = null;
      }
    }
  }
}
