import { UserPath, InteractionStep, Assertion } from '../types/recording';
import {
  TestFile,
  GenerationOptions,
  GenerationResult,
  TestStructure,
  TestCase,
  TestStep,
  TestAssertion,
  ImportStatement,
  GenerationError,
  CodeFormatting,
} from '../types/generation';
import { logger } from '../utils/logger';
import { PathOptimizer } from '../recording/PathOptimizer';

export class TestGenerator {
  private optimizer: PathOptimizer;

  private formatting: CodeFormatting;

  constructor(private options: GenerationOptions) {
    this.optimizer = new PathOptimizer();
    this.formatting = options.formatting || {
      indent: '  ',
      quotes: 'single',
      semicolons: true,
      trailingComma: true,
      lineWidth: 100,
    };
  }

  async generate(userPath: UserPath): Promise<GenerationResult> {
    logger.info('Generating tests from user path', {
      pathId: userPath.id,
      steps: userPath.steps.length,
      framework: this.options.framework,
    });

    const errors: GenerationError[] = [];
    const files: TestFile[] = [];

    try {
      // Optimize the path first
      const optimizedPath = this.optimizer.optimize(userPath);

      // Generate main test file
      const testFile = await this.generateTestFile(optimizedPath);
      files.push(testFile);

      // Generate page objects if enabled
      if (this.options.generatePageObjects) {
        const pageObjects = await this.generatePageObjects(optimizedPath);
        files.push(...pageObjects);
      }

      // Generate fixtures if enabled
      if (this.options.generateFixtures) {
        const fixtures = await this.generateFixtures(optimizedPath);
        files.push(...fixtures);
      }

      // Generate helpers if enabled
      if (this.options.generateHelpers) {
        const helpers = await this.generateHelpers(optimizedPath);
        files.push(...helpers);
      }

      // Calculate summary
      const summary = this.calculateSummary(files, optimizedPath);

      return {
        files,
        summary,
        errors,
      };
    } catch (error) {
      logger.error('Test generation failed', error);
      errors.push({
        error: error instanceof Error ? error.message : String(error),
        severity: 'error',
      });

      return {
        files,
        summary: this.calculateSummary(files, userPath),
        errors,
      };
    }
  }

  private async generateTestFile(path: UserPath): Promise<TestFile> {
    const structure = this.buildTestStructure(path);
    const content = this.renderTestFile(structure, path);

    return {
      filename: this.generateTestFileName(path),
      path: `${this.options.outputDirectory}/tests`,
      content,
      type: 'test',
      metadata: {
        generatedAt: new Date(),
        sourcePath: path,
        framework: this.options.framework,
        language: this.options.language,
        dependencies: this.getRequiredDependencies(),
      },
    };
  }

  private buildTestStructure(path: UserPath): TestStructure {
    // Group steps for better organization
    const stepGroups = this.optimizer.groupSteps(path);

    // Build imports
    const imports = this.buildImports();

    // Build setup
    const setup = {
      type: 'beforeEach' as const,
      code: this.buildSetupCode(path),
    };

    // Build test cases
    const tests = this.buildTestCases(stepGroups, path);

    return {
      imports,
      setup,
      tests,
    };
  }

  private buildImports(): ImportStatement[] {
    const imports: ImportStatement[] = [];

    switch (this.options.framework) {
      case 'playwright':
        imports.push({
          named: ['test', 'expect'],
          from: '@playwright/test',
        });
        if (this.options.generatePageObjects) {
          imports.push({
            named: ['HomePage', 'LoginPage'], // Dynamic based on pages
            from: '../pages',
          });
        }
        break;
      case 'cypress':
        // Cypress uses global commands
        break;
      case 'puppeteer':
        imports.push({
          default: 'puppeteer',
          from: 'puppeteer',
        });
        break;
      default:
        throw new Error(`Unsupported framework: ${this.options.framework}`);
    }

    return imports;
  }

  private buildSetupCode(path: UserPath): string[] {
    const code: string[] = [];

    switch (this.options.framework) {
      case 'playwright':
        if (this.options.generatePageObjects) {
          code.push('let homePage: HomePage;');
          code.push('homePage = new HomePage(page);');
        }
        break;
      case 'cypress':
        code.push(
          `cy.viewport(${path.metadata.viewport.width}, ${path.metadata.viewport.height});`
        );
        break;
      case 'puppeteer':
        // Puppeteer setup code if needed
        break;
      default:
        // No setup code needed for unknown frameworks
        break;
    }

    return code;
  }

  private buildTestCases(stepGroups: InteractionStep[][], path: UserPath): TestCase[] {
    return stepGroups.map((group, index) => {
      const testName = this.generateTestName(group, index);
      const steps = this.convertStepsToTestSteps(group);
      const assertions = this.convertAssertions(path.assertions, group);

      return {
        name: testName,
        description: this.generateTestDescription(group),
        steps,
        assertions,
        tags: path.metadata.tags,
      };
    });
  }

