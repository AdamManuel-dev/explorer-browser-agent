/* eslint-disable max-classes-per-file */
import type { TestFile } from '../types/generation';

// Define interfaces locally to avoid circular dependency
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

export class PlaywrightBestPracticesRule implements ValidationRule {
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
        });
      }
    }

    return { errors, warnings };
  }

  private getTestContent(fullContent: string, test: TestInfo): string {
    const lines = fullContent.split('\n');
    return lines.slice(test.startLine - 1, test.endLine).join('\n');
  }
}

export class SelectorStabilityRule implements ValidationRule {
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
        });
      }
    }

    return { errors, warnings };
  }
}

export class AssertionQualityRule implements ValidationRule {
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
        });
      }
    }

    return { errors, warnings };
  }
}

export class TestStructureRule implements ValidationRule {
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
        });
      }
    }

    return { errors, warnings };
  }
}
