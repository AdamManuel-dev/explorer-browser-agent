import { InteractiveElement } from '../../types/elements';
import {
  InteractionStrategy,
  InteractionContext,
  InteractionResult,
} from '../../types/interactions';
import { logger } from '../../utils/logger';

export class ButtonStrategy implements InteractionStrategy {
  type = 'button';

  canHandle(element: InteractiveElement): boolean {
    return element.type === 'button';
  }

  async execute(
    element: InteractiveElement,
    context: InteractionContext
  ): Promise<InteractionResult> {
    const { page, options } = context;
    const startTime = Date.now();

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

      logger.info('Button clicked', {
        selector: element.selector,
        text: element.text,
      });

      return {
        success: true,
        value: 'clicked',
        timing: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('Button click failed', { element, error });
      throw error;
    }
  }

  async validate(element: InteractiveElement): Promise<boolean> {
    return element.isEnabled && element.isVisible;
  }
}
