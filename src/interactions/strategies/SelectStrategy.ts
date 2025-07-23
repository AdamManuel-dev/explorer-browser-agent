import { InteractiveElement } from '../../types/elements';
import { InteractionStrategy, InteractionContext, InteractionResult } from '../../types/interactions';
import { logger } from '../../utils/logger';

export class SelectStrategy implements InteractionStrategy {
  type = 'select';

  async execute(
    element: InteractiveElement,
    context: InteractionContext
  ): Promise<InteractionResult> {
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
      let valueToSelect: string;
      if (testData?.value) {
        valueToSelect = testData.value;
      } else if (availableOptions.length > 0) {
        // Select a random option (skip first if it's a placeholder)
        const startIndex = availableOptions[0]?.value === '' ? 1 : 0;
        const randomIndex = Math.floor(Math.random() * (availableOptions.length - startIndex)) + startIndex;
        valueToSelect = availableOptions[randomIndex].value;
      } else {
        throw new Error('No options available to select');
      }

      // Add delay if specified
      if (options?.delay) {
        await page.waitForTimeout(options.delay);
      }

      // Select the value
      await el.selectOption(valueToSelect);

      logger.info('Select option chosen', {
        selector: element.selector,
        value: valueToSelect,
      });

      return {
        success: true,
        value: valueToSelect,
      };
    } catch (error) {
      logger.error('Select interaction failed', { element, error });
      throw error;
    }
  }

  async validate(element: InteractiveElement): Promise<boolean> {
    return element.isEnabled && element.isVisible;
  }
}