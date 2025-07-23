# Stealth Module

The stealth module provides comprehensive anti-bot detection evasion capabilities, enabling the Browser Explorer to operate undetected on websites with sophisticated bot protection systems.

## Components

### StealthMode

A comprehensive stealth system that implements multiple layers of bot detection evasion techniques.

**Features:**
- **Fingerprint Spoofing**: Canvas, WebGL, Audio, and Font fingerprinting evasion
- **Behavior Simulation**: Human-like typing patterns, mouse movements, and timing
- **Browser Spoofing**: User agent rotation and browser property masking
- **Network Evasion**: IP rotation and request pattern randomization
- **Advanced Techniques**: WebRTC leaks, timezone spoofing, and more

## Core Concepts

### Fingerprint Spoofing

#### Canvas Fingerprinting
```typescript
const stealth = new StealthMode({
  fingerprintSpoofing: {
    canvas: true,
    canvasNoise: 0.01, // Add slight noise to canvas output
  },
});

// Automatically spoofs canvas.getImageData() and toDataURL() calls
await stealth.setupPage(page);
```

#### WebGL Fingerprinting
```typescript
const stealth = new StealthMode({
  fingerprintSpoofing: {
    webgl: true,
    webglVendor: 'Intel Inc.',
    webglRenderer: 'Intel Iris Pro OpenGL Engine',
  },
});
```

#### Audio Fingerprinting
```typescript
const stealth = new StealthMode({
  fingerprintSpoofing: {
    audio: true,
    audioNoise: 0.001, // Subtle audio context spoofing
  },
});
```

### Behavior Simulation

#### Human-like Typing
```typescript
const stealth = new StealthMode({
  behaviorSimulation: {
    humanLikeDelays: true,
    typingSpeed: {
      min: 50,  // Minimum delay between keystrokes (ms)
      max: 150, // Maximum delay between keystrokes (ms)
      variance: 0.3, // Natural timing variance
    },
  },
});

// Use stealthy typing instead of regular fill
await stealth.typeStealthily(page, '#search-input', 'search query');
```

#### Mouse Movement Simulation
```typescript
const stealth = new StealthMode({
  behaviorSimulation: {
    mouseMovements: true,
    clickDelay: {
      min: 100,
      max: 300,
    },
  },
});

// Simulates human-like mouse movement before clicking
await stealth.clickStealthily(page, '#submit-button');
```

## Usage

### Basic Setup

```typescript
import { StealthMode } from './stealth';
import { chromium } from 'playwright';

const stealth = new StealthMode({
  enabled: true,
  fingerprintSpoofing: {
    canvas: true,
    webgl: true,
    audio: true,
    fonts: true,
  },
  behaviorSimulation: {
    humanLikeDelays: true,
    randomizedTiming: true,
    mouseMovements: true,
  },
  browserSpoofing: {
    userAgent: 'auto', // Automatic user agent rotation
    languages: ['en-US', 'en'],
    platform: 'auto',
  },
});

const browser = await chromium.launch();
const context = await stealth.setupStealthBrowser(browser);
const page = await context.newPage();

// Navigate with stealth
await stealth.navigateStealthily(page, 'https://example.com');
```

### Advanced Configuration

```typescript
const advancedStealth = new StealthMode({
  enabled: true,
  
  // Fingerprint spoofing configuration
  fingerprintSpoofing: {
    canvas: true,
    canvasNoise: 0.01,
    webgl: true,
    webglVendor: 'NVIDIA Corporation',
    webglRenderer: 'NVIDIA GeForce GTX 1060',
    audio: true,
    audioNoise: 0.001,
    fonts: true,
    fontList: ['Arial', 'Helvetica', 'Times New Roman'], // Custom font list
    screen: true,
    screenResolution: { width: 1920, height: 1080 },
    timezone: 'America/New_York',
  },
  
  // Behavior simulation
  behaviorSimulation: {
    humanLikeDelays: true,
    typingSpeed: {
      min: 80,
      max: 200,
      variance: 0.4,
      pauseProbability: 0.1, // Probability of longer pauses
      pauseDuration: { min: 500, max: 2000 },
    },
    mouseMovements: true,
    mousePath: 'bezier', // 'linear', 'bezier', 'random'
    clickDelay: { min: 150, max: 400 },
    scrollBehavior: {
      smooth: true,
      speed: 'human', // 'slow', 'human', 'fast'
      randomPauses: true,
    },
  },
  
  // Browser spoofing
  browserSpoofing: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    languages: ['en-US', 'en', 'es'],
    platform: 'Win32',
    hardwareConcurrency: 8,
    deviceMemory: 8,
    maxTouchPoints: 0,
  },
  
  // Network evasion
  networkEvasion: {
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
    randomizeHeaders: true,
    requestDelay: { min: 1000, max: 5000 },
  },
});
```

