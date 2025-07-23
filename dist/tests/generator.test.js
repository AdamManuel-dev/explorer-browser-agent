"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const TestGenerator_1 = require("../generation/TestGenerator");
const TestValidator_1 = require("../generation/TestValidator");
globals_1.jest.mock('../utils/logger');
globals_1.jest.mock('../generation/TestValidator');
(0, globals_1.describe)('TestGenerator', () => {
    let generator;
    let mockValidator;
    (0, globals_1.beforeEach)(() => {
        mockValidator = {
            validateTestFile: globals_1.jest.fn(() => Promise.resolve({
                isValid: true,
                errors: [],
                warnings: [],
                metrics: {
                    totalTests: 1,
                    totalAssertions: 3,
                    averageTestLength: 25,
                    complexityScore: 30,
                    maintainabilityIndex: 85,
                    duplicateSelectors: [],
                    unusedImports: [],
                },
            })),
            validateTestSuite: globals_1.jest.fn(),
            validateGeneratedCode: globals_1.jest.fn(),
        };
        TestValidator_1.TestValidator.mockImplementation(() => mockValidator);
        generator = new TestGenerator_1.TestGenerator();
    });
    (0, globals_1.describe)('initialization', () => {
        (0, globals_1.test)('should initialize with default framework', () => {
            (0, globals_1.expect)(generator).toBeDefined();
        });
        (0, globals_1.test)('should support different frameworks', () => {
            const playwrightGenerator = new TestGenerator_1.TestGenerator('playwright');
            const cypressGenerator = new TestGenerator_1.TestGenerator('cypress');
            const puppeteerGenerator = new TestGenerator_1.TestGenerator('puppeteer');
            (0, globals_1.expect)(playwrightGenerator).toBeDefined();
            (0, globals_1.expect)(cypressGenerator).toBeDefined();
            (0, globals_1.expect)(puppeteerGenerator).toBeDefined();
        });
    });
    (0, globals_1.describe)('test generation from user paths', () => {
        (0, globals_1.test)('should generate Playwright test from simple user path', async () => {
            const userPath = {
                id: '1',
                startUrl: 'https://example.com/login',
                title: 'Login Flow',
                description: 'User login test',
                steps: [
                    {
                        id: '1',
                        type: 'navigate',
                        url: 'https://example.com/login',
                        timestamp: new Date(),
                        duration: 1000,
                        selector: '',
                        action: 'navigate',
                        value: '',
                        assertion: {
                            type: 'url',
                            expected: 'https://example.com/login',
                            actual: 'https://example.com/login',
                        },
                    },
                    {
                        id: '2',
                        type: 'fill',
                        selector: '#username',
                        value: 'testuser',
                        timestamp: new Date(),
                        duration: 500,
                        action: 'fill',
                        url: 'https://example.com/login',
                        assertion: {
                            type: 'value',
                            expected: 'testuser',
                            actual: 'testuser',
                        },
                    },
                    {
                        id: '3',
                        type: 'fill',
                        selector: '#password',
                        value: 'password123',
                        timestamp: new Date(),
                        duration: 400,
                        action: 'fill',
                        url: 'https://example.com/login',
                        assertion: {
                            type: 'value',
                            expected: 'password123',
                            actual: 'password123',
                        },
                    },
                    {
                        id: '4',
                        type: 'click',
                        selector: '#login-btn',
                        timestamp: new Date(),
                        duration: 200,
                        action: 'click',
                        url: 'https://example.com/login',
                        value: '',
                        assertion: {
                            type: 'navigation',
                            expected: 'https://example.com/dashboard',
                            actual: 'https://example.com/dashboard',
                        },
                    },
                ],
                metadata: {
                    totalSteps: 4,
                    totalDuration: 2100,
                    startTime: new Date(),
                    endTime: new Date(),
                    userAgent: 'test-agent',
                },
            };
            const options = {
                framework: 'playwright',
                language: 'typescript',
                outputDir: './tests',
                includePageObjects: false,
                includeComments: true,
                formatting: {
                    indentSize: 2,
                    useSemicolons: true,
                    singleQuotes: true,
                },
            };
            const result = await generator.generateFromPath(userPath, options);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.files).toHaveLength(1);
            (0, globals_1.expect)(result.files[0].content).toContain("test('Login Flow'");
            (0, globals_1.expect)(result.files[0].content).toContain("await page.goto('https://example.com/login')");
            (0, globals_1.expect)(result.files[0].content).toContain("await page.fill('#username', 'testuser')");
            (0, globals_1.expect)(result.files[0].content).toContain("await page.fill('#password', 'password123')");
            (0, globals_1.expect)(result.files[0].content).toContain("await page.click('#login-btn')");
            (0, globals_1.expect)(result.files[0].content).toContain("expect(page.url()).toBe('https://example.com/dashboard')");
        });
        (0, globals_1.test)('should generate Cypress test with different syntax', async () => {
            const userPath = {
                id: '1',
                startUrl: 'https://example.com',
                title: 'Simple Navigation',
                description: 'Navigate and click',
                steps: [
                    {
                        id: '1',
                        type: 'navigate',
                        url: 'https://example.com',
                        timestamp: new Date(),
                        duration: 1000,
                        selector: '',
                        action: 'navigate',
                        value: '',
                    },
                    {
                        id: '2',
                        type: 'click',
                        selector: '#menu-btn',
                        timestamp: new Date(),
                        duration: 300,
                        action: 'click',
                        url: 'https://example.com',
                        value: '',
                    },
                ],
                metadata: {
                    totalSteps: 2,
                    totalDuration: 1300,
                    startTime: new Date(),
                    endTime: new Date(),
                    userAgent: 'test-agent',
                },
            };
            const cypressGenerator = new TestGenerator_1.TestGenerator('cypress');
            const result = await cypressGenerator.generateFromPath(userPath);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.files[0].content).toContain("cy.visit('https://example.com')");
            (0, globals_1.expect)(result.files[0].content).toContain("cy.get('#menu-btn').click()");
        });
        (0, globals_1.test)('should handle complex interaction patterns', async () => {
            const userPath = {
                id: '1',
                startUrl: 'https://example.com/form',
                title: 'Complex Form',
                description: 'Form with various input types',
                steps: [
                    {
                        id: '1',
                        type: 'select',
                        selector: '#country',
                        value: 'US',
                        timestamp: new Date(),
                        duration: 400,
                        action: 'select',
                        url: 'https://example.com/form',
                    },
                    {
                        id: '2',
                        type: 'check',
                        selector: '#agree-terms',
                        timestamp: new Date(),
                        duration: 200,
                        action: 'check',
                        url: 'https://example.com/form',
                        value: '',
                    },
                    {
                        id: '3',
                        type: 'upload',
                        selector: '#file-input',
                        value: 'test-file.pdf',
                        timestamp: new Date(),
                        duration: 800,
                        action: 'upload',
                        url: 'https://example.com/form',
                    },
                ],
                metadata: {
                    totalSteps: 3,
                    totalDuration: 1400,
                    startTime: new Date(),
                    endTime: new Date(),
                    userAgent: 'test-agent',
                },
            };
            const result = await generator.generateFromPath(userPath);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.files[0].content).toContain("await page.selectOption('#country', 'US')");
            (0, globals_1.expect)(result.files[0].content).toContain("await page.check('#agree-terms')");
            (0, globals_1.expect)(result.files[0].content).toContain("await page.setInputFiles('#file-input', 'test-file.pdf')");
        });
    });
    (0, globals_1.describe)('test generation options', () => {
        (0, globals_1.test)('should include page objects when requested', async () => {
            const userPath = {
                id: '1',
                startUrl: 'https://example.com/login',
                title: 'Login Test',
                description: 'Login with page objects',
                steps: [
                    {
                        id: '1',
                        type: 'fill',
                        selector: '#username',
                        value: 'user',
                        timestamp: new Date(),
                        duration: 500,
                        action: 'fill',
                        url: 'https://example.com/login',
                    },
                ],
                metadata: {
                    totalSteps: 1,
                    totalDuration: 500,
                    startTime: new Date(),
                    endTime: new Date(),
                    userAgent: 'test-agent',
                },
            };
            const options = {
                framework: 'playwright',
                language: 'typescript',
                outputDir: './tests',
                includePageObjects: true,
                includeComments: true,
            };
            const result = await generator.generateFromPath(userPath, options);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.files).toHaveLength(2); // Test file + Page object file
            const pageObjectFile = result.files.find((f) => f.filename.includes('.page.'));
            (0, globals_1.expect)(pageObjectFile).toBeDefined();
            (0, globals_1.expect)(pageObjectFile?.content).toContain('class LoginPage');
            (0, globals_1.expect)(pageObjectFile?.content).toContain('usernameField');
        });
        (0, globals_1.test)('should generate JavaScript instead of TypeScript', async () => {
            const userPath = {
                id: '1',
                startUrl: 'https://example.com',
                title: 'JS Test',
                description: 'JavaScript test',
                steps: [
                    {
                        id: '1',
                        type: 'navigate',
                        url: 'https://example.com',
                        timestamp: new Date(),
                        duration: 1000,
                        selector: '',
                        action: 'navigate',
                        value: '',
                    },
                ],
                metadata: {
                    totalSteps: 1,
                    totalDuration: 1000,
                    startTime: new Date(),
                    endTime: new Date(),
                    userAgent: 'test-agent',
                },
            };
            const options = {
                framework: 'playwright',
                language: 'javascript',
                outputDir: './tests',
            };
            const result = await generator.generateFromPath(userPath, options);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.files[0].filename).toMatch(/\.spec\.js$/);
            (0, globals_1.expect)(result.files[0].content).not.toContain(': Page');
            (0, globals_1.expect)(result.files[0].content).not.toContain('import type');
        });
        (0, globals_1.test)('should apply custom formatting options', async () => {
            const userPath = {
                id: '1',
                startUrl: 'https://example.com',
                title: 'Formatting Test',
                description: 'Test custom formatting',
                steps: [
                    {
                        id: '1',
                        type: 'fill',
                        selector: '#input',
                        value: 'test',
                        timestamp: new Date(),
                        duration: 500,
                        action: 'fill',
                        url: 'https://example.com',
                    },
                ],
                metadata: {
                    totalSteps: 1,
                    totalDuration: 500,
                    startTime: new Date(),
                    endTime: new Date(),
                    userAgent: 'test-agent',
                },
            };
            const options = {
                framework: 'playwright',
                language: 'typescript',
                outputDir: './tests',
                formatting: {
                    indentSize: 4,
                    useSemicolons: false,
                    singleQuotes: false,
                },
            };
            const result = await generator.generateFromPath(userPath, options);
            (0, globals_1.expect)(result.success).toBe(true);
            const { content } = result.files[0];
            // Check for 4-space indentation
            (0, globals_1.expect)(content).toMatch(/\n {4}test\(/);
            // Check for double quotes
            (0, globals_1.expect)(content).toContain('await page.fill("#input", "test")');
        });
    });
    (0, globals_1.describe)('validation integration', () => {
        (0, globals_1.test)('should validate generated tests', async () => {
            const userPath = {
                id: '1',
                startUrl: 'https://example.com',
                title: 'Validation Test',
                description: 'Test validation',
                steps: [
                    {
                        id: '1',
                        type: 'click',
                        selector: '#btn',
                        timestamp: new Date(),
                        duration: 200,
                        action: 'click',
                        url: 'https://example.com',
                        value: '',
                    },
                ],
                metadata: {
                    totalSteps: 1,
                    totalDuration: 200,
                    startTime: new Date(),
                    endTime: new Date(),
                    userAgent: 'test-agent',
                },
            };
            const result = await generator.generateFromPath(userPath);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(mockValidator.validateTestFile).toHaveBeenCalled();
            (0, globals_1.expect)(result.validation).toBeDefined();
            (0, globals_1.expect)(result.validation?.isValid).toBe(true);
        });
        (0, globals_1.test)('should handle validation errors', async () => {
            mockValidator.validateTestFile.mockResolvedValue({
                isValid: false,
                errors: [
                    {
                        type: 'syntax',
                        message: 'Syntax error detected',
                        line: 5,
                        severity: 'error',
                    },
                ],
                warnings: [],
                metrics: {
                    totalTests: 1,
                    totalAssertions: 0,
                    averageTestLength: 10,
                    complexityScore: 20,
                    maintainabilityIndex: 60,
                    duplicateSelectors: [],
                    unusedImports: [],
                },
            });
            const userPath = {
                id: '1',
                startUrl: 'https://example.com',
                title: 'Invalid Test',
                description: 'Test with validation errors',
                steps: [
                    {
                        id: '1',
                        type: 'click',
                        selector: 'invalid-selector',
                        timestamp: new Date(),
                        duration: 200,
                        action: 'click',
                        url: 'https://example.com',
                        value: '',
                    },
                ],
                metadata: {
                    totalSteps: 1,
                    totalDuration: 200,
                    startTime: new Date(),
                    endTime: new Date(),
                    userAgent: 'test-agent',
                },
            };
            const result = await generator.generateFromPath(userPath);
            (0, globals_1.expect)(result.success).toBe(true); // Generation succeeds but validation fails
            (0, globals_1.expect)(result.validation?.isValid).toBe(false);
            (0, globals_1.expect)(result.validation?.errors).toHaveLength(1);
        });
    });
    (0, globals_1.describe)('error handling', () => {
        (0, globals_1.test)('should handle empty user paths', async () => {
            const emptyPath = {
                id: '1',
                startUrl: 'https://example.com',
                title: 'Empty Test',
                description: 'Test with no steps',
                steps: [],
                metadata: {
                    totalSteps: 0,
                    totalDuration: 0,
                    startTime: new Date(),
                    endTime: new Date(),
                    userAgent: 'test-agent',
                },
            };
            const result = await generator.generateFromPath(emptyPath);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.errors).toContain('No steps found in user path');
        });
        (0, globals_1.test)('should handle invalid step types', async () => {
            const invalidPath = {
                id: '1',
                startUrl: 'https://example.com',
                title: 'Invalid Test',
                description: 'Test with invalid step',
                steps: [
                    {
                        id: '1',
                        type: 'invalid-action',
                        selector: '#btn',
                        timestamp: new Date(),
                        duration: 200,
                        action: 'invalid-action',
                        url: 'https://example.com',
                        value: '',
                    },
                ],
                metadata: {
                    totalSteps: 1,
                    totalDuration: 200,
                    startTime: new Date(),
                    endTime: new Date(),
                    userAgent: 'test-agent',
                },
            };
            const result = await generator.generateFromPath(invalidPath);
            (0, globals_1.expect)(result.success).toBe(true); // Should generate with warnings
            (0, globals_1.expect)(result.warnings).toContain('Unknown step type: invalid-action');
        });
        (0, globals_1.test)('should handle unsupported frameworks gracefully', async () => {
            const unsupportedGenerator = new TestGenerator_1.TestGenerator('unsupported');
            const userPath = {
                id: '1',
                startUrl: 'https://example.com',
                title: 'Unsupported Test',
                description: 'Test with unsupported framework',
                steps: [
                    {
                        id: '1',
                        type: 'navigate',
                        url: 'https://example.com',
                        timestamp: new Date(),
                        duration: 1000,
                        selector: '',
                        action: 'navigate',
                        value: '',
                    },
                ],
                metadata: {
                    totalSteps: 1,
                    totalDuration: 1000,
                    startTime: new Date(),
                    endTime: new Date(),
                    userAgent: 'test-agent',
                },
            };
            const result = await unsupportedGenerator.generateFromPath(userPath);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.errors).toContain('Unsupported framework: unsupported');
        });
    });
    (0, globals_1.describe)('batch generation', () => {
        (0, globals_1.test)('should generate multiple tests from multiple paths', async () => {
            const paths = [
                {
                    id: '1',
                    startUrl: 'https://example.com/login',
                    title: 'Login Test',
                    description: 'Login flow',
                    steps: [
                        {
                            id: '1',
                            type: 'fill',
                            selector: '#username',
                            value: 'user',
                            timestamp: new Date(),
                            duration: 500,
                            action: 'fill',
                            url: 'https://example.com/login',
                        },
                    ],
                    metadata: {
                        totalSteps: 1,
                        totalDuration: 500,
                        startTime: new Date(),
                        endTime: new Date(),
                        userAgent: 'test-agent',
                    },
                },
                {
                    id: '2',
                    startUrl: 'https://example.com/signup',
                    title: 'Signup Test',
                    description: 'Signup flow',
                    steps: [
                        {
                            id: '1',
                            type: 'fill',
                            selector: '#email',
                            value: 'test@example.com',
                            timestamp: new Date(),
                            duration: 600,
                            action: 'fill',
                            url: 'https://example.com/signup',
                        },
                    ],
                    metadata: {
                        totalSteps: 1,
                        totalDuration: 600,
                        startTime: new Date(),
                        endTime: new Date(),
                        userAgent: 'test-agent',
                    },
                },
            ];
            const result = await generator.generateFromPaths(paths);
            (0, globals_1.expect)(result.success).toBে(true);
            (0, globals_1.expect)(result.files).toHaveLength(2);
            (0, globals_1.expect)(result.files[0].content).toContain('Login Test');
            (0, globals_1.expect)(result.files[1].content).toContain('Signup Test');
        });
    });
});
//# sourceMappingURL=generator.test.js.map