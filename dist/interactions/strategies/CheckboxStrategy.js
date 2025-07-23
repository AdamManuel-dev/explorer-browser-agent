"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckboxStrategy = void 0;
const logger_1 = require("../../utils/logger");
class CheckboxStrategy {
    type = 'checkbox';
    async execute(element, context) {
        const { page, testData, options } = context;
        try {
            // Locate the element
            const el = await page.$(element.selector);
            if (!el) {
                throw new Error('Element not found');
            }
            // Get current state
            const isChecked = await el.isChecked();
            // Determine desired state
            const shouldBeChecked = testData?.value !== undefined
                ? Boolean(testData.value)
                : !isChecked; // Toggle if no specific value provided
            // Only click if state needs to change
            if (isChecked !== shouldBeChecked) {
                // Add delay if specified
                if (options?.delay) {
                    await page.waitForTimeout(options.delay);
                }
                await el.click({ force: options?.force });
            }
            // Verify final state
            const finalState = await el.isChecked();
            logger_1.logger.info('Checkbox interaction completed', {
                selector: element.selector,
                previousState: isChecked,
                finalState,
            });
            return {
                success: true,
                value: finalState,
            };
        }
        catch (error) {
            logger_1.logger.error('Checkbox interaction failed', { element, error });
            throw error;
        }
    }
    async validate(element) {
        return element.isEnabled && element.isVisible;
    }
}
exports.CheckboxStrategy = CheckboxStrategy;
//# sourceMappingURL=CheckboxStrategy.js.map