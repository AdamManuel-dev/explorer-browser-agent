export { TestGenerator } from './TestGenerator';
export { PageObjectGenerator } from './PageObjectGenerator';
export { TestFileWriter } from './TestFileWriter';
export { TestValidator } from './TestValidator';
export { TestReporter } from './TestReporter';
export { NaturalLanguageTestProcessor } from './NaturalLanguageTestProcessor';
export { AIAssertionGenerator } from './AIAssertionGenerator';
export type {
  TestFile,
  TestFileType,
  TestMetadata,
  TestFramework,
  GenerationOptions,
  CodeFormatting,
  TestStructure,
  TestCase,
  TestStep,
  TestAssertion,
  PageObject,
  PageSelector,
  PageAction,
  GenerationResult,
  GenerationSummary,
  GenerationError,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationMetrics,
} from '../types/generation';
export type {
  TestReportConfig,
  TestSuiteReport,
  ReportMetadata,
  TestSuiteSummary,
  TestFileReport,
  ValidationSummary,
  CoverageSummary,
  PerformanceSummary,
  ScreenshotSummary,
} from './TestReporter';
export type {
  NaturalLanguageTestSpec,
  ProcessedTestSpec,
  ProcessedTestStep,
  ProcessedTestAssertion,
} from './NaturalLanguageTestProcessor';
export type {
  AssertionContext,
  SmartAssertion,
} from './AIAssertionGenerator';
