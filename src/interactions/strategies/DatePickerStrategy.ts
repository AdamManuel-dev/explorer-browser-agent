import { InteractionStrategy } from '../InteractionStrategy';
import { InteractionContext, InteractionResult } from '../types';

export class DatePickerStrategy implements InteractionStrategy {
  async execute(context: InteractionContext): Promise<InteractionResult> {
    const { element } = context;

    try {
      // Basic implementation - just click the date picker
      await element.click();

      return {
        success: true,
        message: 'Date picker clicked successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to interact with date picker: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}