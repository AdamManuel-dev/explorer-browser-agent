import { Page } from 'playwright';
import { ElementType, ElementDetectionResult } from '../types/elements';
export declare class AIElementDetector {
    private stagehand;
    private selectorPatterns;
    constructor();
    initialize(_page: Page): Promise<void>;
    detectInteractiveElements(page: Page): Promise<ElementDetectionResult>;
    private detectWithAI;
    private detectBySelectors;
    private createElementFromHandle;
    private inferElementType;
    private extractMetadata;
    private classifyElements;
    private classifyWithAI;
    private mergeAndDeduplicate;
    private generateElementKey;
    private initializeSelectorPatterns;
    classifyElementType(element: Element): ElementType;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=AIElementDetector.d.ts.map