import type { TestFile } from '../types/generation';
import type { ValidationError, ValidationWarning } from '../types/generation';
interface ImportInfo {
    module: string;
    named: string[];
    default: string;
    line: number;
}
interface TestInfo {
    name: string;
    startLine: number;
    endLine: number;
    assertions: AssertionInfo[];
    selectors: SelectorInfo[];
}
interface SelectorInfo {
    selector: string;
    line: number;
    testName: string;
    type: string;
}
interface AssertionInfo {
    type: string;
    line: number;
    content: string;
    testName: string;
}
export interface ParsedTestContent {
    imports: ImportInfo[];
    tests: TestInfo[];
    selectors: SelectorInfo[];
    assertions: AssertionInfo[];
    totalLines: number;
    describe: TestInfo[];
    hooks: string[];
}
export declare class PlaywrightBestPracticesRule {
    validate(_testFile: TestFile, parsed: ParsedTestContent): Promise<{
        errors: ValidationError[];
        warnings: ValidationWarning[];
    }>;
    private getTestContent;
}
export declare class SelectorStabilityRule {
    validate(_testFile: TestFile, parsed: ParsedTestContent): Promise<{
        errors: ValidationError[];
        warnings: ValidationWarning[];
    }>;
}
export declare class AssertionQualityRule {
    validate(_testFile: TestFile, parsed: ParsedTestContent): Promise<{
        errors: ValidationError[];
        warnings: ValidationWarning[];
    }>;
}
export declare class TestStructureRule {
    validate(_testFile: TestFile, parsed: ParsedTestContent): Promise<{
        errors: ValidationError[];
        warnings: ValidationWarning[];
    }>;
}
export {};
//# sourceMappingURL=ValidationRules.d.ts.map