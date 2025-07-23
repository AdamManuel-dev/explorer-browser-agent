# Test Generation Module

The test generation module converts recorded user interactions into comprehensive, maintainable test suites using industry best practices and modern testing frameworks.

## Components

### TestGenerator

The core test generation engine that transforms user paths into executable test code.

**Features:**
- **Multi-framework support**: Playwright, Cypress, Selenium WebDriver
- **Multiple languages**: TypeScript, JavaScript, Python, Java
- **Page Object Model**: Automatic generation of maintainable page objects
- **Test data generation**: Realistic test data using Faker.js
- **Assertion generation**: Smart assertion inference from user interactions
- **Code organization**: Proper test structure with helpers and utilities

### PageObjectGenerator

Generates maintainable Page Object Model classes for better test organization.

### TestFileWriter

Handles file system operations for creating test project structures.

### TestDataGenerator

Creates realistic test data for form filling and testing scenarios.

### TestValidator

Validates generated test code for syntax errors and best practices.

## Usage

### Basic Test Generation

```typescript
import { TestGenerator } from './generation';

const generator = new TestGenerator({
  framework: 'playwright',
  language: 'typescript',
  outputDirectory: './tests',
  generatePageObjects: true,
  generateFixtures: true,
  generateHelpers: true,
});

// User path from recording
const userPath = {
  id: 'login-workflow',
  name: 'User Login Flow',
  startUrl: 'https://app.example.com',
  steps: [
    {
      type: 'navigate',
      url: 'https://app.example.com/login',
      timestamp: new Date(),
    },
    {
      type: 'fill',
      selector: '#email',
      value: 'user@example.com',
      timestamp: new Date(),
    },
    {
      type: 'fill',
      selector: '#password',
      value: 'password123',
      timestamp: new Date(),
    },
    {
      type: 'click',
      selector: '#login-button',
      timestamp: new Date(),
    },
  ],
  assertions: [
    {
      type: 'visible',
      selector: '.dashboard',
      expected: true,
    },
  ],
  duration: 5000,
  metadata: {
    browser: 'chromium',
    viewport: { width: 1280, height: 720 },
  },
  createdAt: new Date(),
};

const result = await generator.generate(userPath);
console.log(`Generated ${result.files.length} test files`);
```

### Advanced Configuration

```typescript
const advancedGenerator = new TestGenerator({
  framework: 'playwright',
  language: 'typescript',
  outputDirectory: './e2e-tests',
  
  // Page Object Model configuration
  generatePageObjects: true,
  pageObjectsDirectory: './pages',
  pageObjectNaming: 'PascalCase',
  
  // Test organization
  groupRelatedTests: true,
  testNamingConvention: 'describe-it',
  useAAAPattern: true, // Arrange-Act-Assert
  
  // Code quality
  addComments: true,
  generateJSDoc: true,
  includeTypeDefinitions: true,
  
  // Test data
  generateFixtures: true,
  fixturesDirectory: './fixtures',
  useRealisticData: true,
  
  // Utilities
  generateHelpers: true,
  helpersDirectory: './helpers',
  
  // Code formatting
  formatting: {
    indentSize: 2,
    singleQuotes: true,
    semicolons: true,
    trailingCommas: true,
  },
});
```

## Framework Support

### Playwright Tests

Generated Playwright test example:

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { testData } from '../fixtures/userData';

test.describe('User Login Flow', () => {
  test('should successfully log in with valid credentials', async ({ page }) => {
    // Arrange
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    
    // Act
    await loginPage.navigate();
    await loginPage.fillEmail(testData.validUser.email);
    await loginPage.fillPassword(testData.validUser.password);
    await loginPage.clickLoginButton();
    
    // Assert
    await expect(dashboardPage.dashboardContainer).toBeVisible();
    await expect(page).toHaveURL(/.*dashboard/);
  });
});
```

### Cypress Tests

Generated Cypress test example:

```typescript
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';

describe('User Login Flow', () => {
  const loginPage = new LoginPage();
  const dashboardPage = new DashboardPage();
  
  it('should successfully log in with valid credentials', () => {
    // Arrange
    cy.fixture('userData').then((testData) => {
      
      // Act
      loginPage.visit();
      loginPage.fillEmail(testData.validUser.email);
      loginPage.fillPassword(testData.validUser.password);
      loginPage.clickLoginButton();
      
      // Assert
      dashboardPage.getDashboardContainer().should('be.visible');
      cy.url().should('include', '/dashboard');
    });
  });
});
```

### Selenium WebDriver

Generated Selenium test example:

```java
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import static org.junit.jupiter.api.Assertions.*;
import pages.LoginPage;
import pages.DashboardPage;
import data.TestData;

