# CAPTCHA Module

The CAPTCHA module provides comprehensive CAPTCHA detection, solving, and handling capabilities for automated web interactions. It supports multiple CAPTCHA types and solving strategies.

## Components

### CaptchaHandler

A comprehensive CAPTCHA handling system that can detect, solve, and manage various types of CAPTCHAs encountered during web automation.

**Supported CAPTCHA Types:**
- **reCAPTCHA v2**: Checkbox and image challenges
- **reCAPTCHA v3**: Score-based invisible challenges
- **hCaptcha**: Privacy-focused alternative to reCAPTCHA
- **FunCaptcha**: Arkose Labs interactive challenges
- **Cloudflare**: Cloudflare bot protection challenges
- **Custom CAPTCHAs**: Configurable detection patterns

**Solving Strategies:**
- **Service-based**: Integration with solving services (2captcha, anti-captcha, etc.)
- **Manual solving**: User intervention prompts
- **Bypass techniques**: Stealth and evasion methods
- **Hybrid approaches**: Combination of multiple strategies

## Usage

### Basic Setup

```typescript
import { CaptchaHandler } from './captcha';

const captchaHandler = new CaptchaHandler({
  autoDetect: true,
  solveAttempts: 3,
  timeout: 60000,
  
  // Service configuration
  services: {
    twoCaptcha: {
      apiKey: 'your-2captcha-api-key',
      enabled: true,
    },
    antiCaptcha: {
      apiKey: 'your-anticaptcha-api-key',
      enabled: false,
    },
  },
  
  // Manual solving fallback
  manualSolving: {
    enabled: true,
    promptUser: true,
    timeout: 120000,
  },
  
  // Custom CAPTCHA patterns
  customSelectors: {
    'company-captcha': ['.company-challenge', '#custom-captcha'],
  },
});
```

### CAPTCHA Detection

```typescript
// Automatic detection
const detection = await captchaHandler.detectCaptcha(page);

if (detection.detected) {
  console.log(`Found ${detection.type} CAPTCHA`);
  console.log(`Confidence: ${detection.confidence}`);
  console.log(`Element: ${detection.selector}`);
  
  if (detection.metadata?.siteKey) {
    console.log(`Site key: ${detection.metadata.siteKey}`);
  }
}
```

### CAPTCHA Solving

```typescript
// Solve detected CAPTCHA
const solution = await captchaHandler.solveCaptcha(page, detection);

if (solution.success) {
  console.log(`CAPTCHA solved in ${solution.timeToSolve}ms`);
  console.log(`Method used: ${solution.method}`);
  
  if (solution.cost) {
    console.log(`Cost: $${solution.cost}`);
  }
} else {
  console.error(`Failed to solve CAPTCHA: ${solution.error}`);
}
```

### Complete Workflow

```typescript
// Handle entire CAPTCHA workflow automatically
const success = await captchaHandler.handleCaptchaWorkflow(page);

if (success) {
  console.log('Page is now CAPTCHA-free, continuing...');
} else {
  console.log('Could not bypass CAPTCHA after maximum attempts');
}
```

## CAPTCHA Types and Detection

### reCAPTCHA v2

```typescript
// Detection patterns for reCAPTCHA v2
const recaptchaPatterns = [
  '.g-recaptcha',
  '[data-sitekey]',
  'iframe[src*="recaptcha"]',
  '.recaptcha-checkbox',
];

// Metadata extraction
const siteKey = await page.evaluate(() => {
  const element = document.querySelector('[data-sitekey]');
  return element?.getAttribute('data-sitekey');
});
```

### hCaptcha

```typescript
// Detection patterns for hCaptcha
const hcaptchaPatterns = [
  '.h-captcha',
  '[data-hcaptcha-sitekey]',
  'iframe[src*="hcaptcha"]',
];

// Configuration
const hcaptchaConfig = {
  type: 'hcaptcha',
  siteKey: 'extracted-site-key',
  pageUrl: page.url(),
};
```

### Cloudflare

```typescript
// Cloudflare challenge detection
const cloudflarePatterns = [
  '.cf-browser-verification',
  '.cf-checking-browser',
  '#cf-wrapper',
  'input[name="cf_ch_verify"]',
];

// Bypass strategy
const bypassResult = await captchaHandler.bypassCloudflare(page);
```

