import { InteractionStrategy } from '../InteractionStrategy.js';
import { InteractionContext, InteractionResult } from '../types.js';

export class AccordionStrategy implements InteractionStrategy {
  async execute(context: InteractionContext): Promise<InteractionResult> {
    const { element } = context;

    try {
      // Basic implementation - just click the accordion
      await element.click();

      return {
        success: true,
        message: 'Accordion clicked successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to interact with accordion: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
