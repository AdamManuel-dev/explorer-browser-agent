import { UserPath, InteractionStep, Assertion } from '../types/recording';
import {
  TestFile,
  GenerationOptions,
  GenerationResult,
  GenerationSummary,
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
import { 
  NaturalLanguageTestProcessor, 
  NaturalLanguageTestSpec, 
  ProcessedTestSpec,
  ProcessedTestStep,
  ProcessedTestAssertion
} from './NaturalLanguageTestProcessor';

export class TestGenerator {
  private optimizer: PathOptimizer;
  private nlProcessor: NaturalLanguageTestProcessor;
  private formatting: CodeFormatting;

  constructor(private options: GenerationOptions) {
    this.optimizer = new PathOptimizer();
    this.nlProcessor = new NaturalLanguageTestProcessor();
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
        waitBefore: step.type === 'wait' ? Number(step.value) || 0 : undefined,
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
        return `await page.goto('${String(step.value)}');`;

      case 'click':
        return `await page.click('${step.element?.selector}');`;

      case 'type':
        return `await page.fill('${step.element?.selector}', '${String(step.value)}');`;

      case 'select':
        return `await page.selectOption('${step.element?.selector}', '${String(step.value)}');`;

      case 'check':
        return step.value
          ? `await page.check('${step.element?.selector}');`
          : `await page.uncheck('${step.element?.selector}');`;

      case 'wait':
        return `await page.waitForTimeout(${Number(step.value) || 0});`;

      case 'screenshot':
        return `await page.screenshot({ path: '${step.screenshot}' });`;

      default:
        return `// TODO: ${step.action}`;
    }
  }

  private generateCypressStep(step: InteractionStep): string {
    switch (step.type) {
      case 'navigation':
        return `cy.visit('${String(step.value)}');`;

      case 'click':
        return `cy.get('${step.element?.selector}').click();`;

      case 'type':
        return `cy.get('${step.element?.selector}').type('${String(step.value)}');`;

      case 'select':
        return `cy.get('${step.element?.selector}').select('${String(step.value)}');`;

      case 'check':
        return step.value
          ? `cy.get('${step.element?.selector}').check();`
          : `cy.get('${step.element?.selector}').uncheck();`;

      case 'wait':
        return `cy.wait(${Number(step.value) || 0});`;

      case 'screenshot':
        return `cy.screenshot('${step.screenshot}');`;

      default:
        return `// TODO: ${step.action}`;
    }
  }

  private generatePuppeteerStep(step: InteractionStep): string {
    switch (step.type) {
      case 'navigation':
        return `await page.goto('${String(step.value)}');`;

      case 'click':
        return `await page.click('${step.element?.selector}');`;

      case 'type':
        return `await page.type('${step.element?.selector}', '${String(step.value)}');`;

      case 'select':
        return `await page.select('${step.element?.selector}', '${String(step.value)}');`;

      case 'wait':
        return `await page.waitForTimeout(${Number(step.value) || 0});`;

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
      return `should complete flow from ${this.getPageName(String(navigation.value))} to submission`;
    }

    if (navigation) {
      return `should navigate to ${this.getPageName(String(navigation.value))}`;
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

  private getPageName(url: string | number | boolean | Record<string, unknown>): string {
    try {
      const urlString = String(url);
      const urlObj = new URL(urlString);
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

  private calculateSummary(files: TestFile[], userPath: UserPath): GenerationSummary {
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
      totalTests: this.optimizer.groupSteps(userPath).length,
      totalAssertions: userPath.assertions.length,
      estimatedDuration: userPath.duration,
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

  // Natural language test generation methods

  async generateFromNaturalLanguage(nlSpecs: NaturalLanguageTestSpec[]): Promise<GenerationResult> {
    logger.info('Generating tests from natural language specifications', {
      specsCount: nlSpecs.length,
      framework: this.options.framework,
    });

    const errors: GenerationError[] = [];
    const files: TestFile[] = [];

    try {
      // Process natural language specs into structured test specs
      const processedSpecs = await this.nlProcessor.processMultipleSpecs(nlSpecs);

      // Generate test file from processed specs
      for (const processedSpec of processedSpecs) {
        const testFile = await this.generateTestFileFromProcessedSpec(processedSpec);
        files.push(testFile);
      }

      // Generate page objects if enabled
      if (this.options.generatePageObjects) {
        const pageObjects = await this.generatePageObjectsFromSpecs(processedSpecs);
        files.push(...pageObjects);
      }

      // Generate fixtures if enabled
      if (this.options.generateFixtures) {
        const fixtures = await this.generateFixturesFromSpecs(processedSpecs);
        files.push(...fixtures);
      }

      // Generate helpers if enabled
      if (this.options.generateHelpers) {
        const helpers = await this.generateHelpersFromSpecs(processedSpecs);
        files.push(...helpers);
      }

      // Calculate summary
      const summary = this.calculateSummaryFromFiles(files);

      return {
        files,
        summary,
        errors,
      };
    } catch (error) {
      logger.error('Natural language test generation failed', error);
      errors.push({
        error: error instanceof Error ? error.message : String(error),
        severity: 'error',
      });

      return {
        files,
        summary: this.calculateSummaryFromFiles(files),
        errors,
      };
    }
  }

  private async generateTestFileFromProcessedSpec(processedSpec: ProcessedTestSpec): Promise<TestFile> {
    const testCase: TestCase = {
      name: processedSpec.name,
      description: processedSpec.description,
      tags: processedSpec.metadata.tags,
      steps: this.convertProcessedStepsToTestSteps(processedSpec.steps),
      assertions: this.convertProcessedAssertionsToTestAssertions(processedSpec.assertions),
      timeout: processedSpec.metadata.estimatedTime * 60 * 1000, // Convert minutes to milliseconds
    };

    const structure: TestStructure = {
      imports: this.generateImportsForFramework(),
      setup: {
        type: 'beforeEach',
        code: processedSpec.setup ? 
          processedSpec.setup.map(step => this.convertProcessedStepToCode(step)) : 
          this.generateDefaultSetup(),
      },
      tests: [testCase],
      teardown: processedSpec.cleanup ? {
        type: 'afterEach',
        code: processedSpec.cleanup.map(step => this.convertProcessedStepToCode(step)),
      } : undefined,
    };

    const content = this.renderTestFileFromStructure(structure);

    return {
      filename: this.generateTestFileNameFromSpec(processedSpec),
      path: `${this.options.outputDirectory}/tests`,
      content,
      type: 'test',
      metadata: {
        generatedAt: new Date(),
        sourcePath: processedSpec as any, // Cast to satisfy type
        framework: this.options.framework,
        language: this.options.language || 'typescript',
        dependencies: this.getRequiredDependencies(),
        tags: processedSpec.metadata.tags,
      },
    };
  }

  private convertProcessedStepsToTestSteps(processedSteps: ProcessedTestStep[]): TestStep[] {
    return processedSteps.map(step => ({
      description: step.description,
      code: this.convertProcessedStepToCode(step),
      waitBefore: step.options?.timeout,
      waitAfter: step.options?.timeout,
    }));
  }

  private convertProcessedAssertionsToTestAssertions(processedAssertions: ProcessedTestAssertion[]): TestAssertion[] {
    return processedAssertions.map(assertion => ({
      type: assertion.type,
      target: assertion.target?.selector || assertion.target?.text || '',
      expected: assertion.expected,
      message: assertion.message,
    }));
  }

  private convertProcessedStepToCode(step: ProcessedTestStep): string {
    switch (this.options.framework) {
      case 'playwright':
        return this.generatePlaywrightStepFromProcessed(step);
      case 'cypress':
        return this.generateCypressStepFromProcessed(step);
      case 'puppeteer':
        return this.generatePuppeteerStepFromProcessed(step);
      default:
        return `// ${step.description}`;
    }
  }

  private generatePlaywrightStepFromProcessed(step: ProcessedTestStep): string {
    switch (step.type) {
      case 'navigate':
        return `await page.goto('${String(step.data)}');`;
      case 'click':
        return `await page.click('${step.target.selector}');`;
      case 'type':
        return `await page.fill('${step.target.selector}', '${String(step.data)}');`;
      case 'select':
        return `await page.selectOption('${step.target.selector}', '${String(step.data)}');`;
      case 'wait':
        return `await page.waitForTimeout(${Number(step.data) || 0});`;
      case 'scroll':
        return `await page.evaluate(() => window.scrollTo(0, ${Number(step.data) || 0}));`;
      case 'hover':
        return `await page.hover('${step.target.selector}');`;
      case 'drag':
        return `await page.dragAndDrop('${step.target.selector}', '${step.data}');`;
      default:
        return `// TODO: ${step.description}`;
    }
  }

  private generateCypressStepFromProcessed(step: ProcessedTestStep): string {
    switch (step.type) {
      case 'navigate':
        return `cy.visit('${String(step.data)}');`;
      case 'click':
        return `cy.get('${step.target.selector}').click();`;
      case 'type':
        return `cy.get('${step.target.selector}').type('${String(step.data)}');`;
      case 'select':
        return `cy.get('${step.target.selector}').select('${String(step.data)}');`;
      case 'wait':
        return `cy.wait(${Number(step.data) || 0});`;
      case 'scroll':
        return `cy.scrollTo(0, ${Number(step.data) || 0});`;
      case 'hover':
        return `cy.get('${step.target.selector}').trigger('mouseover');`;
      default:
        return `// TODO: ${step.description}`;
    }
  }

  private generatePuppeteerStepFromProcessed(step: ProcessedTestStep): string {
    switch (step.type) {
      case 'navigate':
        return `await page.goto('${String(step.data)}');`;
      case 'click':
        return `await page.click('${step.target.selector}');`;
      case 'type':
        return `await page.type('${step.target.selector}', '${String(step.data)}');`;
      case 'select':
        return `await page.select('${step.target.selector}', '${String(step.data)}');`;
      case 'wait':
        return `await page.waitForTimeout(${Number(step.data) || 0});`;
      case 'scroll':
        return `await page.evaluate(() => window.scrollTo(0, ${Number(step.data) || 0}));`;
      case 'hover':
        return `await page.hover('${step.target.selector}');`;
      default:
        return `// TODO: ${step.description}`;
    }
  }

  private async generatePageObjectsFromSpecs(specs: ProcessedTestSpec[]): Promise<TestFile[]> {
    // Extract unique pages from all specs
    const pages = new Set<string>();
    specs.forEach(spec => {
      spec.steps.forEach(step => {
        if (step.type === 'navigate' && step.data) {
          pages.add(String(step.data));
        }
      });
    });

    const files: TestFile[] = [];
    
    for (const pageUrl of pages) {
      const pageName = this.extractPageNameFromUrl(pageUrl);
      const selectors = this.extractSelectorsFromSpecs(specs);
      const pageObject = this.generatePageObjectForUrl(pageUrl, pageName, selectors);
      files.push(pageObject);
    }

    return files;
  }

  private extractSelectorsFromSpecs(specs: ProcessedTestSpec[]): Record<string, string> {
    const selectors: Record<string, string> = {};
    
    specs.forEach(spec => {
      spec.steps.forEach(step => {
        if (step.target.selector) {
          const elementName = step.target.text || `element_${Object.keys(selectors).length}`;
          selectors[elementName] = step.target.selector;
        }
      });
    });

    return selectors;
  }

  private generatePageObjectForUrl(url: string, pageName: string, selectors: Record<string, string>): TestFile {
    const className = `${pageName.charAt(0).toUpperCase() + pageName.slice(1)}Page`;
    
    const content = `export class ${className} {
  constructor(private page: Page) {}

  async navigate(): Promise<void> {
    await this.page.goto('${url}');
  }

${Object.entries(selectors).map(([name, selector]) => 
  `  get ${name}() {
    return this.page.locator('${selector}');
  }`
).join('\n\n')}
}`;

    return {
      filename: `${pageName}.page.ts`,
      path: `${this.options.outputDirectory}/pages`,
      content,
      type: 'page-object',
      metadata: {
        generatedAt: new Date(),
        sourcePath: { url } as any,
        framework: this.options.framework,
        language: this.options.language || 'typescript',
        dependencies: this.getRequiredDependencies(),
      },
    };
  }

  private async generateFixturesFromSpecs(specs: ProcessedTestSpec[]): Promise<TestFile[]> {
    const testData = {
      formData: {},
      urls: [],
    };

    specs.forEach(spec => {
      spec.steps.forEach(step => {
        if (step.type === 'type' && step.data) {
          const fieldName = step.target.text || 'field';
          testData.formData[fieldName] = step.data;
        }
        if (step.type === 'navigate' && step.data) {
          testData.urls.push(step.data);
        }
      });
    });

    const content = `export const testData = ${JSON.stringify(testData, null, 2)};`;

    return [{
      filename: 'test-data.ts',
      path: `${this.options.outputDirectory}/fixtures`,
      content,
      type: 'fixture',
      metadata: {
        generatedAt: new Date(),
        sourcePath: specs as any,
        framework: this.options.framework,
        language: this.options.language || 'typescript',
        dependencies: [],
      },
    }];
  }

  private async generateHelpersFromSpecs(specs: ProcessedTestSpec[]): Promise<TestFile[]> {
    const content = `import { Page } from '@playwright/test';

export class TestHelpers {
  constructor(private page: Page) {}

  async fillForm(formData: Record<string, string>): Promise<void> {
    for (const [field, value] of Object.entries(formData)) {
      await this.page.fill(\`[name="\${field}"], [id="\${field}"], [placeholder*="\${field}" i]\`, value);
    }
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: \`screenshots/\${name}.png\` });
  }
}`;

    return [{
      filename: 'helpers.ts',
      path: `${this.options.outputDirectory}/helpers`,
      content,
      type: 'helper',
      metadata: {
        generatedAt: new Date(),
        sourcePath: specs as any,
        framework: this.options.framework,
        language: this.options.language || 'typescript',
        dependencies: this.getRequiredDependencies(),
      },
    }];
  }

  private generateImportsForFramework(): ImportStatement[] {
    switch (this.options.framework) {
      case 'playwright':
        return [
          { named: ['test', 'expect'], from: '@playwright/test' },
          { named: ['Page'], from: '@playwright/test' },
        ];
      case 'cypress':
        return [];
      case 'puppeteer':
        return [
          { default: 'puppeteer', from: 'puppeteer' },
        ];
      default:
        return [];
    }
  }

  private generateDefaultSetup(): string[] {
    switch (this.options.framework) {
      case 'playwright':
        return ['// Browser and page setup handled by Playwright'];
      case 'cypress':
        return ['// Browser setup handled by Cypress'];
      case 'puppeteer':
        return [
          'const browser = await puppeteer.launch();',
          'const page = await browser.newPage();',
        ];
      default:
        return [];
    }
  }

  private renderTestFileFromStructure(structure: TestStructure): string {
    const parts: string[] = [];

    // Add imports
    structure.imports.forEach(importStmt => {
      if (importStmt.default && importStmt.named) {
        parts.push(`import ${importStmt.default}, { ${importStmt.named.join(', ')} } from '${importStmt.from}';`);
      } else if (importStmt.default) {
        parts.push(`import ${importStmt.default} from '${importStmt.from}';`);
      } else if (importStmt.named) {
        parts.push(`import { ${importStmt.named.join(', ')} } from '${importStmt.from}';`);
      }
    });

    parts.push('');

    // Add test suite
    parts.push(`test.describe('Generated Tests', () => {`);

    // Add setup
    if (structure.setup) {
      parts.push(`  test.${structure.setup.type}(async ({ page }) => {`);
      structure.setup.code.forEach(line => parts.push(`    ${line}`));
      parts.push('  });');
      parts.push('');
    }

    // Add tests
    structure.tests.forEach(testCase => {
      parts.push(`  test('${testCase.name}', async ({ page }) => {`);
      if (testCase.description) {
        parts.push(`    // ${testCase.description}`);
      }
      
      testCase.steps.forEach(step => {
        if (step.description && step.description !== step.code) {
          parts.push(`    // ${step.description}`);
        }
        parts.push(`    ${step.code}`);
      });

      testCase.assertions.forEach(assertion => {
        parts.push(`    ${this.generatePlaywrightAssertion(assertion)}`);
      });

      parts.push('  });');
      parts.push('');
    });

    // Add teardown
    if (structure.teardown) {
      parts.push(`  test.${structure.teardown.type}(async ({ page }) => {`);
      structure.teardown.code.forEach(line => parts.push(`    ${line}`));
      parts.push('  });');
    }

    parts.push('});');

    return parts.join('\n');
  }

  private generateTestFileNameFromSpec(spec: ProcessedTestSpec): string {
    const name = spec.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${name}.spec.ts`;
  }

  private calculateSummaryFromFiles(files: TestFile[]): GenerationSummary {
    const testFiles = files.filter(f => f.type === 'test');
    const pageObjects = files.filter(f => f.type === 'page-object');
    const fixtures = files.filter(f => f.type === 'fixture');
    const helpers = files.filter(f => f.type === 'helper');

    // Count tests and assertions from test files
    let totalTests = 0;
    let totalAssertions = 0;
    
    testFiles.forEach(file => {
      // Simple heuristic: count test( patterns and expect( patterns
      const testMatches = file.content.match(/test\(/g);
      const assertionMatches = file.content.match(/expect\(/g);
      totalTests += testMatches ? testMatches.length : 0;
      totalAssertions += assertionMatches ? assertionMatches.length : 0;
    });

    return {
      totalFiles: files.length,
      testFiles: testFiles.length,
      pageObjects: pageObjects.length,
      fixtures: fixtures.length,
      helpers: helpers.length,
      totalTests,
      totalAssertions,
      estimatedDuration: totalTests * 2, // 2 minutes per test estimate
    };
  }

  private extractPageNameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname.replace(/^\/|\/$/g, '');
      return path || 'home';
    } catch {
      return 'page';
    }
  }
}
