import { test, expect, describe, beforeEach, vi } from '@jest/globals';
import { TestGenerator } from '../generation/TestGenerator';
import { TestValidator } from '../generation/TestValidator';
import { UserPath, InteractionStep } from '../types/recording';
import { GenerationOptions, TestFramework } from '../types/generation';
import { logger } from '../utils/logger';

vi.mock('../utils/logger');
vi.mock('../generation/TestValidator');

describe('TestGenerator', () => {
  let generator: TestGenerator;
  let mockValidator: jest.Mocked<TestValidator>;

  beforeEach(() => {
    mockValidator = {
      validateTestFile: vi.fn().mockResolvedValue({
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
      }),
      validateTestSuite: vi.fn(),
      validateGeneratedCode: vi.fn(),
    } as any;

    (TestValidator as jest.MockedClass<typeof TestValidator>).mockImplementation(() => mockValidator);
    generator = new TestGenerator();
  });

  describe('initialization', () => {
    test('should initialize with default framework', () => {
      expect(generator).toBeDefined();
    });

    test('should support different frameworks', () => {
      const playwrightGenerator = new TestGenerator('playwright');
      const cypressGenerator = new TestGenerator('cypress');
      const puppeteerGenerator = new TestGenerator('puppeteer');

      expect(playwrightGenerator).toBeDefined();
      expect(cypressGenerator).toBeDefined();
      expect(puppeteerGenerator).toBeDefined();
    });
  });

  describe('test generation from user paths', () => {
    test('should generate Playwright test from simple user path', async () => {
      const userPath: UserPath = {
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

      const options: GenerationOptions = {
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

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(1);
      expect(result.files[0].content).toContain('test(\'Login Flow\'');
      expect(result.files[0].content).toContain('await page.goto(\'https://example.com/login\')');
      expect(result.files[0].content).toContain('await page.fill(\'#username\', \'testuser\')');
      expect(result.files[0].content).toContain('await page.fill(\'#password\', \'password123\')');
      expect(result.files[0].content).toContain('await page.click(\'#login-btn\')');
      expect(result.files[0].content).toContain('expect(page.url()).toBe(\'https://example.com/dashboard\')');
    });

    test('should generate Cypress test with different syntax', async () => {
      const userPath: UserPath = {
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

      const cypressGenerator = new TestGenerator('cypress');
      const result = await cypressGenerator.generateFromPath(userPath);

      expect(result.success).toBe(true);
      expect(result.files[0].content).toContain('cy.visit(\'https://example.com\')');
      expect(result.files[0].content).toContain('cy.get(\'#menu-btn\').click()');
    });

    test('should handle complex interaction patterns', async () => {
      const userPath: UserPath = {
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

      expect(result.success).toBe(true);
      expect(result.files[0].content).toContain('await page.selectOption(\'#country\', \'US\')');
      expect(result.files[0].content).toContain('await page.check(\'#agree-terms\')');
      expect(result.files[0].content).toContain('await page.setInputFiles(\'#file-input\', \'test-file.pdf\')');
    });
  });

  describe('test generation options', () => {
    test('should include page objects when requested', async () => {
      const userPath: UserPath = {
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

      const options: GenerationOptions = {
        framework: 'playwright',
        language: 'typescript',
        outputDir: './tests',
        includePageObjects: true,
        includeComments: true,
      };

      const result = await generator.generateFromPath(userPath, options);

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(2); // Test file + Page object file
      
      const pageObjectFile = result.files.find(f => f.filename.includes('.page.'));
      expect(pageObjectFile).toBeDefined();
      expect(pageObjectFile?.content).toContain('class LoginPage');
      expect(pageObjectFile?.content).toContain('usernameField');
    });

    test('should generate JavaScript instead of TypeScript', async () => {
      const userPath: UserPath = {
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

      const options: GenerationOptions = {
        framework: 'playwright',
        language: 'javascript',
        outputDir: './tests',
      };

      const result = await generator.generateFromPath(userPath, options);

      expect(result.success).toBe(true);
      expect(result.files[0].filename).toMatch(/\.spec\.js$/);
      expect(result.files[0].content).not.toContain(': Page');
      expect(result.files[0].content).not.toContain('import type');
    });

    test('should apply custom formatting options', async () => {
      const userPath: UserPath = {
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

      const options: GenerationOptions = {
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

      expect(result.success).toBe(true);
      const content = result.files[0].content;
      
      // Check for 4-space indentation
      expect(content).toMatch(/\n    test\(/);
      // Check for double quotes
      expect(content).toContain('await page.fill("#input", "test")');
    });
  });

  describe('validation integration', () => {
    test('should validate generated tests', async () => {
      const userPath: UserPath = {
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

      expect(result.success).toBe(true);
      expect(mockValidator.validateTestFile).toHaveBeenCalled();
      expect(result.validation).toBeDefined();
      expect(result.validation?.isValid).toBe(true);
    });

    test('should handle validation errors', async () => {
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

      const userPath: UserPath = {
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

      expect(result.success).toBe(true); // Generation succeeds but validation fails
      expect(result.validation?.isValid).toBe(false);
      expect(result.validation?.errors).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    test('should handle empty user paths', async () => {
      const emptyPath: UserPath = {
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

      expect(result.success).toBe(false);
      expect(result.errors).toContain('No steps found in user path');
    });

    test('should handle invalid step types', async () => {
      const invalidPath: UserPath = {
        id: '1',
        startUrl: 'https://example.com',
        title: 'Invalid Test',
        description: 'Test with invalid step',
        steps: [
          {
            id: '1',
            type: 'invalid-action' as any,
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

      expect(result.success).toBe(true); // Should generate with warnings
      expect(result.warnings).toContain('Unknown step type: invalid-action');
    });

    test('should handle unsupported frameworks gracefully', async () => {
      const unsupportedGenerator = new TestGenerator('unsupported' as TestFramework);
      
      const userPath: UserPath = {
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

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Unsupported framework: unsupported');
    });
  });

  describe('batch generation', () => {
    test('should generate multiple tests from multiple paths', async () => {
      const paths: UserPath[] = [
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

      expect(result.success).toBে(true);
      expect(result.files).toHaveLength(2);
      expect(result.files[0].content).toContain('Login Test');
      expect(result.files[1].content).toContain('Signup Test');
    });
  });
});