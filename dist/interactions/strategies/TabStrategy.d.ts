import { InteractionStrategy } from '../InteractionStrategy.js';
import { InteractionContext, InteractionResult } from '../types.js';
export declare class TabStrategy implements InteractionStrategy {
    type: string;
    execute(context: InteractionContext): Promise<InteractionResult>;
}
//# sourceMappingURL=TabStrategy.d.ts.map