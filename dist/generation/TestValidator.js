"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestValidator = void 0;
const logger_1 = require("../utils/logger");
const ValidationRules_1 = require("./ValidationRules");
class TestValidator {
    framework;
    validationRules;
    constructor(framework = 'playwright') {
        this.framework = framework;
        this.validationRules = this.initializeValidationRules();
    }
    async validateTestFile(testFile) {
        logger_1.logger.info('Validating test file', {
            filename: testFile.filename,
            framework: this.framework,
        });
        const errors = [];
        const warnings = [];
        let metrics;
        try {
            // Parse the test content
            const parseResult = this.parseTestContent(testFile.content);
            // Run validation rules
            for (const rule of this.validationRules) {
                const ruleResult = await rule.validate(testFile, parseResult);
                errors.push(...ruleResult.errors);
                warnings.push(...ruleResult.warnings);
            }
            // Calculate metrics
            metrics = this.calculateMetrics(testFile, parseResult);
            // Validate syntax
            const syntaxErrors = await this.validateSyntax(testFile);
            errors.push(...syntaxErrors);
            // Validate imports
            const importErrors = this.validateImports(testFile, parseResult);
            errors.push(...importErrors);
            // Validate selectors
            const selectorWarnings = this.validateSelectors(parseResult);
            warnings.push(...selectorWarnings);
            // Validate assertions
            const assertionErrors = this.validateAssertions(parseResult);
            errors.push(...assertionErrors);
            const isValid = errors.filter((e) => e.severity === 'error').length === 0;
            return {
                isValid,
                errors,
                warnings,
                metrics,
            };
        }
        catch (error) {
            logger_1.logger.error('Test validation failed', { filename: testFile.filename, error });
            return {
                isValid: false,
                errors: [
                    {
                        type: 'syntax',
                        message: `Validation failed: ${error instanceof Error ? error.message : error}`,
                        severity: 'error',
                        file: testFile.filename,
                    },
                ],
                warnings: [],
                metrics: this.getDefaultMetrics(),
            };
        }
    }
    async validateTestSuite(testFiles) {
        logger_1.logger.info('Validating test suite', { totalFiles: testFiles.length });
        const allErrors = [];
        const allWarnings = [];
        const fileMetrics = [];
        // Validate each file
        for (const testFile of testFiles) {
            const result = await this.validateTestFile(testFile);
            allErrors.push(...result.errors);
            allWarnings.push(...result.warnings);
            fileMetrics.push(result.metrics);
        }
        // Suite-level validations
        const suiteWarnings = this.validateSuiteStructure(testFiles);
        allWarnings.push(...suiteWarnings);
        // Aggregate metrics
        const aggregatedMetrics = this.aggregateMetrics(fileMetrics);
        const isValid = allErrors.filter((e) => e.severity === 'error').length === 0;
        return {
            isValid,
            errors: allErrors,
            warnings: allWarnings,
            metrics: aggregatedMetrics,
        };
    }
    async validateGeneratedCode(code, filename) {
        const testFile = {
            filename,
            path: '',
            content: code,
            type: 'test',
            metadata: {
                generatedAt: new Date(),
                sourcePath: '',
                framework: this.framework,
                language: 'typescript',
                dependencies: [],
            },
        };
        return this.validateTestFile(testFile);
    }
    parseTestContent(content) {
        const lines = content.split('\n');
        const imports = [];
        const tests = [];
        const selectors = [];
        const assertions = [];
        let currentTest = null;
        let lineNumber = 0;
        for (const line of lines) {
            lineNumber++;
            const trimmedLine = line.trim();
            // Parse imports
            if (trimmedLine.startsWith('import')) {
                imports.push(this.parseImport(trimmedLine, lineNumber));
            }
            // Parse test blocks
            if (trimmedLine.includes('test(') || trimmedLine.includes('it(')) {
                const testName = this.extractTestName(trimmedLine);
                currentTest = {
                    name: testName,
                    startLine: lineNumber,
                    endLine: 0,
                    assertions: [],
                    selectors: [],
                };
                tests.push(currentTest);
            }
            // Parse selectors from multiple patterns
            const selectorPatterns = [
                /page\.locator\(['"`]([^'"`]+)['"`]\)/g,
                /page\.click\(['"`]([^'"`]+)['"`]\)/g,
                /page\.fill\(['"`]([^'"`]+)['"`]\)/g,
                /page\.getByRole\(['"`]([^'"`]+)['"`]\)/g,
                /locator\(['"`]([^'"`]+)['"`]\)/g,
            ];
            for (const pattern of selectorPatterns) {
                const matches = trimmedLine.match(pattern);
                if (matches && currentTest) {
                    for (const match of matches) {
                        const selector = match.match(/['"`]([^'"`]+)['"`]/)?.[1];
                        if (selector) {
                            const selectorInfo = {
                                selector,
                                line: lineNumber,
                                testName: currentTest.name,
                                type: this.classifySelector(selector),
                            };
                            selectors.push(selectorInfo);
                            currentTest.selectors.push(selectorInfo);
                        }
                    }
                }
            }
            // Parse assertions
            if (trimmedLine.includes('expect(')) {
                const assertionInfo = {
                    type: this.classifyAssertion(trimmedLine),
                    line: lineNumber,
                    content: trimmedLine,
                    testName: currentTest?.name || 'unknown',
                };
                assertions.push(assertionInfo);
                if (currentTest) {
                    currentTest.assertions.push(assertionInfo);
                }
            }
            // Close test block
            if (trimmedLine === '});' && currentTest && currentTest.endLine === 0) {
                currentTest.endLine = lineNumber;
                currentTest = null;
            }
        }
        return {
            imports,
            tests,
            selectors,
            assertions,
            totalLines: lines.length,
        };
    }
    async validateSyntax(testFile) {
        const errors = [];
        try {
            // Check for common syntax issues
            const lines = testFile.content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (!line)
                    continue;
                const lineNumber = i + 1;
                // Check for missing semicolons
                if (this.shouldHaveSemicolon(line) && !line.trim().endsWith(';')) {
                    errors.push({
                        type: 'syntax',
                        message: 'Missing semicolon',
                        line: lineNumber,
                        file: testFile.filename,
                        severity: 'warning',
                    });
                }
                // Check for mismatched brackets
                const openBrackets = (line.match(/[{[(]/g) || []).length;
                const closeBrackets = (line.match(/[}\])]/g) || []).length;
                if (openBrackets !== closeBrackets && !this.isMultiLineStatement(line)) {
                    errors.push({
                        type: 'syntax',
                        message: 'Potentially mismatched brackets',
                        line: lineNumber,
                        file: testFile.filename,
                        severity: 'error',
                    });
                }
                // Check for async/await consistency
                if (line.includes('await ') && !this.isInAsyncFunction(lines, i)) {
                    errors.push({
                        type: 'syntax',
                        message: 'await used outside async function',
                        line: lineNumber,
                        file: testFile.filename,
                        severity: 'error',
                    });
                }
            }
        }
        catch (error) {
            errors.push({
                type: 'syntax',
                message: `Syntax validation failed: ${error instanceof Error ? error.message : error}`,
                file: testFile.filename,
                severity: 'error',
            });
        }
        return errors;
    }
    validateImports(testFile, parsed) {
        const errors = [];
        const requiredImports = this.getRequiredImports();
        const actualImports = parsed.imports.map((imp) => imp.module);
        // Check for missing required imports
        for (const required of requiredImports) {
            if (!actualImports.includes(required)) {
                errors.push({
                    type: 'import',
                    message: `Missing required import: ${required}`,
                    file: testFile.filename,
                    severity: 'error',
                });
            }
        }
        // Check for unused imports
        for (const importInfo of parsed.imports) {
            if (!this.isImportUsed(importInfo, testFile.content)) {
                errors.push({
                    type: 'import',
                    message: `Unused import: ${importInfo.module}`,
                    line: importInfo.line,
                    file: testFile.filename,
                    severity: 'warning',
                });
            }
        }
        return errors;
    }
    validateSelectors(parsed) {
        const warnings = [];
        const selectorCounts = new Map();
        // Count selector usage
        for (const selector of parsed.selectors) {
            const count = selectorCounts.get(selector.selector) || 0;
            selectorCounts.set(selector.selector, count + 1);
        }
        // Check for fragile selectors
        for (const selector of parsed.selectors) {
            if (this.isFragileSelector(selector.selector)) {
                warnings.push({
                    type: 'maintainability',
                    message: `Fragile selector detected: ${selector.selector}`,
                    line: selector.line,
                    suggestion: 'Consider using data-testid or more stable selectors',
                });
            }
        }
        // Check for duplicate selectors
        for (const [selector, count] of selectorCounts) {
            if (count > 3) {
                warnings.push({
                    type: 'maintainability',
                    message: `Selector used ${count} times: ${selector}`,
                    suggestion: 'Consider extracting to a page object or constant',
                });
            }
        }
        return warnings;
    }
    validateAssertions(parsed) {
        const errors = [];
        for (const test of parsed.tests) {
            // Check for tests without assertions
            if (test.assertions.length === 0) {
                errors.push({
                    type: 'assertion',
                    message: `Test "${test.name}" has no assertions`,
                    line: test.startLine,
                    severity: 'warning',
                });
            }
            // Check for weak assertions
            for (const assertion of test.assertions) {
                if (this.isWeakAssertion(assertion)) {
                    errors.push({
                        type: 'assertion',
                        message: 'Weak assertion detected - consider more specific assertion',
                        line: assertion.line,
                        severity: 'warning',
                    });
                }
            }
        }
        return errors;
    }
    validateSuiteStructure(testFiles) {
        const warnings = [];
        // Check for naming consistency
        const namingPatterns = testFiles.map((f) => f.filename.split('.')[0] || '');
        const hasConsistentNaming = this.checkNamingConsistency(namingPatterns);
        if (!hasConsistentNaming) {
            warnings.push({
                type: 'best-practice',
                message: 'Inconsistent test file naming detected',
                suggestion: 'Use consistent naming pattern (e.g., feature.spec.ts)',
            });
        }
        // Check for test organization
        if (testFiles.length > 10) {
            warnings.push({
                type: 'maintainability',
                message: 'Large number of test files detected',
                suggestion: 'Consider organizing tests into subdirectories by feature',
            });
        }
        return warnings;
    }
    calculateMetrics(testFile, parsed) {
        const totalTests = parsed.tests.length;
        const totalAssertions = parsed.assertions.length;
        const averageTestLength = totalTests > 0
            ? parsed.tests.reduce((sum, test) => sum + (test.endLine - test.startLine), 0) / totalTests
            : 0;
        // Calculate complexity score (based on assertions, selectors, and test length)
        const complexityScore = this.calculateComplexityScore(parsed);
        // Calculate maintainability index
        const maintainabilityIndex = this.calculateMaintainabilityIndex(parsed);
        // Find duplicate selectors
        const selectorCounts = new Map();
        parsed.selectors.forEach((s) => {
            selectorCounts.set(s.selector, (selectorCounts.get(s.selector) || 0) + 1);
        });
        const duplicateSelectors = Array.from(selectorCounts.entries())
            .filter(([, count]) => count > 1)
            .map(([selector]) => selector);
        // Find unused imports
        const unusedImports = parsed.imports
            .filter((imp) => !this.isImportUsed(imp, testFile.content))
            .map((imp) => imp.module);
        return {
            totalTests,
            totalAssertions,
            averageTestLength,
            complexityScore,
            maintainabilityIndex,
            duplicateSelectors,
            unusedImports,
        };
    }
    aggregateMetrics(fileMetrics) {
        if (fileMetrics.length === 0) {
            return this.getDefaultMetrics();
        }
        const totalTests = fileMetrics.reduce((sum, m) => sum + m.totalTests, 0);
        const totalAssertions = fileMetrics.reduce((sum, m) => sum + m.totalAssertions, 0);
        const averageTestLength = fileMetrics.reduce((sum, m) => sum + m.averageTestLength, 0) / fileMetrics.length;
        const complexityScore = fileMetrics.reduce((sum, m) => sum + m.complexityScore, 0) / fileMetrics.length;
        const maintainabilityIndex = fileMetrics.reduce((sum, m) => sum + m.maintainabilityIndex, 0) / fileMetrics.length;
        const allDuplicateSelectors = new Set();
        const allUnusedImports = new Set();
        fileMetrics.forEach((m) => {
            m.duplicateSelectors.forEach((s) => allDuplicateSelectors.add(s));
            m.unusedImports.forEach((i) => allUnusedImports.add(i));
        });
        return {
            totalTests,
            totalAssertions,
            averageTestLength,
            complexityScore,
            maintainabilityIndex,
            duplicateSelectors: Array.from(allDuplicateSelectors),
            unusedImports: Array.from(allUnusedImports),
        };
    }
    initializeValidationRules() {
        return [
            new ValidationRules_1.PlaywrightBestPracticesRule(),
            new ValidationRules_1.SelectorStabilityRule(),
            new ValidationRules_1.AssertionQualityRule(),
            new ValidationRules_1.TestStructureRule(),
        ];
    }
    // Helper methods
    parseImport(line, lineNumber) {
        const moduleMatch = line.match(/from ['"`]([^'"`]+)['"`]/);
        const module = moduleMatch?.[1] || '';
        const namedMatch = line.match(/import\s*{\s*([^}]+)\s*}/);
        const named = namedMatch?.[1]?.split(',').map((s) => s.trim()) || [];
        const defaultMatch = line.match(/import\s+(\w+)\s+from/);
        const defaultImport = defaultMatch?.[1] || '';
        return {
            module,
            named,
            default: defaultImport,
            line: lineNumber,
        };
    }
    extractTestName(line) {
        const match = line.match(/['"`]([^'"`]+)['"`]/);
        return match?.[1] || 'unnamed test';
    }
    classifySelector(selector) {
        if (selector.startsWith('#'))
            return 'id';
        if (selector.startsWith('.'))
            return 'class';
        if (selector.includes('[data-testid'))
            return 'data-testid';
        if (selector.includes('['))
            return 'attribute';
        return 'tag';
    }
    classifyAssertion(line) {
        if (line.includes('toBeVisible'))
            return 'visibility';
        if (line.includes('toHaveText'))
            return 'text';
        if (line.includes('toHaveValue'))
            return 'value';
        if (line.includes('toHaveURL'))
            return 'url';
        return 'generic';
    }
    shouldHaveSemicolon(line) {
        const trimmed = line.trim();
        return (trimmed.length > 0 &&
            !trimmed.endsWith('{') &&
            !trimmed.endsWith('}') &&
            !trimmed.startsWith('//') &&
            !trimmed.startsWith('/*'));
    }
    isMultiLineStatement(line) {
        return line.includes('(') && !line.includes(')');
    }
    isInAsyncFunction(lines, currentIndex) {
        for (let i = currentIndex; i >= 0; i--) {
            const line = lines[i];
            if (!line)
                continue;
            if (line.includes('async'))
                return true;
            if (line.includes('function') && !line.includes('async'))
                return false;
        }
        return false;
    }
    getRequiredImports() {
        switch (this.framework) {
            case 'playwright':
                return ['@playwright/test'];
            case 'cypress':
                return [];
            case 'puppeteer':
                return ['puppeteer'];
            default:
                return [];
        }
    }
    isImportUsed(importInfo, content) {
        // Check if any named imports are used
        for (const named of importInfo.named) {
            if (content.includes(named))
                return true;
        }
        // Check if default import is used
        if (importInfo.default && content.includes(importInfo.default)) {
            return true;
        }
        return false;
    }
    isFragileSelector(selector) {
        // CSS selectors that are considered fragile
        const fragilePatterns = [
            /nth-child/,
            /nth-of-type/,
            /\.css-\w+/, // CSS-in-JS generated classes
            /\[class\*=".*\d+.*"\]/, // Classes with numbers (often generated)
        ];
        return fragilePatterns.some((pattern) => pattern.test(selector));
    }
    isWeakAssertion(assertion) {
        const weakPatterns = ['toExist', 'toBeTruthy', 'toBeFalsy'];
        return weakPatterns.some((pattern) => assertion.content.includes(pattern));
    }
    checkNamingConsistency(patterns) {
        if (patterns.length <= 1)
            return true;
        const extensions = patterns.map((p) => p.split('.').pop());
        const uniqueExtensions = new Set(extensions);
        return uniqueExtensions.size <= 2; // Allow for .spec and .test variations
    }
    calculateComplexityScore(parsed) {
        let score = 0;
        // Base score from number of tests
        score += parsed.tests.length * 2;
        // Add complexity for each assertion
        score += parsed.assertions.length;
        // Add complexity for unique selectors
        const uniqueSelectors = new Set(parsed.selectors.map((s) => s.selector));
        score += uniqueSelectors.size;
        // Normalize to 0-100 scale
        return Math.min(100, score);
    }
    calculateMaintainabilityIndex(parsed) {
        let score = 100; // Start with perfect score
        // Reduce score for excessive test length
        const avgTestLength = parsed.tests.length > 0
            ? parsed.tests.reduce((sum, test) => sum + (test.endLine - test.startLine), 0) /
                parsed.tests.length
            : 0;
        if (avgTestLength > 50)
            score -= 20;
        else if (avgTestLength > 30)
            score -= 10;
        // Reduce score for fragile selectors
        const fragileSelectors = parsed.selectors.filter((s) => this.isFragileSelector(s.selector));
        score -= fragileSelectors.length * 5;
        // Reduce score for weak assertions
        const weakAssertions = parsed.assertions.filter((a) => this.isWeakAssertion(a));
        score -= weakAssertions.length * 3;
        return Math.max(0, score);
    }
    getDefaultMetrics() {
        return {
            totalTests: 0,
            totalAssertions: 0,
            averageTestLength: 0,
            complexityScore: 0,
            maintainabilityIndex: 100,
            duplicateSelectors: [],
            unusedImports: [],
        };
    }
}
exports.TestValidator = TestValidator;
//# sourceMappingURL=TestValidator.js.map