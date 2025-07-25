# Quick Start Guide

Get up and running with Browser Explorer in minutes. This guide covers the most common use cases and provides example code to help you start generating tests quickly.

## Basic Command Line Usage

### Simple Crawl

```bash
# Crawl a website and generate tests
browser-explorer crawl https://example.com

# Specify output directory
browser-explorer crawl https://example.com --output ./my-tests

# Limit crawl depth and pages
browser-explorer crawl https://example.com \
  --max-depth 2 \
  --max-pages 50
```

### Common Options

```bash
browser-explorer crawl [url] [options]

Options:
  --output, -o          Output directory for tests (default: ./generated-tests)
  --max-depth, -d       Maximum crawl depth (default: 3)
  --max-pages, -p       Maximum pages to crawl (default: 100)
  --config, -c          Path to config file
  --headless            Run in headless mode (default: true)
  --verbose, -v         Enable verbose logging
  --help, -h            Show help
```

## Quick Examples

### 1. Test a Login Flow

```javascript
const { BrowserExplorer } = require('browser-explorer');

async function testLogin() {
  const explorer = new BrowserExplorer({
    startUrl: 'https://example.com/login',
    maxDepth: 2,
    focusArea: 'form'  // Focus on form elements
  });

  const results = await explorer.explore();
  console.log('Generated login test:', results.tests[0].path);
}

testLogin();
```

### 2. E-commerce Site Testing

```javascript
const explorer = new BrowserExplorer({
  startUrl: 'https://shop.example.com',
  config: {
    crawl: {
      maxDepth: 3,
      includePatterns: ['/products', '/cart', '/checkout'],
      excludePatterns: ['/admin', '/api']
    },
    testing: {
      generateVisualAssertions: true,
      testShoppingFlows: true
    }
  }
});

const results = await explorer.explore();
```

### 3. Single Page Application (SPA)

```javascript
const explorer = new BrowserExplorer({
  startUrl: 'https://spa.example.com',
  config: {
    browser: {
      waitForSelector: '#app',  // Wait for app to load
      spaMode: true             // Handle client-side routing
    },
    crawl: {
      crawlDelay: 2000,         // Wait for dynamic content
      ajaxTimeout: 5000         // Wait for AJAX calls
    }
  }
});
```

## Step-by-Step Tutorial

### Step 1: Install and Configure

```bash
# Install Browser Explorer
npm install -g browser-explorer

# Create a new project
mkdir my-test-project
cd my-test-project

# Initialize configuration
browser-explorer init
```

### Step 2: Create Configuration File

Create `browser-explorer.config.js`:

```javascript
module.exports = {
  // Target website
  startUrl: 'https://my-app.com',
  
  // Crawl settings
  crawl: {
    maxDepth: 3,
    maxPages: 50,
    respectRobotsTxt: true,
    userAgent: 'BrowserExplorer/1.0'
  },
  
  // Test generation
  generation: {
    outputDir: './tests',
    framework: 'playwright',  // or 'cypress', 'puppeteer'
    generatePageObjects: true,
    typeScript: true
  },
  
  // Authentication (if needed)
  auth: {
    enabled: true,
    loginUrl: 'https://my-app.com/login',
    credentials: {
      username: process.env.TEST_USERNAME,
      password: process.env.TEST_PASSWORD
    }
  }
};
```

### Step 3: Run the Explorer

```bash
# Using the config file
browser-explorer crawl --config browser-explorer.config.js

# Or with environment variables
TEST_USERNAME=user TEST_PASSWORD=pass browser-explorer crawl
```

### Step 4: Review Generated Tests

```typescript
// Generated test example: tests/login-flow.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

test.describe('Login Flow', () => {
  test('should successfully login', async ({ page }) => {
    const loginPage = new LoginPage(page);
    
    await loginPage.navigate();
    await loginPage.fillUsername('testuser@example.com');
    await loginPage.fillPassword('securePassword123');
    await loginPage.clickLogin();
    
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.locator('.welcome-message')).toBeVisible();
  });
});
```

## Common Use Cases

### Testing Forms

