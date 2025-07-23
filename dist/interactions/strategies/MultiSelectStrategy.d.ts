import { InteractiveElement } from '../../types/elements';
import { InteractionStrategy, InteractionContext, InteractionResult } from '../../types/interactions';
export declare class MultiSelectStrategy implements InteractionStrategy {
    type: string;
    execute(element: InteractiveElement, context: InteractionContext): Promise<InteractionResult>;
    validate(element: InteractiveElement): Promise<boolean>;
}
//# sourceMappingURL=MultiSelectStrategy.d.ts.map