"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIElementDetector = void 0;
// import { Stagehand } from '@stagehand/playwright';
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
class AIElementDetector {
    stagehand = null;
    selectorPatterns;
    constructor() {
        this.selectorPatterns = this.initializeSelectorPatterns();
    }
    async initialize(_page) {
        try {
            // TODO: Initialize Stagehand when available
            // this.stagehand = new Stagehand({
            //   page,
            //   enableDebugMode: process.env.NODE_ENV === 'development',
            // });
            // await this.stagehand.init();
            logger_1.logger.info('AI Element Detector initialized');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize Stagehand', error);
            throw error;
        }
    }
    async detectInteractiveElements(page) {
        const startTime = Date.now();
        const errors = [];
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
        }
        catch (error) {
            logger_1.logger.error('Element detection failed', error);
            throw error;
        }
    }
    async detectWithAI(_page) {
        const elements = [];
        try {
            // TODO: Implement AI detection with Stagehand when available
            logger_1.logger.info('AI detection skipped (Stagehand not available)', { found: elements.length });
        }
        catch (error) {
            logger_1.logger.error('AI detection failed', error);
        }
        return elements;
    }
    async detectBySelectors(page) {
        const elements = [];
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
                }
                catch (error) {
                    logger_1.logger.debug('Selector detection error', { selector, error });
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
    async createElementFromHandle(element, suggestedType, selector) {
        try {
            const [tagName, attributes, isVisible, isEnabled, boundingBox, text] = await Promise.all([
                element.evaluate((el) => el.tagName.toLowerCase()),
                element.evaluate((el) => {
                    const attrs = {};
                    const elem = el;
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
            const type = suggestedType === 'unknown' ? this.inferElementType(tagName, attributes) : suggestedType;
            const metadata = await this.extractMetadata(element, type);
            return {
                id: (0, uuid_1.v4)(),
                type,
                selector,
                text: text?.trim() || undefined,
                attributes,
                isVisible,
                isEnabled,
                boundingBox: boundingBox || undefined,
                metadata,
            };
        }
        catch (error) {
            logger_1.logger.debug('Failed to create element from handle', { selector, error });
            return null;
        }
    }
    inferElementType(tagName, attributes) {
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
        if (tagName === 'textarea')
            return 'textarea';
        if (tagName === 'select') {
            return attributes.multiple ? 'multi-select' : 'select';
        }
        if (tagName === 'button')
            return 'button';
        if (tagName === 'a')
            return 'link';
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
    async extractMetadata(element, type) {
        try {
            const metadata = {};
            // Extract label
            const label = await element.evaluate((el) => {
                const elem = el;
                const id = elem.getAttribute('id');
                if (id) {
                    const labelEl = document.querySelector(`label[for="${id}"]`);
                    if (labelEl)
                        return labelEl.textContent?.trim();
                }
                const closestLabel = elem.closest('label');
                return closestLabel?.textContent?.trim();
            });
            if (label)
                metadata.label = label;
            // Extract placeholder
            const placeholder = await element.getAttribute('placeholder');
            if (placeholder)
                metadata.placeholder = placeholder;
            // Check if required
            const required = await element.getAttribute('required');
            if (required !== null)
                metadata.required = true;
            // Extract options for select elements
            if (type === 'select' || type === 'multi-select') {
                const options = await element.evaluate((el) => {
                    if (el.tagName.toLowerCase() === 'select') {
                        const selectEl = el;
                        return Array.from(selectEl.options).map((opt) => ({
                            value: opt.value,
                            text: opt.text,
                        }));
                    }
                    return [];
                });
                if (options.length > 0)
                    metadata.options = options;
            }
            return Object.keys(metadata).length > 0 ? metadata : undefined;
        }
        catch (error) {
            logger_1.logger.debug('Failed to extract metadata', { error });
            return undefined;
        }
    }
    async classifyElements(elements) {
        if (!this.stagehand) {
            return elements;
        }
        const classifiedElements = [];
        for (const element of elements) {
            if (element.type === 'unknown') {
                try {
                    const classification = await this.classifyWithAI(element);
                    if (classification.confidence > 0.7) {
                        element.type = classification.suggestedType;
                    }
                }
                catch (error) {
                    logger_1.logger.debug('Failed to classify element with AI', { element, error });
                }
            }
            classifiedElements.push(element);
        }
        return classifiedElements;
    }
    async classifyWithAI(element) {
        // This would use Stagehand's AI capabilities to classify unknown elements
        // For now, returning a default classification
        return {
            element,
            confidence: 0.5,
            suggestedType: 'unknown',
            reasoning: 'Manual classification needed',
        };
    }
    mergeAndDeduplicate(aiElements, selectorElements) {
        const elementMap = new Map();
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
    generateElementKey(element) {
        return `${element.selector}_${element.type}_${element.text || ''}_${element.boundingBox?.x || 0}_${element.boundingBox?.y || 0}`;
    }
    initializeSelectorPatterns() {
        const patterns = new Map();
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
    classifyElementType(element) {
        const tagName = element.tagName.toLowerCase();
        const attributes = {};
        for (let i = 0; i < element.attributes.length; i++) {
            const attr = element.attributes[i];
            if (attr) {
                attributes[attr.name] = attr.value;
            }
        }
        return this.inferElementType(tagName, attributes);
    }
    async cleanup() {
        if (this.stagehand) {
            this.stagehand = null;
        }
    }
}
exports.AIElementDetector = AIElementDetector;
//# sourceMappingURL=AIElementDetector.js.map