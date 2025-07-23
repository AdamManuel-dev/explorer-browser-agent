"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ButtonStrategy = void 0;
const logger_1 = require("../../utils/logger");
class ButtonStrategy {
    type = 'button';
    async execute(element, context) {
        const { page, options } = context;
        try {
            // Locate the element
            const el = await page.$(element.selector);
            if (!el) {
                throw new Error('Element not found');
            }
            // Scroll into view if needed
            await el.scrollIntoViewIfNeeded();
            // Add delay if specified
            if (options?.delay) {
                await page.waitForTimeout(options.delay);
            }
            // Prepare for navigation if expected
            const navigationPromise = options?.waitForNavigation
                ? page.waitForNavigation({ timeout: options.timeout || 30000 })
                : null;
            // Click the button
            await el.click({ force: options?.force });
            // Wait for navigation if expected
            if (navigationPromise) {
                await navigationPromise;
            }
            logger_1.logger.info('Button clicked', {
                selector: element.selector,
                text: element.text,
            });
            return {
                success: true,
                value: 'clicked',
            };
        }
        catch (error) {
            logger_1.logger.error('Button click failed', { element, error });
            throw error;
        }
    }
    async validate(element) {
        return element.isEnabled && element.isVisible;
    }
}
exports.ButtonStrategy = ButtonStrategy;
//# sourceMappingURL=ButtonStrategy.js.map