import { TestFile, TestFramework } from '../types/generation';
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    metrics: ValidationMetrics;
}
export interface ValidationError {
    type: 'syntax' | 'import' | 'selector' | 'assertion' | 'structure';
    message: string;
    line?: number;
    column?: number;
    file?: string;
    severity: 'error' | 'warning';
}
export interface ValidationWarning {
    type: 'best-practice' | 'performance' | 'maintainability';
    message: string;
    line?: number;
    file?: string;
    suggestion?: string;
}
export interface ValidationMetrics {
    totalTests: number;
    totalAssertions: number;
    averageTestLength: number;
    complexityScore: number;
    maintainabilityIndex: number;
    duplicateSelectors: string[];
    unusedImports: string[];
}
export declare class TestValidator {
    private framework;
    private validationRules;
    constructor(framework?: TestFramework);
    validateTestFile(testFile: TestFile): Promise<ValidationResult>;
    validateTestSuite(testFiles: TestFile[]): Promise<ValidationResult>;
    validateGeneratedCode(code: string, filename: string): Promise<ValidationResult>;
    private parseTestContent;
    private validateSyntax;
    private validateImports;
    private validateSelectors;
    private validateAssertions;
    private validateSuiteStructure;
    private calculateMetrics;
    private aggregateMetrics;
    private initializeValidationRules;
    private parseImport;
    private extractTestName;
    private classifySelector;
    private classifyAssertion;
    private shouldHaveSemicolon;
    private isMultiLineStatement;
    private isInAsyncFunction;
    private getRequiredImports;
    private isImportUsed;
    private isFragileSelector;
    private isWeakAssertion;
    private checkNamingConsistency;
    private calculateComplexityScore;
    private calculateMaintainabilityIndex;
    private getDefaultMetrics;
}
//# sourceMappingURL=TestValidator.d.ts.map