## Stealth Techniques

### Canvas Fingerprinting Protection

```typescript
// Automatic canvas noise injection
await page.addInitScript(() => {
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function(...args) {
    // Add subtle noise to canvas output
    const ctx = this.getContext('2d');
    if (ctx) {
      const imageData = ctx.getImageData(0, 0, this.width, this.height);
      // Add random noise...
    }
    return originalToDataURL.apply(this, args);
  };
});
```

### WebGL Fingerprinting Protection

```typescript
// Override WebGL parameters
await page.addInitScript(() => {
  const getParameter = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function(parameter) {
    if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
      return 'Intel Inc.';
    }
    if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
      return 'Intel Iris Pro OpenGL Engine';
    }
    return getParameter.apply(this, arguments);
  };
});
```

### User Agent Rotation

```typescript
const stealth = new StealthMode({
  browserSpoofing: {
    userAgent: 'rotate', // Rotate through common user agents
    userAgentPool: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36...',
    ],
  },
});

// Automatically rotates user agent for each session
const userAgent = stealth.generateRandomUserAgent();
await page.setUserAgent(userAgent);
```

### Human-like Interactions

```typescript
// Stealthy form filling
await stealth.typeStealthily(page, '#username', 'user@example.com');
await stealth.typeStealthily(page, '#password', 'secretpassword');

// Human-like clicking with mouse movement
await stealth.clickStealthily(page, '#login-button');

// Natural scrolling behavior
await stealth.scrollStealthily(page, { y: 500 });

// Realistic page navigation
await stealth.navigateStealthily(page, 'https://example.com/dashboard');
```

## Integration Examples

### With Crawling

```typescript
const crawler = new BreadthFirstCrawler(browser);
const stealth = new StealthMode({ enabled: true });

// Create stealth browser context
const context = await stealth.setupStealthBrowser(browser);

const result = await crawler.crawl({
  startUrl: 'https://protected-site.com',
  browserContext: context, // Use stealth context
  customPageSetup: async (page) => {
    await stealth.setupPage(page);
  },
  navigationHandler: async (page, url) => {
    await stealth.navigateStealthily(page, url);
  },
});
```

### With Authentication

```typescript
const authManager = new MultiStrategyAuthManager({
  stealth: stealth,
});

// Stealth mode automatically applied during authentication
const authResult = await authManager.authenticate(page, 'basic', {
  username: 'user@example.com',
  password: 'password',
});
```

### With Test Generation

```typescript
const recorder = new UserPathRecorder({
  stealth: stealth,
});

recorder.startRecording(page, 'stealth-interaction');

// All interactions automatically use stealth mode
await stealth.typeStealthily(page, '#search', 'product search');
await stealth.clickStealthily(page, '.search-button');

const path = await recorder.stopRecording();
```

## Detection Evasion Strategies

### Common Bot Detection Methods

#### Mouse Movement Detection
```typescript
// Simulate realistic mouse movements
const stealth = new StealthMode({
  behaviorSimulation: {
    mouseMovements: true,
    mouseTrail: true, // Leave realistic mouse trails
    idleMovements: true, // Subtle movements during idle time
  },
});
```

#### Timing Analysis
```typescript
// Randomize interaction timing
const stealth = new StealthMode({
  behaviorSimulation: {
    randomizedTiming: true,
    actionDelays: {
      min: 500,
      max: 3000,
      distribution: 'normal', // 'uniform', 'normal', 'exponential'
    },
  },
});
```

#### Browser Automation Detection
```typescript
// Hide automation indicators
await page.addInitScript(() => {
  // Remove webdriver property
  delete Object.getPrototypeOf(navigator).webdriver;
  
  // Override plugins
  Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5], // Fake plugin list
  });
  
  // Override languages
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
  });
});
```

### Advanced Evasion Techniques

