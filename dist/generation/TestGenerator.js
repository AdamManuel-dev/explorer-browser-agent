"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestGenerator = void 0;
const logger_1 = require("../utils/logger");
const PathOptimizer_1 = require("../recording/PathOptimizer");
class TestGenerator {
    options;
    optimizer;
    formatting;
    constructor(options) {
        this.options = options;
        this.optimizer = new PathOptimizer_1.PathOptimizer();
        this.formatting = options.formatting || {
            indent: '  ',
            quotes: 'single',
            semicolons: true,
            trailingComma: true,
            lineWidth: 100,
        };
    }
    async generate(userPath) {
        logger_1.logger.info('Generating tests from user path', {
            pathId: userPath.id,
            steps: userPath.steps.length,
            framework: this.options.framework,
        });
        const errors = [];
        const files = [];
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
        }
        catch (error) {
            logger_1.logger.error('Test generation failed', error);
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
    async generateTestFile(path) {
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
    buildTestStructure(path) {
        // Group steps for better organization
        const stepGroups = this.optimizer.groupSteps(path);
        // Build imports
        const imports = this.buildImports();
        // Build setup
        const setup = {
            type: 'beforeEach',
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
    buildImports() {
        const imports = [];
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
    buildSetupCode(path) {
        const code = [];
        switch (this.options.framework) {
            case 'playwright':
                if (this.options.generatePageObjects) {
                    code.push('let homePage: HomePage;');
                    code.push('homePage = new HomePage(page);');
                }
                break;
            case 'cypress':
                code.push(`cy.viewport(${path.metadata.viewport.width}, ${path.metadata.viewport.height});`);
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
    buildTestCases(stepGroups, path) {
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
    convertStepsToTestSteps(steps) {
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
    generateStepCode(step) {
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
    generatePlaywrightStep(step) {
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
    generateCypressStep(step) {
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
    generatePuppeteerStep(step) {
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
    convertAssertions(assertions, steps) {
        // Filter assertions relevant to these steps
        const relevantAssertions = assertions.filter((assertion) => {
            // Include all URL assertions
            if (assertion.type === 'url')
                return true;
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
    renderTestFile(structure, path) {
        const lines = [];
        const { indent, quotes, semicolons } = this.formatting;
        const q = quotes === 'single' ? "'" : '"';
        const s = semicolons ? ';' : '';
        // Add imports
        structure.imports.forEach((imp) => {
            if (imp.default) {
                lines.push(`import ${imp.default} from ${q}${imp.from}${q}${s}`);
            }
            else if (imp.named) {
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
            if (index > 0)
                lines.push('');
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
    generateAssertionCode(assertion) {
        switch (this.options.framework) {
            case 'playwright':
                return this.generatePlaywrightAssertion(assertion);
            case 'cypress':
                return this.generateCypressAssertion(assertion);
            default:
                return `// Assert: ${assertion.type}`;
        }
    }
    generatePlaywrightAssertion(assertion) {
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
    generateCypressAssertion(assertion) {
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
    generateTestFileName(path) {
        const name = path.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        const extension = this.options.language === 'typescript' ? 'ts' : 'js';
        const suffix = this.options.framework === 'playwright' ? 'spec' : 'test';
        return `${name}.${suffix}.${extension}`;
    }
    generateSuiteName(path) {
        return path.name || 'User Flow Test';
    }
    generateTestName(steps, index) {
        // Try to generate meaningful name from steps
        const navigation = steps.find((s) => s.type === 'navigation');
        const submission = steps.find((s) => s.element?.type === 'button' && s.element.text?.toLowerCase().includes('submit'));
        if (navigation && submission) {
            return `should complete flow from ${this.getPageName(String(navigation.value))} to submission`;
        }
        if (navigation) {
            return `should navigate to ${this.getPageName(String(navigation.value))}`;
        }
        return `should complete interaction sequence ${index + 1}`;
    }
    generateTestDescription(steps) {
        const actions = steps
            .filter((s) => s.type !== 'wait' && s.type !== 'screenshot')
            .map((s) => s.action)
            .join(', ');
        return `Performs: ${actions}`;
    }
    getPageName(url) {
        try {
            const urlString = String(url);
            const urlObj = new URL(urlString);
            const path = urlObj.pathname.replace(/^\/|\/$/g, '');
            return path || 'home';
        }
        catch {
            return 'page';
        }
    }
    async generatePageObjects(_path) {
        // TODO: Implement page object generation
        return [];
    }
    async generateFixtures(_path) {
        // TODO: Implement fixture generation
        return [];
    }
    async generateHelpers(_path) {
        // TODO: Implement helper generation
        return [];
    }
    calculateSummary(files, userPath) {
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
    getRequiredDependencies() {
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
exports.TestGenerator = TestGenerator;
//# sourceMappingURL=TestGenerator.js.map