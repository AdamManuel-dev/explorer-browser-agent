"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.InteractionExecutor = void 0;
const logger_1 = require("../utils/logger");
const TestDataGenerator_1 = require("./TestDataGenerator");
const strategies = __importStar(require("./strategies"));
class InteractionExecutor {
    strategies;
    testDataGenerator;
    page = null;
    constructor() {
        this.strategies = this.initializeStrategies();
        this.testDataGenerator = new TestDataGenerator_1.TestDataGenerator();
    }
    setPage(page) {
        this.page = page;
    }
    async executeInteraction(element, options) {
        if (!this.page) {
            throw new Error('Page not set. Call setPage() first.');
        }
        const startTime = Date.now();
        const networkActivity = [];
        const stateChanges = [];
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
            const context = {
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
            logger_1.logger.info('Executing interaction', {
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
            let screenshot;
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
        }
        catch (error) {
            logger_1.logger.error('Interaction execution failed', {
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
    initializeStrategies() {
        const strategyMap = new Map();
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
    async monitorNetwork(networkActivity) {
        if (!this.page)
            return;
        this.page.on('request', (request) => {
            networkActivity.push({
                url: request.url(),
                method: request.method(),
                timing: Date.now(),
            });
        });
        this.page.on('response', (response) => {
            const activity = networkActivity.find((a) => a.url === response.url() && !a.status);
            if (activity) {
                activity.status = response.status();
            }
        });
    }
    async waitForNetworkIdle() {
        if (!this.page)
            return;
        try {
            await this.page.waitForLoadState('networkidle', { timeout: 5000 });
        }
        catch {
            // Network might not settle, continue anyway
        }
    }
    async captureState() {
        if (!this.page)
            return {};
        return {
            url: this.page.url(),
            localStorage: await this.page.evaluate(() => {
                const items = {};
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
    compareStates(before, after) {
        const changes = [];
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
    async takeScreenshot(element) {
        if (!this.page)
            return '';
        const timestamp = Date.now();
        const filename = `interaction_${element.type}_${timestamp}.png`;
        try {
            if (element.selector) {
                const el = await this.page.$(element.selector);
                if (el) {
                    await el.screenshot({ path: `screenshots/${filename}` });
                }
            }
            else {
                await this.page.screenshot({ path: `screenshots/${filename}` });
            }
            return filename;
        }
        catch (error) {
            logger_1.logger.error('Failed to take screenshot', { error });
            return '';
        }
    }
    async cleanup() {
        this.page = null;
    }
}
exports.InteractionExecutor = InteractionExecutor;
//# sourceMappingURL=InteractionExecutor.js.map