### Custom CAPTCHAs

```typescript
// Define custom CAPTCHA patterns
const customConfig = {
  customSelectors: {
    'banking-captcha': [
      '.security-challenge',
      '.verification-image',
      '#challenge-container',
    ],
    'ecommerce-captcha': [
      '.checkout-verification',
      '.purchase-challenge',
    ],
  },
};

// Custom solving logic
class CustomCaptchaSolver {
  async solve(page: Page, element: Locator): Promise<string> {
    // Implement custom solving logic
    const challengeText = await element.textContent();
    return this.processChallenge(challengeText);
  }
}
```

## Solving Services Integration

### 2captcha Integration

```typescript
const twoCaptchaConfig = {
  apiKey: 'your-2captcha-api-key',
  enabled: true,
  timeout: 120000,
  pollingInterval: 5000,
};

// Service-specific solving
async function solveWithTwoCaptcha(siteKey: string, pageUrl: string): Promise<string> {
  const response = await fetch('https://2captcha.com/in.php', {
    method: 'POST',
    body: new URLSearchParams({
      key: twoCaptchaConfig.apiKey,
      method: 'userrecaptcha',
      googlekey: siteKey,
      pageurl: pageUrl,
    }),
  });
  
  const { request: taskId } = await response.json();
  
  // Poll for solution
  let solution;
  let attempts = 0;
  const maxAttempts = twoCaptchaConfig.timeout / twoCaptchaConfig.pollingInterval;
  
  while (!solution && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, twoCaptchaConfig.pollingInterval));
    
    const resultResponse = await fetch(`https://2captcha.com/res.php?key=${twoCaptchaConfig.apiKey}&action=get&id=${taskId}`);
    const result = await resultResponse.text();
    
    if (result.startsWith('OK|')) {
      solution = result.substring(3);
    }
    
    attempts++;
  }
  
  return solution;
}
```

### Anti-Captcha Integration

```typescript
const antiCaptchaConfig = {
  apiKey: 'your-anticaptcha-api-key',
  enabled: true,
  softId: 0, // Your software ID
};

async function solveWithAntiCaptcha(siteKey: string, pageUrl: string): Promise<string> {
  // Create task
  const createTaskResponse = await fetch('https://api.anti-captcha.com/createTask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientKey: antiCaptchaConfig.apiKey,
      task: {
        type: 'NoCaptchaTaskProxyless',
        websiteURL: pageUrl,
        websiteKey: siteKey,
      },
      softId: antiCaptchaConfig.softId,
    }),
  });
  
  const { taskId } = await createTaskResponse.json();
  
  // Get task result
  let solution;
  while (!solution) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const resultResponse = await fetch('https://api.anti-captcha.com/getTaskResult', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientKey: antiCaptchaConfig.apiKey,
        taskId: taskId,
      }),
    });
    
    const result = await resultResponse.json();
    
    if (result.status === 'ready') {
      solution = result.solution.gRecaptchaResponse;
    }
  }
  
  return solution;
}
```

## Manual Solving

### User Prompt Interface

```typescript
const manualSolvingConfig = {
  enabled: true,
  promptUser: true,
  timeout: 180000, // 3 minutes
  instructions: {
    recaptcha: 'Please solve the reCAPTCHA challenge in the browser window.',
    hcaptcha: 'Please complete the hCaptcha verification.',
    custom: 'Please solve the security challenge and press Enter.',
  },
};

// Manual solving implementation
async function solveManually(page: Page, detection: CaptchaDetectionResult): Promise<CaptchaSolutionResult> {
  console.log(`\n🔐 CAPTCHA DETECTED: ${detection.type}`);
  console.log(manualSolvingConfig.instructions[detection.type] || 'Please solve the CAPTCHA.');
  console.log(`Waiting ${manualSolvingConfig.timeout / 1000} seconds...\n`);
  
  // Wait for user to solve
  await page.waitForTimeout(manualSolvingConfig.timeout);
  
  // Verify solution
  const stillPresent = await captchaHandler.detectCaptcha(page);
  
  return {
    success: !stillPresent.detected,
    method: 'manual',
    timeToSolve: manualSolvingConfig.timeout,
    solution: stillPresent.detected ? undefined : 'manual-solved',
  };
}
```

### Interactive CLI

```typescript
import readline from 'readline';

