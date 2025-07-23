import { InteractiveElement } from '../../types/elements';
import {
  InteractionStrategy,
  InteractionContext,
  InteractionResult,
} from '../../types/interactions';
import { logger } from '../../utils/logger';

export class DefaultStrategy implements InteractionStrategy {
  type = 'default';

  async execute(
    element: InteractiveElement,
    context: InteractionContext
  ): Promise<InteractionResult> {
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

      logger.info('Default interaction executed', {
        selector: element.selector,
        tagName,
        role,
      });

      return {
        success: true,
        value: 'interacted',
      };
    } catch (error) {
      logger.error('Default interaction failed', { element, error });
      throw error;
    }
  }

  async validate(element: InteractiveElement): Promise<boolean> {
    // For unknown elements, we just check visibility
    return element.isVisible;
  }
}
