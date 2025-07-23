import {
  InteractionStrategy,
  InteractionContext,
  InteractionResult,
} from '../../types/interactions';
import { InteractiveElement } from '../../types/elements';

export class TimePickerStrategy implements InteractionStrategy {
  type = 'time-picker';

  async execute(
    element: InteractiveElement,
    context: InteractionContext
  ): Promise<InteractionResult> {
    const { page } = context;
    const startTime = Date.now();

    try {
      // Basic implementation - just click the time picker
      const el = await page.$(element.selector);
      if (!el) {
        throw new Error('Time picker element not found');
      }

      await el.click();

      return {
        success: true,
        value: 'Time picker clicked successfully',
        timing: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to interact with time picker: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timing: Date.now() - startTime,
      };
    }
  }
}
