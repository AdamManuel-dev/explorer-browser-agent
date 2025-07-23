"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const TestValidator_1 = require("../generation/TestValidator");
globals_1.jest.mock('../utils/logger');
globals_1.jest.mock('fs/promises');
(0, globals_1.describe)('TestValidator', () => {
    let validator;
    (0, globals_1.beforeEach)(() => {
        validator = new TestValidator_1.TestValidator('playwright');
    });
    (0, globals_1.describe)('initialization', () => {
        (0, globals_1.test)('should initialize with default framework', () => {
            const defaultValidator = new TestValidator_1.TestValidator();
            (0, globals_1.expect)(defaultValidator).toBeDefined();
        });
        (0, globals_1.test)('should support different frameworks', () => {
            const playwrightValidator = new TestValidator_1.TestValidator('playwright');
            const cypressValidator = new TestValidator_1.TestValidator('cypress');
            const puppeteerValidator = new TestValidator_1.TestValidator('puppeteer');
            (0, globals_1.expect)(playwrightValidator).toBeDefined();
            (0, globals_1.expect)(cypressValidator).toBeDefined();
            (0, globals_1.expect)(puppeteerValidator).toBeDefined();
        });
    });
    (0, globals_1.describe)('syntax validation', () => {
        (0, globals_1.test)('should validate correct Playwright test syntax', async () => {
            const testFile = {
                filename: 'login.spec.ts',
                path: './tests/login.spec.ts',
                content: `
import { test, expect } from '@playwright/test';

test('login flow', async ({ page }) => {
  await page.goto('https://example.com/login');
  await page.fill('#username', 'testuser');
  await page.fill('#password', 'password123');
  await page.click('#login-btn');
  await expect(page).toHaveURL('https://example.com/dashboard');
});
        `,
                type: 'test',
                metadata: {
                    generatedAt: new Date(),
                    sourcePath: {},
                    framework: 'playwright',
                    language: 'typescript',
                    dependencies: ['@playwright/test'],
                },
            };
            const result = await validator.validateTestFile(testFile);
            (0, globals_1.expect)(result.isValid).toBe(true);
            (0, globals_1.expect)(result.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
            (0, globals_1.expect)(result.metrics.totalTests).toBe(1);
            (0, globals_1.expect)(result.metrics.totalAssertions).toBe(1);
        });
        (0, globals_1.test)('should detect missing semicolons', async () => {
            const testFile = {
                filename: 'test.spec.ts',
                path: './tests/test.spec.ts',
                content: `
import { test, expect } from '@playwright/test'

test('missing semicolons', async ({ page }) => {
  await page.goto('https://example.com')
  await page.click('#button')
})
        `,
                type: 'test',
                metadata: {
                    generatedAt: new Date(),
                    sourcePath: {},
                    framework: 'playwright',
                    language: 'typescript',
                    dependencies: ['@playwright/test'],
                },
            };
            const result = await validator.validateTestFile(testFile);
            const semicolonWarnings = result.errors.filter((e) => e.type === 'syntax' && e.message.includes('semicolon'));
            (0, globals_1.expect)(semicolonWarnings.length).toBeGreaterThan(0);
        });
        (0, globals_1.test)('should detect await usage outside async functions', async () => {
            const testFile = {
                filename: 'invalid.spec.ts',
                path: './tests/invalid.spec.ts',
                content: `
import { test, expect } from '@playwright/test';

test('invalid await usage', ({ page }) => {
  await page.goto('https://example.com');
});
        `,
                type: 'test',
                metadata: {
                    generatedAt: new Date(),
                    sourcePath: {},
                    framework: 'playwright',
                    language: 'typescript',
                    dependencies: ['@playwright/test'],
                },
            };
            const result = await validator.validateTestFile(testFile);
            const awaitErrors = result.errors.filter((e) => e.type === 'syntax' && e.message.includes('await used outside async function'));
            (0, globals_1.expect)(awaitErrors.length).toBeGreaterThan(0);
            (0, globals_1.expect)(awaitErrors[0]?.severity).toBe('error');
        });
    });
    (0, globals_1.describe)('import validation', () => {
        (0, globals_1.test)('should detect missing required imports', async () => {
            const testFile = {
                filename: 'missing-imports.spec.ts',
                path: './tests/missing-imports.spec.ts',
                content: `
test('test without imports', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveURL('https://example.com');
});
        `,
                type: 'test',
                metadata: {
                    generatedAt: new Date(),
                    sourcePath: {},
                    framework: 'playwright',
                    language: 'typescript',
                    dependencies: [],
                },
            };
            const result = await validator.validateTestFile(testFile);
            const importErrors = result.errors.filter((e) => e.type === 'import');
            (0, globals_1.expect)(importErrors.length).toBeGreaterThan(0);
            (0, globals_1.expect)(importErrors[0]?.message).toContain('Missing required import');
        });
        (0, globals_1.test)('should detect unused imports', async () => {
            const testFile = {
                filename: 'unused-imports.spec.ts',
                path: './tests/unused-imports.spec.ts',
                content: `
import { test, expect, Browser } from '@playwright/test';

test('test with unused import', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveURL('https://example.com');
});
        `,
                type: 'test',
                metadata: {
                    generatedAt: new Date(),
                    sourcePath: {},
                    framework: 'playwright',
                    language: 'typescript',
                    dependencies: ['@playwright/test'],
                },
            };
            const result = await validator.validateTestFile(testFile);
            const unusedImportWarnings = result.errors.filter((e) => e.type === 'import' && e.message.includes('Unused import'));
            (0, globals_1.expect)(unusedImportWarnings.length).toBeGreaterThan(0);
            (0, globals_1.expect)(result.metrics.unusedImports).toContain('Browser');
        });
    });
    (0, globals_1.describe)('selector validation', () => {
        (0, globals_1.test)('should warn about fragile selectors', async () => {
            const testFile = {
                filename: 'fragile-selectors.spec.ts',
                path: './tests/fragile-selectors.spec.ts',
                content: `
import { test, expect } from '@playwright/test';

test('test with fragile selectors', async ({ page }) => {
  await page.goto('https://example.com');
  await page.click('div:nth-child(3) > button:nth-child(2)');
  await page.click('.css-abc123');
  await page.locator('[class*="generated-123"]').click();
});
        `,
                type: 'test',
                metadata: {
                    generatedAt: new Date(),
                    sourcePath: {},
                    framework: 'playwright',
                    language: 'typescript',
                    dependencies: ['@playwright/test'],
                },
            };
            const result = await validator.validateTestFile(testFile);
            const fragileWarnings = result.warnings.filter((w) => w.type === 'maintainability' && w.message.includes('Fragile selector'));
            (0, globals_1.expect)(fragileWarnings.length).toBeGreaterThan(0);
        });
        (0, globals_1.test)('should detect duplicate selectors', async () => {
            const testFile = {
                filename: 'duplicate-selectors.spec.ts',
                path: './tests/duplicate-selectors.spec.ts',
                content: `
import { test, expect } from '@playwright/test';

test('test with duplicate selectors', async ({ page }) => {
  await page.goto('https://example.com');
  await page.locator('#submit-btn').click();
  await page.locator('#submit-btn').waitFor();
  await page.locator('#submit-btn').isVisible();
  await page.locator('#submit-btn').textContent();
  await expect(page.locator('#submit-btn')).toBeVisible();
});
        `,
                type: 'test',
                metadata: {
                    generatedAt: new Date(),
                    sourcePath: {},
                    framework: 'playwright',
                    language: 'typescript',
                    dependencies: ['@playwright/test'],
                },
            };
            const result = await validator.validateTestFile(testFile);
            const duplicateWarnings = result.warnings.filter((w) => w.message.includes('Selector used') && w.message.includes('times'));
            (0, globals_1.expect)(duplicateWarnings.length).toBeGreaterThan(0);
            (0, globals_1.expect)(result.metrics.duplicateSelectors).toContain('#submit-btn');
        });
        (0, globals_1.test)('should suggest data-testid usage', async () => {
            const testFile = {
                filename: 'class-selectors.spec.ts',
                path: './tests/class-selectors.spec.ts',
                content: `
import { test, expect } from '@playwright/test';

test('test with class selectors', async ({ page }) => {
  await page.goto('https://example.com');
  await page.locator('.button-primary').click();
  await page.locator('.form-input').fill('test');
});
        `,
                type: 'test',
                metadata: {
                    generatedAt: new Date(),
                    sourcePath: {},
                    framework: 'playwright',
                    language: 'typescript',
                    dependencies: ['@playwright/test'],
                },
            };
            const result = await validator.validateTestFile(testFile);
            const testidSuggestions = result.warnings.filter((w) => w.message.includes('Consider using data-testid'));
            (0, globals_1.expect)(testidSuggestions.length).toBeGreaterThan(0);
        });
    });
    (0, globals_1.describe)('assertion validation', () => {
        (0, globals_1.test)('should detect tests without assertions', async () => {
            const testFile = {
                filename: 'no-assertions.spec.ts',
                path: './tests/no-assertions.spec.ts',
                content: `
import { test, expect } from '@playwright/test';

test('test without assertions', async ({ page }) => {
  await page.goto('https://example.com');
  await page.click('#button');
  await page.fill('#input', 'value');
});
        `,
                type: 'test',
                metadata: {
                    generatedAt: new Date(),
                    sourcePath: {},
                    framework: 'playwright',
                    language: 'typescript',
                    dependencies: ['@playwright/test'],
                },
            };
            const result = await validator.validateTestFile(testFile);
            const noAssertionErrors = result.errors.filter((e) => e.type === 'assertion' && e.message.includes('has no assertions'));
            (0, globals_1.expect)(noAssertionErrors.length).toBeGreaterThan(0);
        });
        (0, globals_1.test)('should detect weak assertions', async () => {
            const testFile = {
                filename: 'weak-assertions.spec.ts',
                path: './tests/weak-assertions.spec.ts',
                content: `
import { test, expect } from '@playwright/test';

test('test with weak assertions', async ({ page }) => {
  await page.goto('https://example.com');
  const element = page.locator('#element');
  expect(element).toBeTruthy();
  expect(await element.isVisible()).toBeFalsy();
});
        `,
                type: 'test',
                metadata: {
                    generatedAt: new Date(),
                    sourcePath: {},
                    framework: 'playwright',
                    language: 'typescript',
                    dependencies: ['@playwright/test'],
                },
            };
            const result = await validator.validateTestFile(testFile);
            const weakAssertionWarnings = result.errors.filter((e) => e.type === 'assertion' && e.message.includes('Weak assertion'));
            (0, globals_1.expect)(weakAssertionWarnings.length).toBeGreaterThan(0);
        });
        (0, globals_1.test)('should classify assertion types correctly', async () => {
            const testFile = {
                filename: 'assertion-types.spec.ts',
                path: './tests/assertion-types.spec.ts',
                content: `
import { test, expect } from '@playwright/test';

test('test with various assertions', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page.locator('#element')).toBeVisible();
  await expect(page.locator('#input')).toHaveValue('test');
  await expect(page.locator('#text')).toHaveText('Hello');
  await expect(page).toHaveURL('https://example.com');
});
        `,
                type: 'test',
                metadata: {
                    generatedAt: new Date(),
                    sourcePath: {},
                    framework: 'playwright',
                    language: 'typescript',
                    dependencies: ['@playwright/test'],
                },
            };
            const result = await validator.validateTestFile(testFile);
            (0, globals_1.expect)(result.metrics.totalAssertions).toBe(4);
        });
    });
    (0, globals_1.describe)('best practices validation', () => {
        (0, globals_1.test)('should warn about page.goto in tests', async () => {
            const testFile = {
                filename: 'goto-in-test.spec.ts',
                path: './tests/goto-in-test.spec.ts',
                content: `
import { test, expect } from '@playwright/test';

test('test with goto in test', async ({ page }) => {
  await page.goto('https://example.com/page1');
  await page.click('#button1');
});

test('another test with goto', async ({ page }) => {
  await page.goto('https://example.com/page2');
  await page.click('#button2');
});
        `,
                type: 'test',
                metadata: {
                    generatedAt: new Date(),
                    sourcePath: {},
                    framework: 'playwright',
                    language: 'typescript',
                    dependencies: ['@playwright/test'],
                },
            };
            const result = await validator.validateTestFile(testFile);
            const gotoWarnings = result.warnings.filter((w) => w.message.includes('Consider moving page.goto to beforeEach'));
            (0, globals_1.expect)(gotoWarnings.length).toBe(2);
        });
        (0, globals_1.test)('should warn about long tests', async () => {
            const longTestContent = Array.from({ length: 60 }, (_, i) => `  await page.click('#button-${i}');`).join('\n');
            const testFile = {
                filename: 'long-test.spec.ts',
                path: './tests/long-test.spec.ts',
                content: `
import { test, expect } from '@playwright/test';

test('very long test', async ({ page }) => {
  await page.goto('https://example.com');
${longTestContent}
  await expect(page).toHaveURL('https://example.com');
});
        `,
                type: 'test',
                metadata: {
                    generatedAt: new Date(),
                    sourcePath: {},
                    framework: 'playwright',
                    language: 'typescript',
                    dependencies: ['@playwright/test'],
                },
            };
            const result = await validator.validateTestFile(testFile);
            const longTestWarnings = result.warnings.filter((w) => w.message.includes('is very long'));
            (0, globals_1.expect)(longTestWarnings.length).toBeGreaterThan(0);
        });
    });
    (0, globals_1.describe)('metrics calculation', () => {
        (0, globals_1.test)('should calculate comprehensive metrics', async () => {
            const testFile = {
                filename: 'metrics-test.spec.ts',
                path: './tests/metrics-test.spec.ts',
                content: `
import { test, expect } from '@playwright/test';

test('first test', async ({ page }) => {
  await page.goto('https://example.com');
  await page.click('#button1');
  await expect(page.locator('#result')).toBeVisible();
  await expect(page.locator('#result')).toHaveText('Success');
});

test('second test', async ({ page }) => {
  await page.goto('https://example.com/page2');
  await page.fill('#input', 'test');
  await page.click('#submit');
  await expect(page).toHaveURL('https://example.com/success');
});
        `,
                type: 'test',
                metadata: {
                    generatedAt: new Date(),
                    sourcePath: {},
                    framework: 'playwright',
                    language: 'typescript',
                    dependencies: ['@playwright/test'],
                },
            };
            const result = await validator.validateTestFile(testFile);
            (0, globals_1.expect)(result.metrics.totalTests).toBe(2);
            (0, globals_1.expect)(result.metrics.totalAssertions).toBe(3);
            (0, globals_1.expect)(result.metrics.averageTestLength).toBeGreaterThan(0);
            (0, globals_1.expect)(result.metrics.complexityScore).toBeGreaterThan(0);
            (0, globals_1.expect)(result.metrics.maintainabilityIndex).toBeGreaterThan(0);
        });
        (0, globals_1.test)('should calculate maintainability index correctly', async () => {
            const testFile = {
                filename: 'maintainable-test.spec.ts',
                path: './tests/maintainable-test.spec.ts',
                content: `
import { test, expect } from '@playwright/test';

test('well-written test', async ({ page }) => {
  await page.goto('https://example.com');
  await page.locator('[data-testid="username"]').fill('user');
  await page.locator('[data-testid="password"]').fill('pass');
  await page.locator('[data-testid="submit"]').click();
  await expect(page).toHaveURL('https://example.com/dashboard');
});
        `,
                type: 'test',
                metadata: {
                    generatedAt: new Date(),
                    sourcePath: {},
                    framework: 'playwright',
                    language: 'typescript',
                    dependencies: ['@playwright/test'],
                },
            };
            const result = await validator.validateTestFile(testFile);
            (0, globals_1.expect)(result.metrics.maintainabilityIndex).toBeGreaterThan(80);
            (0, globals_1.expect)(result.metrics.duplicateSelectors).toHaveLength(0);
        });
    });
    (0, globals_1.describe)('test suite validation', () => {
        (0, globals_1.test)('should validate multiple test files', async () => {
            const testFiles = [
                {
                    filename: 'login.spec.ts',
                    path: './tests/login.spec.ts',
                    content: `
import { test, expect } from '@playwright/test';

test('login test', async ({ page }) => {
  await page.goto('https://example.com/login');
  await expect(page).toHaveTitle('Login');
});
          `,
                    type: 'test',
                    metadata: {
                        generatedAt: new Date(),
                        sourcePath: {},
                        framework: 'playwright',
                        language: 'typescript',
                        dependencies: ['@playwright/test'],
                    },
                },
                {
                    filename: 'signup.spec.ts',
                    path: './tests/signup.spec.ts',
                    content: `
import { test, expect } from '@playwright/test';

test('signup test', async ({ page }) => {
  await page.goto('https://example.com/signup');
  await expect(page).toHaveTitle('Sign Up');
});
          `,
                    type: 'test',
                    metadata: {
                        generatedAt: new Date(),
                        sourcePath: {},
                        framework: 'playwright',
                        language: 'typescript',
                        dependencies: ['@playwright/test'],
                    },
                },
            ];
            const result = await validator.validateTestSuite(testFiles);
            (0, globals_1.expect)(result.isValid).toBe(true);
            (0, globals_1.expect)(result.metrics.totalTests).toBe(2);
            (0, globals_1.expect)(result.metrics.totalAssertions).toBe(2);
        });
        (0, globals_1.test)('should check naming consistency', async () => {
            const testFiles = [
                {
                    filename: 'login.spec.ts',
                    path: './tests/login.spec.ts',
                    content: 'import { test } from "@playwright/test";',
                    type: 'test',
                    metadata: {
                        generatedAt: new Date(),
                        sourcePath: {},
                        framework: 'playwright',
                        language: 'typescript',
                        dependencies: ['@playwright/test'],
                    },
                },
                {
                    filename: 'signup.test.ts', // Different naming pattern
                    path: './tests/signup.test.ts',
                    content: 'import { test } from "@playwright/test";',
                    type: 'test',
                    metadata: {
                        generatedAt: new Date(),
                        sourcePath: {},
                        framework: 'playwright',
                        language: 'typescript',
                        dependencies: ['@playwright/test'],
                    },
                },
                {
                    filename: 'profile.e2e.ts', // Another different pattern
                    path: './tests/profile.e2e.ts',
                    content: 'import { test } from "@playwright/test";',
                    type: 'test',
                    metadata: {
                        generatedAt: new Date(),
                        sourcePath: {},
                        framework: 'playwright',
                        language: 'typescript',
                        dependencies: ['@playwright/test'],
                    },
                },
            ];
            const result = await validator.validateTestSuite(testFiles);
            const namingWarnings = result.warnings.filter((w) => w.message.includes('Inconsistent test file naming'));
            (0, globals_1.expect)(namingWarnings.length).toBeGreaterThan(0);
        });
    });
    (0, globals_1.describe)('error handling', () => {
        (0, globals_1.test)('should handle syntax validation errors gracefully', async () => {
            const testFile = {
                filename: 'invalid.spec.ts',
                path: './tests/invalid.spec.ts',
                content: `
import { test, expect } from '@playwright/test';

test('test with syntax error', async ({ page }) => {
  await page.goto('https://example.com'
  // Missing closing parenthesis and semicolon
});
        `,
                type: 'test',
                metadata: {
                    generatedAt: new Date(),
                    sourcePath: {},
                    framework: 'playwright',
                    language: 'typescript',
                    dependencies: ['@playwright/test'],
                },
            };
            const result = await validator.validateTestFile(testFile);
            (0, globals_1.expect)(result.isValid).toBe(false);
            (0, globals_1.expect)(result.errors.length).toBeGreaterThan(0);
        });
        (0, globals_1.test)('should handle validation exceptions', async () => {
            const testFile = {
                filename: 'exception.spec.ts',
                path: './tests/exception.spec.ts',
                content: '', // Empty content that might cause issues
                type: 'test',
                metadata: {
                    generatedAt: new Date(),
                    sourcePath: {},
                    framework: 'playwright',
                    language: 'typescript',
                    dependencies: ['@playwright/test'],
                },
            };
            const result = await validator.validateTestFile(testFile);
            (0, globals_1.expect)(result.isValid).toBe(false);
        });
    });
    (0, globals_1.describe)('generated code validation', () => {
        (0, globals_1.test)('should validate raw code strings', async () => {
            const code = `
import { test, expect } from '@playwright/test';

test('generated test', async ({ page }) => {
  await page.goto('https://example.com');
  await page.click('#button');
  await expect(page.locator('#result')).toBeVisible();
});
      `;
            const result = await validator.validateGeneratedCode(code, 'generated.spec.ts');
            (0, globals_1.expect)(result.isValid).toBe(true);
            (0, globals_1.expect)(result.metrics.totalTests).toBe(1);
            (0, globals_1.expect)(result.metrics.totalAssertions).toBe(1);
        });
    });
});
//# sourceMappingURL=validator.test.js.map