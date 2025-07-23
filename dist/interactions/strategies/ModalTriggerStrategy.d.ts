import { InteractionStrategy } from '../InteractionStrategy.js';
import { InteractionContext, InteractionResult } from '../types.js';
export declare class ModalTriggerStrategy implements InteractionStrategy {
    type: string;
    execute(context: InteractionContext): Promise<InteractionResult>;
}
//# sourceMappingURL=ModalTriggerStrategy.d.ts.map