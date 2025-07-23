import { InteractiveElement } from '../../types/elements';
import {
  InteractionStrategy,
  InteractionContext,
  InteractionResult,
} from '../../types/interactions';
import { logger } from '../../utils/logger';

export class MultiSelectStrategy implements InteractionStrategy {
  type = 'multi-select';

  async execute(
    element: InteractiveElement,
    context: InteractionContext
  ): Promise<InteractionResult> {
    const { page, options } = context;

    try {
      const el = await page.$(element.selector);
      if (!el) {
        throw new Error('Element not found');
      }

      // Get available options
      const availableOptions = element.metadata?.options || [];

      // Select multiple random options
      const numToSelect = Math.min(3, Math.max(1, Math.floor(availableOptions.length / 2)));
      const selectedIndices = new Set<number>();

      while (selectedIndices.size < numToSelect && selectedIndices.size < availableOptions.length) {
        selectedIndices.add(Math.floor(Math.random() * availableOptions.length));
      }

      const valuesToSelect = Array.from(selectedIndices).map((i) => availableOptions[i].value);

      if (options?.delay) {
        await page.waitForTimeout(options.delay);
      }

      await el.selectOption(valuesToSelect);

      logger.info('Multi-select options chosen', {
        selector: element.selector,
        values: valuesToSelect,
      });

      return {
        success: true,
        value: valuesToSelect,
      };
    } catch (error) {
      logger.error('Multi-select interaction failed', { element, error });
      throw error;
    }
  }

  async validate(element: InteractiveElement): Promise<boolean> {
    return element.isEnabled && element.isVisible;
  }
}
