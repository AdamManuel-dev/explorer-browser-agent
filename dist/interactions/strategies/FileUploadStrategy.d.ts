import { InteractiveElement } from '../../types/elements';
import { InteractionStrategy, InteractionContext, InteractionResult } from '../../types/interactions';
export declare class FileUploadStrategy implements InteractionStrategy {
    type: string;
    execute(element: InteractiveElement, context: InteractionContext): Promise<InteractionResult>;
    private prepareTestFile;
    validate(element: InteractiveElement): Promise<boolean>;
}
//# sourceMappingURL=FileUploadStrategy.d.ts.map