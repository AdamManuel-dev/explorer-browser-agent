import { InteractionStrategy } from '../InteractionStrategy.js';
import { InteractionContext, InteractionResult } from '../types.js';

export class ToggleStrategy implements InteractionStrategy {
  async execute(context: InteractionContext): Promise<InteractionResult> {
    const { element } = context;

    try {
      // Basic implementation - just click the toggle
      await element.click();

      return {
        success: true,
        message: 'Toggle clicked successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to interact with toggle: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
