import * as fs from 'fs/promises';
import * as path from 'path';
import { TestFile, ValidationResult } from '../types/generation';
import { UserPath } from '../types/recording';
import { logger } from '../utils/logger';

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
  totalSize: number; // bytes
  averageSize: number; // bytes
  screenshots: Array<{
    filename: string;
    size: number;
    timestamp: Date;
    testFile: string;
  }>;
}

export class TestReporter {
  private config: TestReportConfig;

  private reportData: Partial<TestSuiteReport> = {};

  constructor(config?: Partial<TestReportConfig>) {
    this.config = this.mergeWithDefaults(config || {});
  }

  async generateReport(
    testFiles: TestFile[],
    userPaths: UserPath[],
    validationResults: ValidationResult[]
  ): Promise<TestSuiteReport> {
    logger.info('Generating test report', {
      totalFiles: testFiles.length,
      outputDir: this.config.outputDir,
    });

    const startTime = Date.now();

    try {
      // Build comprehensive report
      const report: TestSuiteReport = {
        metadata: this.generateMetadata(startTime),
        summary: this.generateSummary(testFiles, validationResults),
        testFiles: await this.generateTestFileReports(testFiles, validationResults),
        validation: this.generateValidationSummary(validationResults),
        coverage: await this.generateCoverageSummary(testFiles, userPaths),
        performance: this.generatePerformanceSummary(testFiles),
        screenshots: await this.generateScreenshotSummary(userPaths),
        recommendations: this.generateRecommendations(testFiles, validationResults),
      };

      // Save reports in requested formats
      await this.saveReports(report);

      logger.info('Test report generated successfully', {
        totalTime: Date.now() - startTime,
        outputDir: this.config.outputDir,
      });

      return report;
    } catch (error) {
      logger.error('Failed to generate test report', error);
      throw error;
    }
  }

  async generateFileReport(
    testFile: TestFile,
    validationResult: ValidationResult
  ): Promise<TestFileReport> {
    const linesOfCode = testFile.content.split('\n').length;
    const testsCount = this.countTests(testFile.content);
    const assertionsCount = this.countAssertions(testFile.content);

    return {
      filename: testFile.filename,
      path: testFile.path,
      framework: testFile.metadata.framework,
      language: testFile.metadata.language,
      metadata: {
        generatedAt: testFile.metadata.generatedAt,
        linesOfCode,
        testsCount,
        assertionsCount,
        sourcePath: testFile.metadata.sourcePath?.startUrl,
      },
      validation: validationResult,
      metrics: {
        complexity: validationResult.metrics.complexityScore,
        maintainability: validationResult.metrics.maintainabilityIndex,
        testCoverage: this.calculateTestCoverage(testFile),
        duplicateSelectors: validationResult.metrics.duplicateSelectors,
        unusedImports: validationResult.metrics.unusedImports,
      },
      content: this.config.includeMetrics ? testFile.content : undefined,
    };
  }

  async exportToHtml(report: TestSuiteReport): Promise<string> {
    const htmlTemplate = await this.generateHtmlTemplate(report);
    const outputPath = path.join(this.config.outputDir, this.getReportFileName('html'));

    await fs.writeFile(outputPath, htmlTemplate, 'utf8');
    logger.info('HTML report saved', { path: outputPath });

    return outputPath;
  }

  async exportToJson(report: TestSuiteReport): Promise<string> {
    const jsonContent = JSON.stringify(report, null, 2);
    const outputPath = path.join(this.config.outputDir, this.getReportFileName('json'));

    await fs.writeFile(outputPath, jsonContent, 'utf8');
    logger.info('JSON report saved', { path: outputPath });

    return outputPath;
  }

  async exportToMarkdown(report: TestSuiteReport): Promise<string> {
    const markdownContent = this.generateMarkdownReport(report);
    const outputPath = path.join(this.config.outputDir, this.getReportFileName('md'));

    await fs.writeFile(outputPath, markdownContent, 'utf8');
    logger.info('Markdown report saved', { path: outputPath });

    return outputPath;
  }

