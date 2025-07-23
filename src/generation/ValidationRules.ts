/* eslint-disable max-classes-per-file */

// Import types from TestValidator to ensure compatibility
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

export class PlaywrightBestPracticesRule {
  async validate(
    _testFile: TestFile,
    parsed: ParsedTestContent
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for page.goto usage in tests (should be in beforeEach)
    for (const test of parsed.tests) {
      const testContent = this.getTestContent(_testFile.content, test);
      if (testContent.includes('page.goto')) {
        warnings.push({
          type: 'best-practice',
          message: 'Consider moving page.goto to beforeEach hook',
          line: test.startLine,
          suggestion: 'Use beforeEach for navigation to improve test maintainability',
        } as ValidationWarning);
      }
    }

    return { errors, warnings };
  }

  private getTestContent(fullContent: string, test: TestInfo): string {
    const lines = fullContent.split('\n');
    return lines.slice(test.startLine - 1, test.endLine).join('\n');
  }
}

export class SelectorStabilityRule {
  async validate(
    _testFile: TestFile,
    parsed: ParsedTestContent
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const selector of parsed.selectors) {
      if (selector.type === 'class' && !selector.selector.includes('data-')) {
        warnings.push({
          type: 'maintainability',
          message: `Consider using data-testid instead of class selector: ${selector.selector}`,
          line: selector.line,
          suggestion: 'Use [data-testid="..."] for more stable selectors',
        } as ValidationWarning);
      }
    }

    return { errors, warnings };
  }
}

export class AssertionQualityRule {
  async validate(
    _testFile: TestFile,
    parsed: ParsedTestContent
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const assertion of parsed.assertions) {
      if (assertion.type === 'generic') {
        warnings.push({
          type: 'best-practice',
          message: 'Consider using more specific assertion',
          line: assertion.line,
          suggestion: 'Use specific assertions like toHaveText, toBeVisible, etc.',
        } as ValidationWarning);
      }
    }

    return { errors, warnings };
  }
}

export class TestStructureRule {
  async validate(
    _testFile: TestFile,
    parsed: ParsedTestContent
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for very long tests
    for (const test of parsed.tests) {
      const testLength = test.endLine - test.startLine;
      if (testLength > 50) {
        warnings.push({
          type: 'maintainability',
          message: `Test "${test.name}" is very long (${testLength} lines)`,
          line: test.startLine,
          suggestion: 'Consider breaking into smaller tests or extracting helper functions',
        } as ValidationWarning);
      }
    }

    return { errors, warnings };
  }
}