#### Network Traffic Patterns
```typescript
const stealth = new StealthMode({
  networkEvasion: {
    requestDelay: { min: 2000, max: 8000 },
    requestJitter: 0.3, // Add timing variance
    requestBatching: false, // Avoid simultaneous requests
    headerRotation: true,
    cookieHandling: 'human', // Human-like cookie behavior
  },
});
```

#### JavaScript Execution Patterns
```typescript
// Simulate human-like JavaScript execution
await page.addInitScript(() => {
  // Override setTimeout to add slight delays
  const originalSetTimeout = window.setTimeout;
  window.setTimeout = function(callback, delay, ...args) {
    const jitteredDelay = delay + Math.random() * 100;
    return originalSetTimeout(callback, jitteredDelay, ...args);
  };
});
```

## Performance Considerations

### Resource Usage

```typescript
const stealth = new StealthMode({
  performance: {
    lowResource: true, // Reduce CPU usage
    backgroundTabs: false, // Don't apply stealth to background tabs
    selectiveFeatures: ['canvas', 'webgl'], // Only enable essential features
  },
});
```

### Memory Management

```typescript
// Clean up stealth resources
await stealth.cleanup();

// Monitor stealth overhead
const metrics = stealth.getMetrics();
console.log({
  memoryUsage: metrics.memoryUsage,
  cpuOverhead: metrics.cpuOverhead,
  detectionAttempts: metrics.detectionAttempts,
});
```

## Configuration Reference

### Complete Configuration

```typescript
interface StealthConfig {
  enabled: boolean;
  
  fingerprintSpoofing: {
    canvas: boolean;
    canvasNoise: number;
    webgl: boolean;
    webglVendor: string;
    webglRenderer: string;
    audio: boolean;
    audioNoise: number;
    fonts: boolean;
    fontList: string[];
    screen: boolean;
    screenResolution: { width: number; height: number };
    timezone: string;
  };
  
  behaviorSimulation: {
    humanLikeDelays: boolean;
    typingSpeed: {
      min: number;
      max: number;
      variance: number;
      pauseProbability: number;
      pauseDuration: { min: number; max: number };
    };
    mouseMovements: boolean;
    mousePath: 'linear' | 'bezier' | 'random';
    clickDelay: { min: number; max: number };
    scrollBehavior: {
      smooth: boolean;
      speed: 'slow' | 'human' | 'fast';
      randomPauses: boolean;
    };
  };
  
  browserSpoofing: {
    userAgent: string | 'auto' | 'rotate';
    userAgentPool: string[];
    languages: string[];
    platform: string;
    hardwareConcurrency: number;
    deviceMemory: number;
    maxTouchPoints: number;
  };
  
  networkEvasion: {
    headers: Record<string, string>;
    randomizeHeaders: boolean;
    requestDelay: { min: number; max: number };
    requestJitter: number;
    proxyRotation: boolean;
  };
}
```

## Best Practices

1. **Gradual Implementation**: Start with basic stealth features and add more as needed
2. **Testing**: Regularly test against bot detection services
3. **Updates**: Keep stealth techniques updated as detection methods evolve
4. **Performance**: Monitor the performance impact of stealth features
5. **Compliance**: Ensure stealth usage complies with website terms of service
6. **Ethical Use**: Use stealth capabilities responsibly and ethically

## Troubleshooting

### Common Issues

#### Still Getting Detected
```typescript
// Increase stealth level
const stealth = new StealthMode({
  enabled: true,
  detectionLevel: 'maximum', // 'minimal', 'standard', 'maximum'
  customEvasions: ['headless-detection', 'automation-detection'],
});
```

#### Performance Impact
```typescript
// Optimize for performance
const stealth = new StealthMode({
  performance: {
    lowResource: true,
    selectiveFeatures: ['canvas', 'webgl'], // Only essential features
    backgroundOptimization: true,
  },
});
```

#### Browser Compatibility
```typescript
// Check browser support
const isSupported = await stealth.checkBrowserSupport(browser);
if (!isSupported) {
  console.warn('Some stealth features may not work in this browser');
}
```

### Debug Mode

```typescript
const stealth = new StealthMode({
  debug: true, // Enable detailed logging
  metrics: true, // Collect performance metrics
});

// Monitor stealth effectiveness
const report = stealth.getDetectionReport();
console.log({
  detectionAttempts: report.detectionAttempts,
  successfulEvasions: report.successfulEvasions,
  failedEvasions: report.failedEvasions,
});
```