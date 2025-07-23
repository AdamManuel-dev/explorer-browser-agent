"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectStrategy = void 0;
const logger_1 = require("../../utils/logger");
class SelectStrategy {
    type = 'select';
    async execute(element, context) {
        const { page, testData, options } = context;
        try {
            // Locate the element
            const el = await page.$(element.selector);
            if (!el) {
                throw new Error('Element not found');
            }
            // Get available options
            const availableOptions = element.metadata?.options || [];
            // Determine value to select
            let valueToSelect;
            if (testData?.value) {
                valueToSelect = String(testData.value); // Convert to string
            }
            else if (availableOptions.length > 0) {
                // Select a random option (skip first if it's a placeholder)
                const startIndex = availableOptions[0]?.value === '' ? 1 : 0;
                const randomIndex = Math.floor(Math.random() * (availableOptions.length - startIndex)) + startIndex;
                valueToSelect = availableOptions[randomIndex].value;
            }
            else {
                throw new Error('No options available to select');
            }
            // Add delay if specified
            if (options?.delay) {
                await page.waitForTimeout(options.delay);
            }
            // Select the value
            await el.selectOption(valueToSelect);
            logger_1.logger.info('Select option chosen', {
                selector: element.selector,
                value: valueToSelect,
            });
            return {
                success: true,
                value: valueToSelect,
                timing: Date.now(),
            };
        }
        catch (error) {
            logger_1.logger.error('Select interaction failed', { element, error });
            throw error;
        }
    }
    async validate(element) {
        return element.isEnabled && element.isVisible;
    }
}
exports.SelectStrategy = SelectStrategy;
//# sourceMappingURL=SelectStrategy.js.map