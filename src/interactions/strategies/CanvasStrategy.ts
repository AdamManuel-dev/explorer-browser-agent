import { InteractionStrategy } from '../InteractionStrategy';
import { InteractionContext, InteractionResult } from '../types';

export class CanvasStrategy implements InteractionStrategy {
  async execute(context: InteractionContext): Promise<InteractionResult> {
    const { element } = context;

    try {
      // Basic implementation - just click the canvas
      await element.click();

      return {
        success: true,
        message: 'Canvas clicked successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to interact with canvas: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}