public class UserLoginFlowTest {
    private WebDriver driver;
    private LoginPage loginPage;
    private DashboardPage dashboardPage;
    
    @BeforeEach
    void setUp() {
        driver = new ChromeDriver();
        loginPage = new LoginPage(driver);
        dashboardPage = new DashboardPage(driver);
    }
    
    @Test
    void shouldSuccessfullyLogInWithValidCredentials() {
        // Arrange
        TestData testData = new TestData();
        
        // Act
        loginPage.navigate();
        loginPage.fillEmail(testData.getValidUser().getEmail());
        loginPage.fillPassword(testData.getValidUser().getPassword());
        loginPage.clickLoginButton();
        
        // Assert
        assertTrue(dashboardPage.isDashboardVisible());
        assertTrue(driver.getCurrentUrl().contains("/dashboard"));
    }
}
```

## Page Object Model Generation

### Automatic Page Detection

```typescript
// Generator automatically identifies page boundaries
const pageObjects = generator.identifyPages(userPath);

// Generated page objects:
// - LoginPage.ts (login form interactions)
// - DashboardPage.ts (dashboard elements)
// - NavigationPage.ts (common navigation elements)
```

### Generated Page Object Example

```typescript
import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('#email');
    this.passwordInput = page.locator('#password');
    this.loginButton = page.locator('#login-button');
    this.errorMessage = page.locator('.error-message');
  }

  /**
   * Navigate to the login page
   */
  async navigate(): Promise<void> {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Fill the email input field
   * @param email - Email address to enter
   */
  async fillEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  /**
   * Fill the password input field
   * @param password - Password to enter
   */
  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  /**
   * Click the login button
   */
  async clickLoginButton(): Promise<void> {
    await this.loginButton.click();
  }

  /**
   * Check if error message is visible
   */
  async isErrorVisible(): Promise<boolean> {
    return await this.errorMessage.isVisible();
  }

  /**
   * Get error message text
   */
  async getErrorText(): Promise<string | null> {
    return await this.errorMessage.textContent();
  }
}
```

## Test Data Generation

### Realistic Test Data

```typescript
import { TestDataGenerator } from './generation';

const dataGenerator = new TestDataGenerator({
  locale: 'en_US',
  seed: 12345, // For reproducible data
  
  customProviders: {
    companyEmail: (company: string) => `test@${company.toLowerCase()}.com`,
    phoneNumber: () => '+1-555-' + Math.random().toString().substr(2, 7),
  },
});

// Generated fixture file
const userData = {
  validUser: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    password: 'SecurePass123!',
    phone: '+1-555-0123456',
    dateOfBirth: '1990-05-15',
    address: {
      street: '123 Main Street',
      city: 'Anytown',
      state: 'CA',
      zipCode: '90210',
      country: 'United States',
    },
  },
  
  invalidUser: {
    email: 'invalid-email',
    password: '123', // Too short
    phone: 'not-a-phone',
  },
  
  testProducts: [
    {
      name: 'Test Product 1',
      price: 29.99,
      sku: 'TST-001',
      category: 'Electronics',
    },
    {
      name: 'Test Product 2',
      price: 49.99,
      sku: 'TST-002',
      category: 'Books',
    },
  ],
};
```

### Dynamic Data Generation

```typescript
// Generate data based on form fields
const formData = await dataGenerator.generateForForm(formElements);

// Example output:
{
  '#first-name': 'Alice',
  '#last-name': 'Johnson',
  '#email': 'alice.johnson@example.com',
  '#phone': '+1-555-7890123',
  '#company': 'Tech Solutions Inc.',
  '#job-title': 'Software Engineer',
}
```

## Assertion Generation

### Smart Assertion Inference

```typescript
// Generator automatically infers assertions from user actions
const assertions = generator.inferAssertions(userPath);

// Generated assertions:
// - URL changes after navigation
// - Elements become visible after successful actions
// - Form validations trigger on invalid input
// - Content changes after data submission
```

### Assertion Types

```typescript
// Visual assertions
await expect(page.locator('.success-message')).toBeVisible();
await expect(page.locator('.error-message')).toBeHidden();

