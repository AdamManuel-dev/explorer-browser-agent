import type { TestFile } from '../types/generation';
export interface ValidationRule {
    name: string;
    description: string;
    validate(content: ParsedTestContent): ValidationResult;
}
export interface ValidationError {
    rule: string;
    message: string;
    line?: number;
    severity: 'error' | 'warning';
}
export interface ValidationWarning {
    rule: string;
    message: string;
    line?: number;
    fix?: string;
}
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    score: number;
}
export interface ParsedTestContent {
    imports: string[];
    describe: TestInfo[];
    hooks: string[];
    tests: Array<{
        name: string;
        content: string;
        assertions: string[];
    }>;
    selectors: string[];
}
export interface TestInfo {
    name: string;
    content: string;
    assertions: string[];
}
export declare class PlaywrightBestPracticesRule implements ValidationRule {
    validate(_testFile: TestFile, parsed: ParsedTestContent): Promise<{
        errors: ValidationError[];
        warnings: ValidationWarning[];
    }>;
    private getTestContent;
}
export declare class SelectorStabilityRule implements ValidationRule {
    validate(_testFile: TestFile, parsed: ParsedTestContent): Promise<{
        errors: ValidationError[];
        warnings: ValidationWarning[];
    }>;
}
export declare class AssertionQualityRule implements ValidationRule {
    validate(_testFile: TestFile, parsed: ParsedTestContent): Promise<{
        errors: ValidationError[];
        warnings: ValidationWarning[];
    }>;
}
export declare class TestStructureRule implements ValidationRule {
    validate(_testFile: TestFile, parsed: ParsedTestContent): Promise<{
        errors: ValidationError[];
        warnings: ValidationWarning[];
    }>;
}
//# sourceMappingURL=ValidationRules.d.ts.map