```javascript
const explorer = new BrowserExplorer({
  startUrl: 'https://example.com/contact',
  config: {
    testing: {
      testAllFormVariations: true,
      generateErrorCases: true,
      validateFormSubmissions: true
    }
  }
});
```

### API Testing Integration

```javascript
const explorer = new BrowserExplorer({
  startUrl: 'https://api-app.com',
  config: {
    network: {
      interceptRequests: true,
      recordApiCalls: true,
      generateApiTests: true
    }
  }
});

// Generated tests will include API assertions
```

### Visual Regression Testing

```javascript
const explorer = new BrowserExplorer({
  startUrl: 'https://example.com',
  config: {
    visual: {
      enabled: true,
      threshold: 0.1,
      fullPage: true,
      maskDynamicContent: true
    }
  }
});
```

## Programmatic API

### Basic Usage

```javascript
const { CrawlerService, AIElementDetector, TestGenerator } = require('browser-explorer');

async function generateTests() {
  // 1. Initialize crawler
  const crawler = new CrawlerService({
    startUrl: 'https://example.com',
    maxDepth: 2
  });
  
  // 2. Crawl the site
  await crawler.initialize();
  const crawlResult = await crawler.crawl();
  
  // 3. Process each page
  for (const url of crawlResult.urls) {
    // Detect elements
    const detector = new AIElementDetector();
    const elements = await detector.detectInteractiveElements(page);
    
    // Generate tests
    const generator = new TestGenerator();
    const tests = await generator.generateTests(elements);
    
    // Save tests
    await generator.saveTests(tests, './output');
  }
}
```

### Advanced Integration

```javascript
class CustomExplorer {
  async exploreWithCustomLogic(url) {
    const browser = await playwright.chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Custom pre-crawl setup
    await this.setupAuthentication(page);
    await this.configureInterceptors(page);
    
    // Use Browser Explorer components
    const detector = new AIElementDetector();
    await detector.initialize(page);
    
    const executor = new InteractionExecutor();
    executor.setPage(page);
    
    // Custom exploration logic
    await page.goto(url);
    const elements = await detector.detectInteractiveElements(page);
    
    for (const element of elements.elements) {
      const result = await executor.executeInteraction(element);
      await this.processResult(result);
    }
    
    await browser.close();
  }
}
```

## Tips and Best Practices

### 1. Start Small
```bash
# Test on a few pages first
browser-explorer crawl https://example.com/specific-page --max-depth 1
```

### 2. Use Focused Crawling
```javascript
{
  crawl: {
    includePatterns: ['/products/', '/checkout/'],
    excludePatterns: ['/blog/', '/news/']
  }
}
```

### 3. Handle Authentication
```javascript
{
  auth: {
    strategy: 'cookie',
    cookieFile: './auth-cookies.json'
  }
}
```

### 4. Monitor Progress
```bash
# Enable verbose logging
browser-explorer crawl https://example.com -v

# Or use the progress API
explorer.on('page:visited', (url) => {
  console.log(`Processed: ${url}`);
});
```

## Troubleshooting

### Common Issues

1. **Slow Crawling**
   ```javascript
   {
     crawl: {
       parallelWorkers: 5,  // Increase parallelism
       crawlDelay: 500      // Reduce delay
     }
   }
   ```

2. **Dynamic Content Not Detected**
   ```javascript
   {
     browser: {
       waitForLoadState: 'networkidle',
       waitForTimeout: 3000
     }
   }
   ```

3. **Authentication Issues**
   ```javascript
   // Use manual authentication
   await explorer.authenticate(async (page) => {
     await page.goto('https://example.com/login');
     await page.fill('#username', 'user');
     await page.fill('#password', 'pass');
     await page.click('#login-button');
     await page.waitForNavigation();
   });
   ```

## Next Steps

- [Configuration Guide](./configuration.md) - Detailed configuration options
- [API Documentation](../api/browser-agent.md) - Full API reference
- [Advanced Examples](./advanced-examples.md) - Complex scenarios
- [Testing Guide](./testing.md) - Test the generated tests