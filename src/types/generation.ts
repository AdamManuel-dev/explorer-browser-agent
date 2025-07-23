import { UserPath, InteractionStep, Assertion } from './recording';

export interface TestFile {
  filename: string;
  path: string;
  content: string;
  type: TestFileType;
  metadata: TestMetadata;
}

export type TestFileType = 
  | 'test'
  | 'page-object'
  | 'fixture'
  | 'helper'
  | 'config';

export interface TestMetadata {
  generatedAt: Date;
  sourcePath: UserPath;
  framework: TestFramework;
  language: 'typescript' | 'javascript';
  dependencies: string[];
  tags?: string[];
}

export type TestFramework = 
  | 'playwright'
  | 'cypress'
  | 'puppeteer'
  | 'selenium';

export interface GenerationOptions {
  framework: TestFramework;
  language: 'typescript' | 'javascript';
  outputDirectory: string;
  generatePageObjects: boolean;
  generateFixtures: boolean;
  generateHelpers: boolean;
  useAAAPattern: boolean; // Arrange-Act-Assert
  addComments: boolean;
  groupRelatedTests: boolean;
  testNamingConvention: 'describe-it' | 'test' | 'custom';
  assertionLibrary?: 'built-in' | 'chai' | 'jest';
  formatting?: CodeFormatting;
}

export interface CodeFormatting {
  indent: string;
  quotes: 'single' | 'double';
  semicolons: boolean;
  trailingComma: boolean;
  lineWidth: number;
}

export interface TestStructure {
  imports: ImportStatement[];
  setup: SetupBlock;
  tests: TestCase[];
  teardown?: TeardownBlock;
  helpers?: HelperFunction[];
}

export interface ImportStatement {
  named?: string[];
  default?: string;
  from: string;
}

export interface SetupBlock {
  type: 'beforeAll' | 'beforeEach';
  code: string[];
}

export interface TeardownBlock {
  type: 'afterAll' | 'afterEach';
  code: string[];
}

export interface TestCase {
  name: string;
  description?: string;
  tags?: string[];
  steps: TestStep[];
  assertions: TestAssertion[];
  timeout?: number;
  skip?: boolean;
  only?: boolean;
}

export interface TestStep {
  description?: string;
  code: string;
  screenshot?: boolean;
  waitBefore?: number;
  waitAfter?: number;
}

export interface TestAssertion {
  type: string;
  target: string;
  expected: any;
  message?: string;
  soft?: boolean; // Continue on failure
}

export interface HelperFunction {
  name: string;
  parameters: string[];
  body: string[];
  returnType?: string;
}

export interface PageObject {
  name: string;
  url?: string;
  selectors: Record<string, PageSelector>;
  actions: Record<string, PageAction>;
  assertions: Record<string, PageAssertion>;
}

export interface PageSelector {
  selector: string;
  description?: string;
  type?: string;
}

export interface PageAction {
  name: string;
  parameters?: ActionParameter[];
  steps: string[];
  description?: string;
}

export interface ActionParameter {
  name: string;
  type: string;
  required: boolean;
  default?: any;
}

export interface PageAssertion {
  name: string;
  selector?: string;
  condition: string;
  description?: string;
}

export interface GenerationResult {
  files: TestFile[];
  summary: GenerationSummary;
  errors: GenerationError[];
}

export interface GenerationSummary {
  totalFiles: number;
  testFiles: number;
  pageObjects: number;
  fixtures: number;
  helpers: number;
  totalTests: number;
  totalAssertions: number;
  estimatedDuration: number;
}

export interface GenerationError {
  file?: string;
  step?: InteractionStep;
  error: string;
  severity: 'warning' | 'error';
}