import { InteractiveElement } from '../../types/elements';
import { InteractionStrategy, InteractionContext, InteractionResult } from '../../types/interactions';
export declare class DefaultStrategy implements InteractionStrategy {
    type: string;
    execute(element: InteractiveElement, context: InteractionContext): Promise<InteractionResult>;
    validate(element: InteractiveElement): Promise<boolean>;
}
//# sourceMappingURL=DefaultStrategy.d.ts.map