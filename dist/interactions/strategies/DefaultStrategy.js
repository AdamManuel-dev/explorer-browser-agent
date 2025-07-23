"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultStrategy = void 0;
const logger_1 = require("../../utils/logger");
class DefaultStrategy {
    type = 'default';
    async execute(element, context) {
        const { page, options } = context;
        try {
            // Locate the element
            const el = await page.$(element.selector);
            if (!el) {
                throw new Error('Element not found');
            }
            // Try to determine the best interaction based on element properties
            const tagName = await el.evaluate((e) => e.tagName.toLowerCase());
            const role = await el.getAttribute('role');
            // Scroll into view if needed
            await el.scrollIntoViewIfNeeded();
            // Add delay if specified
            if (options?.delay) {
                await page.waitForTimeout(options.delay);
            }
            // Default interaction is click
            await el.click({ force: options?.force });
            logger_1.logger.info('Default interaction executed', {
                selector: element.selector,
                tagName,
                role,
            });
            return {
                success: true,
                value: 'interacted',
                timing: Date.now(),
            };
        }
        catch (error) {
            logger_1.logger.error('Default interaction failed', { element, error });
            throw error;
        }
    }
    async validate(element) {
        // For unknown elements, we just check visibility
        return element.isVisible;
    }
}
exports.DefaultStrategy = DefaultStrategy;
//# sourceMappingURL=DefaultStrategy.js.map