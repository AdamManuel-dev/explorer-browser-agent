"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RadioStrategy = void 0;
const logger_1 = require("../../utils/logger");
class RadioStrategy {
    type = 'radio';
    async execute(element, context) {
        const { page, options } = context;
        try {
            // Locate the element
            const el = await page.$(element.selector);
            if (!el) {
                throw new Error('Element not found');
            }
            // Get the name attribute to find related radio buttons
            const name = await el.getAttribute('name');
            if (!name) {
                // If no name, just click this radio button
                await el.click({ force: options?.force });
                return {
                    success: true,
                    value: await el.getAttribute('value') || 'selected',
                };
            }
            // Find all radio buttons in the same group
            const radioGroup = await page.$$(`input[type="radio"][name="${name}"]`);
            // Select a random radio button from the group
            const randomIndex = Math.floor(Math.random() * radioGroup.length);
            const selectedRadio = radioGroup[randomIndex];
            // Add delay if specified
            if (options?.delay) {
                await page.waitForTimeout(options.delay);
            }
            // Click the selected radio button
            await selectedRadio.click({ force: options?.force });
            // Get the value of the selected radio
            const value = await selectedRadio.getAttribute('value');
            logger_1.logger.info('Radio button selected', {
                selector: element.selector,
                name,
                value,
            });
            return {
                success: true,
                value: value || 'selected',
            };
        }
        catch (error) {
            logger_1.logger.error('Radio button interaction failed', { element, error });
            throw error;
        }
    }
    async validate(element) {
        return element.isEnabled && element.isVisible;
    }
}
exports.RadioStrategy = RadioStrategy;
//# sourceMappingURL=RadioStrategy.js.map