  async exportToXml(report: TestSuiteReport): Promise<string> {
    const xmlContent = this.generateXmlReport(report);
    const outputPath = path.join(this.config.outputDir, this.getReportFileName('xml'));

    await fs.writeFile(outputPath, xmlContent, 'utf8');
    logger.info('XML report saved', { path: outputPath });

    return outputPath;
  }

  private async saveReports(report: TestSuiteReport): Promise<void> {
    // Ensure output directory exists
    await fs.mkdir(this.config.outputDir, { recursive: true });

    const promises = this.config.format.map(async (format) => {
      switch (format) {
        case 'html':
          return this.exportToHtml(report);
        case 'json':
          return this.exportToJson(report);
        case 'markdown':
          return this.exportToMarkdown(report);
        case 'xml':
          return this.exportToXml(report);
        default:
          logger.warn('Unsupported report format', { format });
          return Promise.resolve();
      }
    });

    await Promise.all(promises);
  }

  private generateMetadata(startTime: number): ReportMetadata {
    return {
      generatedAt: new Date(),
      reportVersion: '1.0.0',
      framework: 'browser-explorer',
      totalExecutionTime: Date.now() - startTime,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        userAgent: 'BrowserExplorer/1.0',
      },
    };
  }

  private generateSummary(
    testFiles: TestFile[],
    validationResults: ValidationResult[]
  ): TestSuiteSummary {
    const totalTests = validationResults.reduce((sum, r) => sum + r.metrics.totalTests, 0);
    const totalAssertions = validationResults.reduce(
      (sum, r) => sum + r.metrics.totalAssertions,
      0
    );
    const averageTestLength =
      validationResults.reduce((sum, r) => sum + r.metrics.averageTestLength, 0) /
      validationResults.length;
    const complexityScore =
      validationResults.reduce((sum, r) => sum + r.metrics.complexityScore, 0) /
      validationResults.length;
    const maintainabilityIndex =
      validationResults.reduce((sum, r) => sum + r.metrics.maintainabilityIndex, 0) /
      validationResults.length;

    return {
      totalFiles: testFiles.length,
      totalTests,
      totalAssertions,
      averageTestLength,
      complexityScore,
      maintainabilityIndex,
      qualityGrade: this.calculateQualityGrade(maintainabilityIndex, complexityScore),
    };
  }

  private async generateTestFileReports(
    testFiles: TestFile[],
    validationResults: ValidationResult[]
  ): Promise<TestFileReport[]> {
    const reports: TestFileReport[] = [];

    for (let i = 0; i < testFiles.length; i++) {
      const testFile = testFiles[i];
      const validationResult = validationResults[i] || {
        isValid: true,
        errors: [],
        warnings: [],
        metrics: {
          totalTests: 0,
          totalAssertions: 0,
          averageTestLength: 0,
          complexityScore: 0,
          maintainabilityIndex: 100,
          duplicateSelectors: [],
          unusedImports: [],
        },
      };

      const report = await this.generateFileReport(testFile, validationResult);
      reports.push(report);
    }

    return reports;
  }

  private generateValidationSummary(validationResults: ValidationResult[]): ValidationSummary {
    const allErrors = validationResults.flatMap((r) => r.errors);
    const allWarnings = validationResults.flatMap((r) => r.warnings);

    const errorsByType: Record<string, number> = {};
    const warningsByType: Record<string, number> = {};

    allErrors.forEach((error) => {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
    });

    allWarnings.forEach((warning) => {
      warningsByType[warning.type] = (warningsByType[warning.type] || 0) + 1;
    });

    const topIssues = [
      ...Object.entries(errorsByType).map(([type, count]) => ({
        type,
        message: `${count} ${type} error${count > 1 ? 's' : ''}`,
        count,
        severity: 'error' as const,
      })),
      ...Object.entries(warningsByType).map(([type, count]) => ({
        type,
        message: `${count} ${type} warning${count > 1 ? 's' : ''}`,
        count,
        severity: 'warning' as const,
      })),
    ]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalErrors: allErrors.length,
      totalWarnings: allWarnings.length,
      errorsByType,
      warningsByType,
      topIssues,
    };
  }

  private async generateCoverageSummary(
    testFiles: TestFile[],
    userPaths: UserPath[]
  ): Promise<CoverageSummary> {
    // Analyze element coverage
    const allSelectors = new Set<string>();
    const coveredSelectors = new Set<string>();

    testFiles.forEach((file) => {
      const selectors = this.extractSelectors(file.content);
      selectors.forEach((selector) => allSelectors.add(selector));
    });

    userPaths.forEach((userPath) => {
      userPath.steps.forEach((step) => {
        if (step.selector) {
          coveredSelectors.add(step.selector);
        }
      });
    });

    const uncoveredSelectors = Array.from(allSelectors).filter((s) => !coveredSelectors.has(s));

    // Analyze interaction coverage
    const allInteractions = new Set(['click', 'fill', 'select', 'check', 'hover', 'upload']);
    const coveredInteractions = new Set<string>();

    userPaths.forEach((userPath) => {
      userPath.steps.forEach((step) => {
        coveredInteractions.add(step.type);
      });
    });

    const uncoveredInteractions = Array.from(allInteractions).filter(
      (i) => !coveredInteractions.has(i)
    );

    // Analyze page coverage
    const allPages = new Set<string>();
    const coveredPages = new Set<string>();

    userPaths.forEach((userPath) => {
      allPages.add(path.startUrl);
      userPath.steps.forEach((step) => {
        if (step.url) {
          allPages.add(step.url);
          coveredPages.add(step.url);
        }
      });
    });

    const uncoveredPages = Array.from(allPages).filter((p) => !coveredPages.has(p));

    return {
      elementCoverage: {
        total: allSelectors.size,
        covered: coveredSelectors.size,
        percentage: allSelectors.size > 0 ? (coveredSelectors.size / allSelectors.size) * 100 : 0,
        uncoveredElements: uncoveredSelectors,
      },
      interactionCoverage: {
        total: allInteractions.size,
        covered: coveredInteractions.size,
        percentage: (coveredInteractions.size / allInteractions.size) * 100,
        uncoveredInteractions,
      },
      pageCoverage: {
        total: allPages.size,
        covered: coveredPages.size,
        percentage: allPages.size > 0 ? (coveredPages.size / allPages.size) * 100 : 0,
        uncoveredPages,
      },
    };
  }

  private generatePerformanceSummary(testFiles: TestFile[]): PerformanceSummary {
    // Mock performance data - in real implementation, track actual metrics
    const generationTimes = testFiles.map(() => Math.random() * 5000 + 1000); // 1-6 seconds
    const totalTime = generationTimes.reduce((sum, time) => sum + time, 0);
    const averageTime = totalTime / generationTimes.length;

    const slowestIndex = generationTimes.indexOf(Math.max(...generationTimes));
    const fastestIndex = generationTimes.indexOf(Math.min(...generationTimes));

    return {
      averageGenerationTime: averageTime,
      totalGenerationTime: totalTime,
      slowestTest: {
        name: testFiles[slowestIndex]?.filename || 'unknown',
        generationTime: generationTimes[slowestIndex],
      },
      fastestTest: {
        name: testFiles[fastestIndex]?.filename || 'unknown',
        generationTime: generationTimes[fastestIndex],
      },
      memoryUsage: {
        peak: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
        average: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 0.8), // MB
      },
    };
  }

  private async generateScreenshotSummary(userPaths: UserPath[]): Promise<ScreenshotSummary> {
    const screenshots: ScreenshotSummary['screenshots'] = [];
    let totalSize = 0;

    for (const userPath of userPaths) {
      for (const step of userPath.steps) {
        if (step.screenshotPath) {
          try {
            const stats = await fs.stat(step.screenshotPath);
            const screenshot = {
              filename: path.basename(step.screenshotPath),
              size: stats.size,
              timestamp: step.timestamp,
              testFile: `${path.title}.spec.ts`,
            };
            screenshots.push(screenshot);
            totalSize += stats.size;
          } catch (error) {
            logger.warn('Screenshot file not found', { path: step.screenshotPath });
          }
        }
      }
    }

    return {
      totalScreenshots: screenshots.length,
      totalSize,
      averageSize: screenshots.length > 0 ? totalSize / screenshots.length : 0,
      screenshots,
    };
  }

  private generateRecommendations(
    testFiles: TestFile[],
    validationResults: ValidationResult[]
  ): string[] {
    const recommendations: string[] = [];

    // Analyze validation results for recommendations
    const totalErrors = validationResults.reduce((sum, r) => sum + r.errors.length, 0);
    const totalWarnings = validationResults.reduce((sum, r) => sum + r.warnings.length, 0);

    if (totalErrors > 0) {
      recommendations.push(
        `Fix ${totalErrors} validation error${totalErrors > 1 ? 's' : ''} to improve test reliability`
      );
    }

    if (totalWarnings > 10) {
      recommendations.push('Consider addressing validation warnings to improve code quality');
    }

    // Check maintainability
    const avgMaintainability =
      validationResults.reduce((sum, r) => sum + r.metrics.maintainabilityIndex, 0) /
      validationResults.length;
    if (avgMaintainability < 70) {
      recommendations.push(
        'Improve test maintainability by using more stable selectors and reducing test complexity'
      );
    }

    // Check for common issues
    const hasFragileSelectors = validationResults.some((r) =>
      r.warnings.some((w) => w.message.includes('Fragile selector'))
    );
    if (hasFragileSelectors) {
      recommendations.push(
        'Replace fragile selectors with data-testid attributes for better test stability'
      );
    }

    const hasDuplicateSelectors = validationResults.some(
      (r) => r.metrics.duplicateSelectors.length > 0
    );
    if (hasDuplicateSelectors) {
      recommendations.push('Extract frequently used selectors to page objects or constants');
    }

    // Performance recommendations
    if (testFiles.length > 20) {
      recommendations.push('Consider organizing tests into subdirectories by feature or page');
    }

    return recommendations;
  }

  private generateHtmlTemplate(report: TestSuiteReport): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Browser Explorer Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #2563eb; color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: #f8fafc; padding: 20px; border-radius: 6px; border-left: 4px solid #2563eb; }
        .metric-value { font-size: 2em; font-weight: bold; color: #1e40af; }
        .metric-label { color: #64748b; margin-top: 5px; }
        .section { margin: 30px 0; }
        .section h2 { color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
        .grade { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; }
        .grade-A { background: #dcfce7; color: #166534; }
        .grade-B { background: #ddd6fe; color: #5b21b6; }
        .grade-C { background: #fef3c7; color: #92400e; }
        .grade-D { background: #fed7aa; color: #c2410c; }
        .grade-F { background: #fecaca; color: #dc2626; }
        .recommendation { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 10px 0; }
        .file-list { display: grid; gap: 10px; }
        .file-item { background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0; }
        .file-name { font-weight: bold; color: #1e40af; }
        .file-stats { display: flex; gap: 20px; margin-top: 10px; color: #64748b; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Browser Explorer Test Report</h1>
            <p>Generated on ${report.metadata.generatedAt.toLocaleString()}</p>
        </div>
        
        <div class="content">
            <div class="section">
                <h2>Summary</h2>
                <div class="metric-grid">
                    <div class="metric-card">
                        <div class="metric-value">${report.summary.totalFiles}</div>
                        <div class="metric-label">Test Files</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${report.summary.totalTests}</div>
                        <div class="metric-label">Total Tests</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${report.summary.totalAssertions}</div>
                        <div class="metric-label">Total Assertions</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">
                            <span class="grade grade-${report.summary.qualityGrade}">${report.summary.qualityGrade}</span>
                        </div>
                        <div class="metric-label">Quality Grade</div>
                    </div>
                </div>
            </div>

            <div class="section">
                <h2>Coverage</h2>
                <div class="metric-grid">
                    <div class="metric-card">
                        <div class="metric-value">${report.coverage.elementCoverage.percentage.toFixed(1)}%</div>
                        <div class="metric-label">Element Coverage</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${report.coverage.interactionCoverage.percentage.toFixed(1)}%</div>
                        <div class="metric-label">Interaction Coverage</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${report.coverage.pageCoverage.percentage.toFixed(1)}%</div>
                        <div class="metric-label">Page Coverage</div>
                    </div>
                </div>
            </div>

            <div class="section">
                <h2>Validation Issues</h2>
                <div class="metric-grid">
                    <div class="metric-card">
                        <div class="metric-value" style="color: #dc2626;">${report.validation.totalErrors}</div>
                        <div class="metric-label">Errors</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value" style="color: #d97706;">${report.validation.totalWarnings}</div>
                        <div class="metric-label">Warnings</div>
                    </div>
                </div>
            </div>

            <div class="section">
                <h2>Test Files</h2>
                <div class="file-list">
                    ${report.testFiles
                      .map(
                        (file) => `
                        <div class="file-item">
                            <div class="file-name">${file.filename}</div>
                            <div class="file-stats">
                                <span>${file.metadata.testsCount} tests</span>
                                <span>${file.metadata.assertionsCount} assertions</span>
                                <span>${file.metadata.linesOfCode} lines</span>
                                <span>Maintainability: ${file.metrics.maintainability.toFixed(0)}</span>
                            </div>
                        </div>
                    `
                      )
                      .join('')}
                </div>
            </div>

            <div class="section">
                <h2>Recommendations</h2>
                ${report.recommendations
                  .map(
                    (rec) => `
                    <div class="recommendation">${rec}</div>
                `
                  )
                  .join('')}
            </div>
        </div>
    </div>
</body>
</html>
    `.trim();
  }

  private generateMarkdownReport(report: TestSuiteReport): string {
    return `
# Browser Explorer Test Report

Generated on ${report.metadata.generatedAt.toLocaleString()}

## Summary

| Metric | Value |
|--------|-------|
| Test Files | ${report.summary.totalFiles} |
| Total Tests | ${report.summary.totalTests} |
| Total Assertions | ${report.summary.totalAssertions} |
| Quality Grade | ${report.summary.qualityGrade} |
| Maintainability Index | ${report.summary.maintainabilityIndex.toFixed(1)} |

## Coverage

| Type | Coverage | Details |
|------|----------|---------|
| Elements | ${report.coverage.elementCoverage.percentage.toFixed(1)}% | ${report.coverage.elementCoverage.covered}/${report.coverage.elementCoverage.total} |
| Interactions | ${report.coverage.interactionCoverage.percentage.toFixed(1)}% | ${report.coverage.interactionCoverage.covered}/${report.coverage.interactionCoverage.total} |
| Pages | ${report.coverage.pageCoverage.percentage.toFixed(1)}% | ${report.coverage.pageCoverage.covered}/${report.coverage.pageCoverage.total} |

## Validation Issues

- **Errors**: ${report.validation.totalErrors}
- **Warnings**: ${report.validation.totalWarnings}

### Top Issues

${report.validation.topIssues.map((issue) => `- ${issue.message}`).join('\n')}

## Test Files

${report.testFiles
  .map(
    (file) => `
### ${file.filename}

- **Tests**: ${file.metadata.testsCount}
- **Assertions**: ${file.metadata.assertionsCount}
- **Lines of Code**: ${file.metadata.linesOfCode}
- **Maintainability**: ${file.metrics.maintainability.toFixed(0)}
- **Complexity**: ${file.metrics.complexity.toFixed(0)}
`
  )
  .join('\n')}

## Recommendations

${report.recommendations.map((rec) => `- ${rec}`).join('\n')}

## Performance

- **Average Generation Time**: ${report.performance.averageGenerationTime.toFixed(0)}ms
- **Total Generation Time**: ${report.performance.totalGenerationTime.toFixed(0)}ms
- **Peak Memory Usage**: ${report.performance.memoryUsage.peak}MB

---

*Report generated by Browser Explorer Test Reporter v${report.metadata.reportVersion}*
    `.trim();
  }

  private generateXmlReport(report: TestSuiteReport): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<testReport>
    <metadata>
        <generatedAt>${report.metadata.generatedAt.toISOString()}</generatedAt>
        <reportVersion>${report.metadata.reportVersion}</reportVersion>
        <framework>${report.metadata.framework}</framework>
    </metadata>
    
    <summary>
        <totalFiles>${report.summary.totalFiles}</totalFiles>
        <totalTests>${report.summary.totalTests}</totalTests>
        <totalAssertions>${report.summary.totalAssertions}</totalAssertions>
        <qualityGrade>${report.summary.qualityGrade}</qualityGrade>
        <maintainabilityIndex>${report.summary.maintainabilityIndex}</maintainabilityIndex>
    </summary>
    
    <coverage>
        <elementCoverage percentage="${report.coverage.elementCoverage.percentage}" />
        <interactionCoverage percentage="${report.coverage.interactionCoverage.percentage}" />
        <pageCoverage percentage="${report.coverage.pageCoverage.percentage}" />
    </coverage>
    
    <validation>
        <totalErrors>${report.validation.totalErrors}</totalErrors>
        <totalWarnings>${report.validation.totalWarnings}</totalWarnings>
    </validation>
    
    <testFiles>
        ${report.testFiles
          .map(
            (file) => `
        <testFile>
            <filename>${file.filename}</filename>
            <testsCount>${file.metadata.testsCount}</testsCount>
            <assertionsCount>${file.metadata.assertionsCount}</assertionsCount>
            <linesOfCode>${file.metadata.linesOfCode}</linesOfCode>
            <maintainability>${file.metrics.maintainability}</maintainability>
        </testFile>
        `
          )
          .join('')}
    </testFiles>
</testReport>`;
  }

  private calculateQualityGrade(
    maintainability: number,
    complexity: number
  ): 'A' | 'B' | 'C' | 'D' | 'F' {
    const score = maintainability * 0.6 + (100 - complexity) * 0.4;

    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private calculateTestCoverage(testFile: TestFile): number {
    // Simple coverage calculation based on selectors vs assertions
    const selectors = this.extractSelectors(testFile.content);
    const assertions = this.countAssertions(testFile.content);

    return selectors.length > 0 ? (assertions / selectors.length) * 100 : 0;
  }

  private countTests(content: string): number {
    const testMatches = content.match(/test\s*\(|it\s*\(/g);
    return testMatches ? testMatches.length : 0;
  }

  private countAssertions(content: string): number {
    const assertionMatches = content.match(/expect\s*\(/g);
    return assertionMatches ? assertionMatches.length : 0;
  }

  private extractSelectors(content: string): string[] {
    const selectorMatches = content.match(/['"`]([^'"`]*)['"]\s*\)/g);
    if (!selectorMatches) return [];

    return selectorMatches
      .map((match) => match.replace(/['"`)]$/g, ''))
      .filter(
        (selector) => selector.includes('#') || selector.includes('.') || selector.includes('[')
      );
  }

  private getReportFileName(extension: string): string {
    const baseName = this.config.customReportName || 'test-report';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${baseName}-${timestamp}.${extension}`;
  }

  private mergeWithDefaults(config: Partial<TestReportConfig>): TestReportConfig {
    return {
      outputDir: './reports',
      format: ['html', 'json'],
      includeMetrics: true,
      includeScreenshots: true,
      includeCoverage: true,
      includeValidation: true,
      ...config,
    };
  }
}
