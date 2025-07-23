import { InteractionStrategy } from '../InteractionStrategy.js';
import { InteractionContext, InteractionResult } from '../types.js';

export class RichTextEditorStrategy implements InteractionStrategy {
  async execute(context: InteractionContext): Promise<InteractionResult> {
    const { element } = context;

    try {
      // Basic implementation - just click the rich text editor
      await element.click();

      return {
        success: true,
        message: 'Rich text editor clicked successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to interact with rich text editor: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