// Content assertions
await expect(page.locator('.username')).toHaveText('John Doe');
await expect(page.locator('.balance')).toContainText('$1,234.56');

// Attribute assertions
await expect(page.locator('#submit-btn')).toBeEnabled();
await expect(page.locator('#email')).toHaveValue('user@example.com');

// Navigation assertions
await expect(page).toHaveURL(/.*dashboard/);
await expect(page).toHaveTitle(/Dashboard - App/);

// API assertions (if network monitoring enabled)
await expect(response.status()).toBe(200);
await expect(response.json()).toEqual(expect.objectContaining({
  success: true,
  userId: expect.any(Number),
}));
```

## Code Organization

### Project Structure

```
tests/
├── specs/
│   ├── auth/
│   │   ├── login.spec.ts
│   │   └── registration.spec.ts
│   ├── dashboard/
│   │   └── user-dashboard.spec.ts
│   └── checkout/
│       └── purchase-flow.spec.ts
├── pages/
│   ├── LoginPage.ts
│   ├── DashboardPage.ts
│   └── CheckoutPage.ts
├── fixtures/
│   ├── userData.json
│   ├── productData.json
│   └── testConfig.json
├── helpers/
│   ├── authHelper.ts
│   ├── dataHelper.ts
│   └── apiHelper.ts
└── config/
    ├── playwright.config.ts
    └── test.config.ts
```

### Helper Utilities

```typescript
// Generated helper utilities
export class AuthHelper {
  static async loginAsAdmin(page: Page): Promise<void> {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.fillEmail('admin@example.com');
    await loginPage.fillPassword('admin123');
    await loginPage.clickLoginButton();
  }
  
  static async loginAsUser(page: Page, userType: 'premium' | 'basic' = 'basic'): Promise<void> {
    const userData = await import('../fixtures/userData.json');
    const user = userData[userType + 'User'];
    
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.fillEmail(user.email);
    await loginPage.fillPassword(user.password);
    await loginPage.clickLoginButton();
  }
}

export class DataHelper {
  static generateUniqueEmail(): string {
    const timestamp = Date.now();
    return `test.user.${timestamp}@example.com`;
  }
  
  static async createTestUser(): Promise<TestUser> {
    const faker = await import('@faker-js/faker');
    return {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: this.generateUniqueEmail(),
      password: 'TestPass123!',
    };
  }
}
```

## Configuration Options

### Complete Configuration Interface

```typescript
interface GenerationOptions {
  // Framework and language
  framework: 'playwright' | 'cypress' | 'selenium';
  language: 'typescript' | 'javascript' | 'python' | 'java';
  
  // Output configuration
  outputDirectory: string;
  overwriteExisting: boolean;
  
  // Page objects
  generatePageObjects: boolean;
  pageObjectsDirectory: string;
  pageObjectNaming: 'camelCase' | 'PascalCase' | 'snake_case';
  
  // Test organization
  groupRelatedTests: boolean;
  testNamingConvention: 'describe-it' | 'class-method' | 'function';
  useAAAPattern: boolean; // Arrange-Act-Assert
  
  // Code quality
  addComments: boolean;
  generateJSDoc: boolean;
  includeTypeDefinitions: boolean;
  eslintCompliant: boolean;
  
  // Test data
  generateFixtures: boolean;
  fixturesDirectory: string;
  useRealisticData: boolean;
  dataLocale: string;
  
  // Utilities
  generateHelpers: boolean;
  helpersDirectory: string;
  includeApiHelpers: boolean;
  
  // Assertions
  generateAssertions: boolean;
  assertionStrategy: 'conservative' | 'comprehensive' | 'minimal';
  includeVisualAssertions: boolean;
  
  // Code formatting
  formatting: {
    indentSize: number;
    singleQuotes: boolean;
    semicolons: boolean;
    trailingCommas: boolean;
    maxLineLength: number;
  };
}
```

## Integration Examples

### With Recording

```typescript
import { UserPathRecorder } from '../recording';
import { TestGenerator } from './generation';

// Record user interaction
const recorder = new UserPathRecorder();
recorder.startRecording(page, 'checkout-flow');

// Perform user actions...
await page.fill('#product-quantity', '2');
await page.click('#add-to-cart');
await page.click('#checkout');

const userPath = await recorder.stopRecording();

