import { InteractionStrategy } from '../InteractionStrategy.js';
import { InteractionContext, InteractionResult } from '../types.js';

export class DropdownMenuStrategy implements InteractionStrategy {
  type = 'dropdown-menu';

  async execute(context: InteractionContext): Promise<InteractionResult> {
    const { element } = context;

    try {
      // Basic implementation - just click the dropdown menu
      await element.click();

      return {
        success: true,
        message: 'Dropdown menu clicked successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to interact with dropdown menu: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