  private convertStepsToTestSteps(steps: InteractionStep[]): TestStep[] {
    return steps.map((step) => {
      const code = this.generateStepCode(step);

      return {
        description: step.action,
        code,
        screenshot: !!step.screenshot,
        waitBefore: step.type === 'wait' ? step.value : undefined,
      };
    });
  }

  private generateStepCode(step: InteractionStep): string {
    switch (this.options.framework) {
      case 'playwright':
        return this.generatePlaywrightStep(step);
      case 'cypress':
        return this.generateCypressStep(step);
      case 'puppeteer':
        return this.generatePuppeteerStep(step);
      default:
        return `// ${step.action}`;
    }
  }

  private generatePlaywrightStep(step: InteractionStep): string {
    switch (step.type) {
      case 'navigation':
        return `await page.goto('${step.value}');`;

      case 'click':
        return `await page.click('${step.element?.selector}');`;

      case 'type':
        return `await page.fill('${step.element?.selector}', '${step.value}');`;

      case 'select':
        return `await page.selectOption('${step.element?.selector}', '${step.value}');`;

      case 'check':
        return step.value
          ? `await page.check('${step.element?.selector}');`
          : `await page.uncheck('${step.element?.selector}');`;

      case 'wait':
        return `await page.waitForTimeout(${step.value});`;

      case 'screenshot':
        return `await page.screenshot({ path: '${step.screenshot}' });`;

      default:
        return `// TODO: ${step.action}`;
    }
  }

  private generateCypressStep(step: InteractionStep): string {
    switch (step.type) {
      case 'navigation':
        return `cy.visit('${step.value}');`;

      case 'click':
        return `cy.get('${step.element?.selector}').click();`;

      case 'type':
        return `cy.get('${step.element?.selector}').type('${step.value}');`;

      case 'select':
        return `cy.get('${step.element?.selector}').select('${step.value}');`;

      case 'check':
        return step.value
          ? `cy.get('${step.element?.selector}').check();`
          : `cy.get('${step.element?.selector}').uncheck();`;

      case 'wait':
        return `cy.wait(${step.value});`;

      case 'screenshot':
        return `cy.screenshot('${step.screenshot}');`;

      default:
        return `// TODO: ${step.action}`;
    }
  }

  private generatePuppeteerStep(step: InteractionStep): string {
    switch (step.type) {
      case 'navigation':
        return `await page.goto('${step.value}');`;

      case 'click':
        return `await page.click('${step.element?.selector}');`;

      case 'type':
        return `await page.type('${step.element?.selector}', '${step.value}');`;

      case 'select':
        return `await page.select('${step.element?.selector}', '${step.value}');`;

      case 'wait':
        return `await page.waitForTimeout(${step.value});`;

      default:
        return `// TODO: ${step.action}`;
    }
  }

  private convertAssertions(assertions: Assertion[], steps: InteractionStep[]): TestAssertion[] {
    // Filter assertions relevant to these steps
    const relevantAssertions = assertions.filter((assertion) => {
      // Include all URL assertions
      if (assertion.type === 'url') return true;

      // Include assertions for elements in these steps
      return steps.some((step) => step.element?.selector === assertion.target);
    });

    return relevantAssertions.map((assertion) => ({
      type: assertion.type,
      target: assertion.target,
      expected: assertion.expected,
      message: assertion.message,
    }));
  }

  private renderTestFile(structure: TestStructure, path: UserPath): string {
    const lines: string[] = [];
    const { indent, quotes, semicolons } = this.formatting;
    const q = quotes === 'single' ? "'" : '"';
    const s = semicolons ? ';' : '';

    // Add imports
    structure.imports.forEach((imp) => {
      if (imp.default) {
        lines.push(`import ${imp.default} from ${q}${imp.from}${q}${s}`);
      } else if (imp.named) {
        lines.push(`import { ${imp.named.join(', ')} } from ${q}${imp.from}${q}${s}`);
      }
    });
    lines.push('');

    // Add test suite
    const suiteName = this.generateSuiteName(path);
    lines.push(`test.describe(${q}${suiteName}${q}, () => {`);

    // Add setup
    if (structure.setup.code.length > 0) {
      lines.push(`${indent}test.beforeEach(async ({ page }) => {`);
      structure.setup.code.forEach((line) => {
        lines.push(`${indent}${indent}${line}`);
      });
      lines.push(`${indent}})${s}`);
      lines.push('');
    }

    // Add test cases
    structure.tests.forEach((testCase, index) => {
      if (index > 0) lines.push('');

      lines.push(`${indent}test(${q}${testCase.name}${q}, async ({ page }) => {`);

      // Add steps
      testCase.steps.forEach((step) => {
        if (step.description && this.options.addComments) {
          lines.push(`${indent}${indent}// ${step.description}`);
        }
        lines.push(`${indent}${indent}${step.code}`);
      });

      // Add assertions
      if (testCase.assertions.length > 0) {
        lines.push('');
        lines.push(`${indent}${indent}// Assertions`);
        testCase.assertions.forEach((assertion) => {
          const assertionCode = this.generateAssertionCode(assertion);
          lines.push(`${indent}${indent}${assertionCode}`);
        });
      }

      lines.push(`${indent}})${s}`);
    });

    lines.push('});');

    return lines.join('\n');
  }

