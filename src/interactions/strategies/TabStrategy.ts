import { InteractionStrategy } from '../InteractionStrategy.js';
import { InteractionContext, InteractionResult } from '../types.js';

export class TabStrategy implements InteractionStrategy {
  async execute(context: InteractionContext): Promise<InteractionResult> {
    const { element } = context;

    try {
      // Basic implementation - just click the tab
      await element.click();

      return {
        success: true,
        message: 'Tab clicked successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to interact with tab: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
