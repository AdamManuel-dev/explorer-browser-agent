import { InteractiveElement } from '../../types/elements';
import { InteractionStrategy, InteractionContext, InteractionResult } from '../../types/interactions';
export declare class ButtonStrategy implements InteractionStrategy {
    type: string;
    canHandle(element: InteractiveElement): boolean;
    execute(element: InteractiveElement, context: InteractionContext): Promise<InteractionResult>;
    validate(element: InteractiveElement): Promise<boolean>;
}
//# sourceMappingURL=ButtonStrategy.d.ts.map