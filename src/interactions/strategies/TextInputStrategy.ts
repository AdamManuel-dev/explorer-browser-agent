import { InteractiveElement } from '../../types/elements';
import {
  InteractionStrategy,
  InteractionContext,
  InteractionResult,
} from '../../types/interactions';
import { logger } from '../../utils/logger';

export class TextInputStrategy implements InteractionStrategy {
  type = 'text-input';

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

      // Clear existing value
      await el.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');

      // Add delay if specified
      if (options?.delay) {
        await page.waitForTimeout(options.delay);
      }

      // Type the new value
      const value = String(testData?.value || 'test input'); // Convert to string
      await el.type(value, { delay: 50 });

      // Press Tab to trigger any validation
      await page.keyboard.press('Tab');

      logger.info('Text input completed', {
        selector: element.selector,
        value,
      });

      return {
        success: true,
        value,
        timing: Date.now(),
      };
    } catch (error) {
      logger.error('Text input failed', { element, error });
      throw error;
    }
  }

  async validate(element: InteractiveElement): Promise<boolean> {
    return element.isEnabled && element.isVisible;
  }
}