async function interactiveManualSolving(detection: CaptchaDetectionResult): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  console.log(`CAPTCHA Type: ${detection.type}`);
  console.log(`Confidence: ${detection.confidence * 100}%`);
  
  if (detection.metadata?.siteKey) {
    console.log(`Site Key: ${detection.metadata.siteKey}`);
  }
  
  return new Promise((resolve) => {
    rl.question('Press Enter when you have solved the CAPTCHA...', () => {
      rl.close();
      resolve();
    });
  });
}
```

## Bypass Techniques

### Stealth Integration

```typescript
import { StealthMode } from '../stealth';

const stealthIntegration = {
  async bypassWithStealth(page: Page): Promise<boolean> {
    const stealth = new StealthMode({
      enabled: true,
      fingerprintSpoofing: {
        canvas: true,
        webgl: true,
        audio: true,
      },
      behaviorSimulation: {
        humanLikeDelays: true,
        mouseMovements: true,
      },
    });
    
    await stealth.setupPage(page);
    
    // Wait for potential CAPTCHA challenges
    await page.waitForTimeout(5000);
    
    // Check if CAPTCHA was bypassed
    const detection = await captchaHandler.detectCaptcha(page);
    return !detection.detected;
  },
};
```

### Cloudflare Bypass

```typescript
async function bypassCloudflare(page: Page): Promise<CaptchaSolutionResult> {
  try {
    // Wait for Cloudflare challenge to load
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Check for challenge elements
    const challengePresent = await page.locator('.cf-browser-verification').isVisible().catch(() => false);
    
    if (!challengePresent) {
      return { success: true, method: 'bypass', timeToSolve: 0, solution: 'no-challenge' };
    }
    
    // Try clicking challenge checkbox
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.click();
      
      // Wait for challenge completion
      await page.waitForTimeout(5000);
      
      const stillPresent = await page.locator('.cf-browser-verification').isVisible().catch(() => false);
      
      return {
        success: !stillPresent,
        method: 'bypass',
        timeToSolve: 5000,
        solution: stillPresent ? undefined : 'checkbox-clicked',
      };
    }
    
    // Wait for automatic challenge completion
    await page.waitForFunction(
      () => !document.querySelector('.cf-browser-verification'),
      { timeout: 30000 }
    );
    
    return { success: true, method: 'bypass', timeToSolve: 30000, solution: 'auto-completed' };
    
  } catch (error) {
    return {
      success: false,
      method: 'bypass',
      timeToSolve: 30000,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

## Configuration Reference

### Complete Configuration Interface

```typescript
interface CaptchaConfig {
  autoDetect: boolean;
  solveAttempts: number;
  timeout: number;
  
  services: {
    twoCaptcha?: {
      apiKey: string;
      enabled: boolean;
      timeout?: number;
      pollingInterval?: number;
      softId?: number;
    };
    antiCaptcha?: {
      apiKey: string;
      enabled: boolean;
      timeout?: number;
      softId?: number;
    };
    deathByCaptcha?: {
      username: string;
      password: string;
      enabled: boolean;
    };
  };
  
  manualSolving: {
    enabled: boolean;
    promptUser: boolean;
    timeout: number;
    instructions?: Record<string, string>;
  };
  
  customSelectors: {
    [key: string]: string[];
  };
  
  bypassTechniques: {
    stealth: boolean;
    waitStrategies: {
      networkIdle: boolean;
      loadComplete: boolean;
      customDelay: number;
    };
  };
}
```

## Integration Examples

### With Crawler

```typescript
const crawler = new BreadthFirstCrawler(browser);

const result = await crawler.crawl({
  startUrl: 'https://protected-site.com',
  captchaHandler: captchaHandler,
  onCaptchaDetected: async (page, detection) => {
    console.log(`CAPTCHA detected: ${detection.type}`);
    return await captchaHandler.handleCaptchaWorkflow(page);
  },
});
```

### With Authentication

```typescript
const authManager = new MultiStrategyAuthManager({
  captchaHandler: captchaHandler,
});

// CAPTCHA handling integrated into auth flow
const authResult = await authManager.authenticate(page, 'basic', {
  username: 'user@example.com',
  password: 'password',
});
```

### With Test Generation

```typescript
const testGenerator = new TestGenerator({
  framework: 'playwright',
  captchaHandling: {
    enabled: true,
    strategy: 'service', // 'service', 'manual', 'bypass'
    serviceConfig: {
      provider: '2captcha',
      apiKey: 'your-api-key',
    },
  },
});

// Generated tests include CAPTCHA handling
const tests = await testGenerator.generate(userPath);
```

## Best Practices

1. **Cost Management**: Monitor solving service costs and set budgets
2. **Fallback Strategies**: Always have multiple solving methods available
3. **Detection Accuracy**: Regularly validate CAPTCHA detection patterns
4. **Service Reliability**: Use multiple solving services for redundancy
5. **Compliance**: Respect website terms of service and rate limits
6. **Security**: Protect API keys and credentials securely

## Performance Optimization

### Efficient Detection

```typescript
// Optimize detection performance
const optimizedConfig = {
  autoDetect: true,
  detectionTimeout: 5000, // Quick detection
  detectionInterval: 1000, // Check every second
  skipKnownPatterns: true, // Skip patterns known to be absent
};
```

### Batch Processing

```typescript
// Handle multiple CAPTCHAs efficiently
async function handleMultipleCaptchas(pages: Page[]): Promise<boolean[]> {
  const detections = await Promise.all(
    pages.map(page => captchaHandler.detectCaptcha(page))
  );
  
  const solutions = await Promise.all(
    detections.map((detection, index) => 
      detection.detected ? 
        captchaHandler.solveCaptcha(pages[index], detection) :
        Promise.resolve({ success: true, method: 'none' })
    )
  );
  
  return solutions.map(solution => solution.success);
}
```

## Troubleshooting

### Common Issues

#### Service API Errors
```typescript
try {
  const solution = await captchaHandler.solveCaptcha(page, detection);
} catch (error) {
  if (error.code === 'INSUFFICIENT_FUNDS') {
    console.error('Not enough balance in solving service account');
  } else if (error.code === 'INVALID_API_KEY') {
    console.error('Invalid API key for solving service');
  } else if (error.code === 'SERVICE_OVERLOADED') {
    console.error('Solving service is overloaded, try again later');
  }
}
```

#### Detection Failures
```typescript
// Debug detection issues
const debugConfig = {
  debug: true,
  logDetectionAttempts: true,
  saveDetectionScreenshots: true,
};

const detection = await captchaHandler.detectCaptcha(page, debugConfig);

if (!detection.detected) {
  // Check page source for CAPTCHA elements
  const pageContent = await page.content();
  console.log('Page content for manual inspection:', pageContent);
}
```

#### Bypass Failures
```typescript
// Implement progressive bypass strategies
const bypassStrategies = [
  'stealth-mode',
  'wait-and-retry',
  'user-agent-rotation',
  'manual-intervention',
];

for (const strategy of bypassStrategies) {
  const success = await attemptBypass(page, strategy);
  if (success) break;
}
```

### Monitoring and Logging

```typescript
// Monitor CAPTCHA handling performance
const captchaMetrics = {
  detectionRate: 0.95, // 95% of CAPTCHAs detected
  solvingRate: 0.87, // 87% of CAPTCHAs solved
  averageSolveTime: 15000, // 15 seconds average
  totalCost: 2.50, // $2.50 in solving costs
};

// Log CAPTCHA events
captchaHandler.on('detected', (detection) => {
  console.log(`CAPTCHA detected: ${detection.type} (confidence: ${detection.confidence})`);
});

captchaHandler.on('solved', (solution) => {
  console.log(`CAPTCHA solved using ${solution.method} in ${solution.timeToSolve}ms`);
});

captchaHandler.on('failed', (error) => {
  console.error(`CAPTCHA solving failed: ${error.message}`);
});
```