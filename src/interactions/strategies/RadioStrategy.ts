import { InteractiveElement } from '../../types/elements';
import {
  InteractionStrategy,
  InteractionContext,
  InteractionResult,
} from '../../types/interactions';
import { logger } from '../../utils/logger';

export class RadioStrategy implements InteractionStrategy {
  type = 'radio';

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

      // Get the name attribute to find related radio buttons
      const name = await el.getAttribute('name');
      if (!name) {
        // If no name, just click this radio button
        await el.click({ force: options?.force });
        return {
          success: true,
          value: (await el.getAttribute('value')) || 'selected',
          timing: Date.now(),
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

      logger.info('Radio button selected', {
        selector: element.selector,
        name,
        value,
      });

      return {
        success: true,
        value: value || 'selected',
        timing: Date.now(),
      };
    } catch (error) {
      logger.error('Radio button interaction failed', { element, error });
      throw error;
    }
  }

  async validate(element: InteractiveElement): Promise<boolean> {
    return element.isEnabled && element.isVisible;
  }
}
