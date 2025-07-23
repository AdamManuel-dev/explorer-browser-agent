import { InteractiveElement } from '../types/elements';
import { TestData } from '../types/interactions';
export declare class TestDataGenerator {
    private generators;
    constructor();
    generateForElement(element: InteractiveElement): Promise<TestData>;
    private detectInputType;
    private initializeGenerators;
    private generateSecurePassword;
    generateMultipleValues(count: number, type: string): Array<string | number | boolean>;
    generateOptionsSelection(options: Array<{
        value: string;
        text: string;
    }>): string;
    generateMultipleOptionsSelection(options: Array<{
        value: string;
        text: string;
    }>, min?: number, max?: number): string[];
}
//# sourceMappingURL=TestDataGenerator.d.ts.map