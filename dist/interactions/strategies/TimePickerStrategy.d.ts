import { InteractionStrategy, InteractionContext, InteractionResult } from '../../types/interactions';
import { InteractiveElement } from '../../types/elements';
export declare class TimePickerStrategy implements InteractionStrategy {
    type: string;
    execute(element: InteractiveElement, context: InteractionContext): Promise<InteractionResult>;
}
//# sourceMappingURL=TimePickerStrategy.d.ts.map