import { InteractionStrategy } from '../InteractionStrategy.js';
import { InteractionContext, InteractionResult } from '../types.js';
export declare class ToggleStrategy implements InteractionStrategy {
    type: string;
    execute(context: InteractionContext): Promise<InteractionResult>;
}
//# sourceMappingURL=ToggleStrategy.d.ts.map