import { InteractionStrategy } from '../InteractionStrategy.js';
import { InteractionContext, InteractionResult } from '../types.js';

export class DragDropStrategy implements InteractionStrategy {
  type = 'drag-drop';

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
