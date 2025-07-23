import { InteractionStrategy, InteractionContext, InteractionResult } from '../../types/interactions';
import { InteractiveElement } from '../../types/elements';
export declare class DatePickerStrategy implements InteractionStrategy {
    type: string;
    execute(element: InteractiveElement, context: InteractionContext): Promise<InteractionResult>;
}
//# sourceMappingURL=DatePickerStrategy.d.ts.map