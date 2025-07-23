import { InteractiveElement } from '../../types/elements';
import {
  InteractionStrategy,
  InteractionContext,
  InteractionResult,
} from '../../types/interactions';

export class AudioPlayerStrategy implements InteractionStrategy {
  type = 'audio-player';

  async execute(
    element: InteractiveElement,
    context: InteractionContext
  ): Promise<InteractionResult> {
    const { page } = context;
    const startTime = Date.now();

    try {
      // Locate the element
      const el = await page.$(element.selector);
      if (!el) {
        throw new Error('Element not found');
      }

      // Click the audio player (play/pause)
      await el.click();

      return {
        success: true,
        value: 'clicked',
        timing: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timing: Date.now() - startTime,
      };
    }
  }

  async validate(element: InteractiveElement): Promise<boolean> {
    return element.isEnabled && element.isVisible;
  }
}
