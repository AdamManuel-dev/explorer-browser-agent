import { InteractionStrategy } from '../InteractionStrategy.js';
import { InteractionContext, InteractionResult } from '../types.js';
export declare class DragDropStrategy implements InteractionStrategy {
    type: string;
    execute(context: InteractionContext): Promise<InteractionResult>;
}
//# sourceMappingURL=DragDropStrategy.d.ts.map