  private generateAssertionCode(assertion: TestAssertion): string {
    switch (this.options.framework) {
      case 'playwright':
        return this.generatePlaywrightAssertion(assertion);
      case 'cypress':
        return this.generateCypressAssertion(assertion);
      default:
        return `// Assert: ${assertion.type}`;
    }
  }

  private generatePlaywrightAssertion(assertion: TestAssertion): string {
    switch (assertion.type) {
      case 'url':
        return `await expect(page).toHaveURL(/${assertion.expected}/);`;
      case 'title':
        return `await expect(page).toHaveTitle('${assertion.expected}');`;
      case 'visible':
        return `await expect(page.locator('${assertion.target}')).toBeVisible();`;
      case 'text':
        return `await expect(page.locator('${assertion.target}')).toContainText('${assertion.expected}');`;
      case 'value':
        return `await expect(page.locator('${assertion.target}')).toHaveValue('${assertion.expected}');`;
      default:
        return `// TODO: Assert ${assertion.type}`;
    }
  }

  private generateCypressAssertion(assertion: TestAssertion): string {
    switch (assertion.type) {
      case 'url':
        return `cy.url().should('include', '${assertion.expected}');`;
      case 'title':
        return `cy.title().should('eq', '${assertion.expected}');`;
      case 'visible':
        return `cy.get('${assertion.target}').should('be.visible');`;
      case 'text':
        return `cy.get('${assertion.target}').should('contain', '${assertion.expected}');`;
      case 'value':
        return `cy.get('${assertion.target}').should('have.value', '${assertion.expected}');`;
      default:
        return `// TODO: Assert ${assertion.type}`;
    }
  }

  private generateTestFileName(path: UserPath): string {
    const name = path.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const extension = this.options.language === 'typescript' ? 'ts' : 'js';
    const suffix = this.options.framework === 'playwright' ? 'spec' : 'test';

    return `${name}.${suffix}.${extension}`;
  }

  private generateSuiteName(path: UserPath): string {
    return path.name || 'User Flow Test';
  }

  private generateTestName(steps: InteractionStep[], index: number): string {
    // Try to generate meaningful name from steps
    const navigation = steps.find((s) => s.type === 'navigation');
    const submission = steps.find(
      (s) => s.element?.type === 'button' && s.element.text?.toLowerCase().includes('submit')
    );

    if (navigation && submission) {
      return `should complete flow from ${this.getPageName(navigation.value)} to submission`;
    }

    if (navigation) {
      return `should navigate to ${this.getPageName(navigation.value)}`;
    }

    return `should complete interaction sequence ${index + 1}`;
  }

  private generateTestDescription(steps: InteractionStep[]): string {
    const actions = steps
      .filter((s) => s.type !== 'wait' && s.type !== 'screenshot')
      .map((s) => s.action)
      .join(', ');

    return `Performs: ${actions}`;
  }

  private getPageName(url: string): string {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname.replace(/^\/|\/$/g, '');
      return path || 'home';
    } catch {
      return 'page';
    }
  }

  private async generatePageObjects(_path: UserPath): Promise<TestFile[]> {
    // TODO: Implement page object generation
    return [];
  }

  private async generateFixtures(_path: UserPath): Promise<TestFile[]> {
    // TODO: Implement fixture generation
    return [];
  }

  private async generateHelpers(_path: UserPath): Promise<TestFile[]> {
    // TODO: Implement helper generation
    return [];
  }

  private calculateSummary(files: TestFile[], _path: UserPath): unknown {
    const testFiles = files.filter((f) => f.type === 'test');
    const pageObjects = files.filter((f) => f.type === 'page-object');
    const fixtures = files.filter((f) => f.type === 'fixture');
    const helpers = files.filter((f) => f.type === 'helper');

    return {
      totalFiles: files.length,
      testFiles: testFiles.length,
      pageObjects: pageObjects.length,
      fixtures: fixtures.length,
      helpers: helpers.length,
      totalTests: this.optimizer.groupSteps(path).length,
      totalAssertions: path.assertions.length,
      estimatedDuration: path.duration,
    };
  }

  private getRequiredDependencies(): string[] {
    switch (this.options.framework) {
      case 'playwright':
        return ['@playwright/test'];
      case 'cypress':
        return ['cypress'];
      case 'puppeteer':
        return ['puppeteer'];
      default:
        return [];
    }
  }
}
