import { InteractiveElement } from '../../types/elements';
import {
  InteractionStrategy,
  InteractionContext,
  InteractionResult,
} from '../../types/interactions';
import { logger } from '../../utils/logger';

export class LinkStrategy implements InteractionStrategy {
  type = 'link';

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

      // Get href attribute
      const href = await el.getAttribute('href');

      // Scroll into view if needed
      await el.scrollIntoViewIfNeeded();

      // Add delay if specified
      if (options?.delay) {
        await page.waitForTimeout(options.delay);
      }

      // Prepare for navigation
      const navigationPromise = page
        .waitForNavigation({
          timeout: options?.timeout || 30000,
          waitUntil: 'networkidle',
        })
        .catch(() => null); // Some links might not navigate

      // Click the link
      await el.click({ force: options?.force });

      // Wait for navigation
      await navigationPromise;

      logger.info('Link clicked', {
        selector: element.selector,
        text: element.text,
        href,
      });

      return {
        success: true,
        value: href || 'clicked',
      };
    } catch (error) {
      logger.error('Link click failed', { element, error });
      throw error;
    }
  }

  async validate(element: InteractiveElement): Promise<boolean> {
    return element.isEnabled && element.isVisible;
  }
}
