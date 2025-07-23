import { TestFile, ValidationResult } from '../types/generation';
import { UserPath } from '../types/recording';
export interface TestReportConfig {
    outputDir: string;
    format: ('html' | 'json' | 'xml' | 'markdown')[];
    includeMetrics: boolean;
    includeScreenshots: boolean;
    includeCoverage: boolean;
    includeValidation: boolean;
    customReportName?: string;
}
export interface TestSuiteReport {
    metadata: ReportMetadata;
    summary: TestSuiteSummary;
    testFiles: TestFileReport[];
    validation: ValidationSummary;
    coverage: CoverageSummary;
    performance: PerformanceSummary;
    screenshots: ScreenshotSummary;
    recommendations: string[];
}
export interface ReportMetadata {
    generatedAt: Date;
    reportVersion: string;
    framework: string;
    totalExecutionTime: number;
    environment: {
        nodeVersion: string;
        platform: string;
        userAgent: string;
    };
}
export interface TestSuiteSummary {
    totalFiles: number;
    totalTests: number;
    totalAssertions: number;
    averageTestLength: number;
    complexityScore: number;
    maintainabilityIndex: number;
    qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
}
export interface TestFileReport {
    filename: string;
    path: string;
    framework: string;
    language: string;
    metadata: {
        generatedAt: Date;
        linesOfCode: number;
        testsCount: number;
        assertionsCount: number;
        sourcePath?: string;
    };
    validation: ValidationResult;
    metrics: {
        complexity: number;
        maintainability: number;
        testCoverage: number;
        duplicateSelectors: string[];
        unusedImports: string[];
    };
    content?: string;
}
export interface ValidationSummary {
    totalErrors: number;
    totalWarnings: number;
    errorsByType: Record<string, number>;
    warningsByType: Record<string, number>;
    topIssues: Array<{
        type: string;
        message: string;
        count: number;
        severity: 'error' | 'warning';
    }>;
}
export interface CoverageSummary {
    elementCoverage: {
        total: number;
        covered: number;
        percentage: number;
        uncoveredElements: string[];
    };
    interactionCoverage: {
        total: number;
        covered: number;
        percentage: number;
        uncoveredInteractions: string[];
    };
    pageCoverage: {
        total: number;
        covered: number;
        percentage: number;
        uncoveredPages: string[];
    };
}
export interface PerformanceSummary {
    averageGenerationTime: number;
    totalGenerationTime: number;
    slowestTest: {
        name: string;
        generationTime: number;
    };
    fastestTest: {
        name: string;
        generationTime: number;
    };
    memoryUsage: {
        peak: number;
        average: number;
    };
}
export interface ScreenshotSummary {
    totalScreenshots: number;
    totalSize: number;
    averageSize: number;
    screenshots: Array<{
        filename: string;
        size: number;
        timestamp: Date;
        testFile: string;
    }>;
}
export declare class TestReporter {
    private config;
    private reportData;
    constructor(config?: Partial<TestReportConfig>);
    generateReport(testFiles: TestFile[], userPaths: UserPath[], validationResults: ValidationResult[]): Promise<TestSuiteReport>;
    generateFileReport(testFile: TestFile, validationResult: ValidationResult): Promise<TestFileReport>;
    exportToHtml(report: TestSuiteReport): Promise<string>;
    exportToJson(report: TestSuiteReport): Promise<string>;
    exportToMarkdown(report: TestSuiteReport): Promise<string>;
    exportToXml(report: TestSuiteReport): Promise<string>;
    private saveReports;
    private generateMetadata;
    private generateSummary;
    private generateTestFileReports;
    private generateValidationSummary;
    private generateCoverageSummary;
    private generatePerformanceSummary;
    private generateScreenshotSummary;
    private generateRecommendations;
    private generateHtmlTemplate;
    private generateMarkdownReport;
    private generateXmlReport;
    private calculateQualityGrade;
    private calculateTestCoverage;
    private countTests;
    private countAssertions;
    private extractSelectors;
    private getReportFileName;
    private mergeWithDefaults;
}
//# sourceMappingURL=TestReporter.d.ts.map