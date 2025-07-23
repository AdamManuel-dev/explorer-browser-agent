import { InteractionStrategy } from '../InteractionStrategy';
import { InteractionContext, InteractionResult } from '../types';

export class DragDropStrategy implements InteractionStrategy {
  async execute(context: InteractionContext): Promise<InteractionResult> {
    const { element } = context;

    try {
      // Basic implementation - just click the drag/drop element
      await element.click();

      return {
        success: true,
        message: 'Drag/drop element clicked successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to interact with drag/drop element: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}