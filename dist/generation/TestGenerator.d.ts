import { UserPath } from '../types/recording';
import { GenerationOptions, GenerationResult } from '../types/generation';
export declare class TestGenerator {
    private options;
    private optimizer;
    private formatting;
    constructor(options: GenerationOptions);
    generate(userPath: UserPath): Promise<GenerationResult>;
    private generateTestFile;
    private buildTestStructure;
    private buildImports;
    private buildSetupCode;
    private buildTestCases;
    private convertStepsToTestSteps;
    private generateStepCode;
    private generatePlaywrightStep;
    private generateCypressStep;
    private generatePuppeteerStep;
    private convertAssertions;
    private renderTestFile;
    private generateAssertionCode;
    private generatePlaywrightAssertion;
    private generateCypressAssertion;
    private generateTestFileName;
    private generateSuiteName;
    private generateTestName;
    private generateTestDescription;
    private getPageName;
    private generatePageObjects;
    private generateFixtures;
    private generateHelpers;
    private calculateSummary;
    private getRequiredDependencies;
}
//# sourceMappingURL=TestGenerator.d.ts.map