// Generate tests from recording
const generator = new TestGenerator({
  framework: 'playwright',
  language: 'typescript',
  outputDirectory: './tests',
});

const result = await generator.generate(userPath);
```

### With Crawling

```typescript
import { BreadthFirstCrawler } from '../crawler';

const crawler = new BreadthFirstCrawler(browser);

const crawlResult = await crawler.crawl({
  startUrl: 'https://app.example.com',
  maxDepth: 2,
  generateTests: true, // Enable test generation during crawling
  testGenerator: new TestGenerator({
    framework: 'playwright',
    generatePageObjects: true,
  }),
});

console.log(`Generated tests for ${crawlResult.generatedTests.length} user flows`);
```

### With Monitoring

```typescript
const generator = new TestGenerator({
  framework: 'playwright',
  monitoring: new MonitoringService(),
});

// Generation metrics are automatically tracked
const result = await generator.generate(userPath);

// Metrics include:
// - generation_duration_ms
// - files_generated_total
// - tests_generated_total
// - assertions_generated_total
```

## Best Practices

1. **Page Object Design**: Keep page objects focused on single pages or components
2. **Test Data Management**: Use fixtures for static data, generators for dynamic data
3. **Assertion Strategy**: Include both positive and negative test cases
4. **Code Organization**: Group related tests and maintain consistent naming
5. **Maintainability**: Generate clean, readable code with proper documentation
6. **Performance**: Optimize generated tests for execution speed

## Advanced Features

### Custom Templates

```typescript
const generator = new TestGenerator({
  customTemplates: {
    testFile: './templates/custom-test.hbs',
    pageObject: './templates/custom-page.hbs',
    fixture: './templates/custom-fixture.hbs',
  },
});

// Custom Handlebars template for test files
const customTestTemplate = `
import { test, expect } from '@playwright/test';
{{#each pageObjects}}
import { {{className}} } from '../pages/{{className}}';
{{/each}}

test.describe('{{testSuite.name}}', () => {
  {{#each tests}}
  test('{{name}}', async ({ page }) => {
    {{#each steps}}
    {{> stepTemplate this}}
    {{/each}}
    
    {{#each assertions}}
    {{> assertionTemplate this}}
    {{/each}}
  });
  {{/each}}
});
`;
```

### Plugin System

```typescript
// Custom generation plugins
class CustomAssertionPlugin {
  name = 'custom-assertions';
  
  generateAssertions(step, context) {
    if (step.type === 'fill' && step.selector.includes('email')) {
      return `await expect(page.locator('${step.selector}')).toHaveValue(/${EMAIL_REGEX}/);`;
    }
    return null;
  }
}

const generator = new TestGenerator({
  plugins: [
    new CustomAssertionPlugin(),
    new CustomDataPlugin(),
    new CustomPageObjectPlugin(),
  ],
});
```

### AI-Enhanced Generation

```typescript
const aiGenerator = new TestGenerator({
  aiEnhanced: true,
  aiConfig: {
    provider: 'openai',
    model: 'gpt-4',
    apiKey: 'your-api-key',
  },
  
  enhancementFeatures: {
    smartAssertions: true, // AI suggests additional assertions
    testNaming: true, // AI generates descriptive test names
    documentation: true, // AI generates test documentation
    edgeCases: true, // AI suggests edge case tests
  },
});

// AI-enhanced features:
// - Smarter assertion inference
// - Better test naming
// - Comprehensive documentation
// - Edge case identification
```

## Troubleshooting

### Common Issues

#### Selector Issues
```typescript
// Handle dynamic selectors
const generator = new TestGenerator({
  selectorStrategy: 'data-testid-preferred', // Prefer data-testid attributes
  selectorFallback: ['id', 'class', 'text', 'xpath'],
  generateSelectorHelpers: true,
});
```

#### Code Quality
```typescript
// Validate generated code
const validator = new TestValidator({
  syntaxCheck: true,
  lintingRules: 'standard',
  typeChecking: true,
});

const validationResult = await validator.validate(generatedCode);
if (!validationResult.isValid) {
  console.error('Generated code has issues:', validationResult.errors);
}
```

#### Performance Optimization
```typescript
// Optimize for faster test generation
const optimizedGenerator = new TestGenerator({
  parallelGeneration: true,
  cacheTemplates: true,
  batchFileWrites: true,
  skipUnnecessaryAssertions: true,
});
```