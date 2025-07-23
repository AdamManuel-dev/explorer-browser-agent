import { InteractionStrategy } from '../InteractionStrategy';
import { InteractionContext, InteractionResult } from '../types';

export class ModalTriggerStrategy implements InteractionStrategy {
  async execute(context: InteractionContext): Promise<InteractionResult> {
    const { element } = context;

    try {
      // Basic implementation - just click the modal trigger
      await element.click();

      return {
        success: true,
        message: 'Modal trigger clicked successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to interact with modal trigger: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}