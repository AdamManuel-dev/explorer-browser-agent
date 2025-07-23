import { InteractionStrategy, InteractionContext, InteractionResult } from '../../types/interactions';
import { InteractiveElement } from '../../types/elements';
export declare class ColorPickerStrategy implements InteractionStrategy {
    type: string;
    execute(element: InteractiveElement, context: InteractionContext): Promise<InteractionResult>;
}
//# sourceMappingURL=ColorPickerStrategy.d.ts.map