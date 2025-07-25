import { chromium, Browser } from 'playwright';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { BrowserExplorer } from '../../index';
import { MonitoringService } from '../../monitoring';
import { SessionManager } from '../../auth/SessionManager';
import { StealthMode } from '../../stealth';
import { CaptchaHandler } from '../../captcha';
import type { Request, Response } from 'express';
import type { Server } from 'http';

describe('BrowserExplorer Integration Tests', () => {
  let browser: Browser;
  let testConfigPath: string;
  let testOutputDir: string;
  let testPort: number;
  let testServer: Server | null;

  beforeAll(async () => {
    // Start a test server
    testPort = 3001;

    // Create temporary directories
    const tempDir = join(tmpdir(), 'browser-explorer-test');
    testConfigPath = join(tempDir, 'test-config.yaml');
    testOutputDir = join(tempDir, 'test-output');

    mkdirSync(tempDir, { recursive: true });
    mkdirSync(testOutputDir, { recursive: true });

    // Create test configuration
    const testConfig = `
crawling:
  startUrl: http://localhost:${testPort}
  maxDepth: 2
  maxPages: 10
  crawlDelay: 100
  parallelWorkers: 2
  allowedDomains:
    - localhost
  respectRobotsTxt: false
  userAgent: "BrowserExplorer-Test/1.0"

browser:
  headless: true
  viewport:
    width: 1280
    height: 720
  timeout: 30000

generation:
  framework: "playwright"
  language: "typescript"
  outputDirectory: "${testOutputDir}"
  generatePageObjects: true
  generateFixtures: true
  generateHelpers: true
  useAAAPattern: true
  addComments: true
  testNamingConvention: "describe-it"
  formatting:
    indentSize: 2
    singleQuotes: true
    semicolons: true

authentication:
  strategies:
    basic:
      enabled: true
    oauth:
      enabled: false
    mfa:
      enabled: false

monitoring:
  enabled: true
  metricsCollection:
    enabled: true
    flushInterval: 5000
    exportFormat: "console"
  tracing:
    enabled: true
    samplingRate: 1.0
  alerting:
    enabled: true
    thresholds:
      errorRate: 0.1
      responseTime: 5000
`;

    writeFileSync(testConfigPath, testConfig);

    // Start Playwright browser
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }

    if (testServer) {
      testServer.close();
    }

    // Clean up temporary files
    try {
      rmSync(join(tmpdir(), 'browser-explorer-test'), { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Start a simple test server for each test
    const express = require('express');
    const app = express();

    app.use(express.static(join(__dirname, 'fixtures')));

    // Basic test pages
    app.get('/', (_req: Request, res: Response) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Test Home Page</title></head>
        <body>
          <h1>Welcome to Test Site</h1>
          <nav>
            <a href="/about" id="about-link">About</a>
            <a href="/contact" id="contact-link">Contact</a>
            <a href="/login" id="login-link">Login</a>
          </nav>
          <form id="search-form" action="/search" method="get">
            <input type="text" name="q" placeholder="Search..." id="search-input">
            <button type="submit" id="search-button">Search</button>
          </form>
          <div id="content">
            <p>This is a test page for the Browser Explorer.</p>
            <button onclick="alert('Clicked!')" id="alert-button">Click Me</button>
          </div>
        </body>
        </html>
      `);
    });

    app.get('/about', (_req: Request, res: Response) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>About - Test Site</title></head>
        <body>
          <h1>About Us</h1>
          <a href="/" id="home-link">Home</a>
          <p>This is the about page.</p>
          <form id="feedback-form" action="/feedback" method="post">
            <label for="name">Name:</label>
            <input type="text" id="name" name="name" required>
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" required>
            <label for="message">Message:</label>
            <textarea id="message" name="message" required></textarea>
            <button type="submit" id="submit-feedback">Submit</button>
          </form>
        </body>
        </html>
      `);
    });

    app.get('/contact', (_req: Request, res: Response) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Contact - Test Site</title></head>
        <body>
          <h1>Contact Us</h1>
          <a href="/" id="home-link">Home</a>
          <div id="contact-info">
            <p>Email: test@example.com</p>
            <p>Phone: (555) 123-4567</p>
          </div>
        </body>
        </html>
      `);
    });

    app.get('/login', (_req: Request, res: Response) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Login - Test Site</title></head>
        <body>
          <h1>Login</h1>
          <a href="/" id="home-link">Home</a>
          <form id="login-form" action="/auth" method="post">
            <label for="username">Username:</label>
            <input type="text" id="username" name="username" required>
            <label for="password">Password:</label>
            <input type="password" id="password" name="password" required>
            <button type="submit" id="login-button">Login</button>
          </form>
        </body>
        </html>
      `);
    });

    testServer = app.listen(testPort);

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterEach(() => {
    if (testServer) {
      testServer.close();
      testServer = null;
    }
  });

  describe('Full Exploration Workflow', () => {
    it('should complete a full website exploration and generate tests', async () => {
      const explorer = new BrowserExplorer();

      try {
        await explorer.initialize(testConfigPath);

        const result = await explorer.explore();

        expect(result).toBeDefined();
        expect(result.crawlResult).toBeDefined();
        expect(result.generationResult).toBeDefined();
        expect(result.testsGenerated).toBeGreaterThan(0);
        expect(result.filesCreated).toBeGreaterThan(0);

        // Verify crawl results
        expect(result.crawlResult.crawledUrls).toBeDefined();
        expect(result.crawlResult.crawledUrls.length).toBeGreaterThan(0);
        expect(result.crawlResult.statistics).toBeDefined();
        expect(result.crawlResult.statistics.totalPages).toBeGreaterThan(0);

        // Verify generation results
        expect(result.generationResult.files).toBeDefined();
        expect(result.generationResult.files.length).toBeGreaterThan(0);
        expect(result.generationResult.summary).toBeDefined();
      } finally {
        await explorer.cleanup();
      }
    }, 30000);

    it('should handle configuration loading correctly', async () => {
      const explorer = new BrowserExplorer();

      await explorer.initialize(testConfigPath);

      const config = explorer.getConfig();
      expect(config).toBeDefined();
      expect(config!.crawling.startUrl).toBe(`http://localhost:${testPort}`);
      expect(config!.crawling.maxDepth).toBe(2);
      expect(config!.generation.framework).toBe('playwright');
    });

    it('should respect crawling limits', async () => {
      // Create a config with very limited crawling
      const limitedConfig = testConfigPath.replace('.yaml', '-limited.yaml');
      const limitedConfigContent = `
crawling:
  startUrl: http://localhost:${testPort}
  maxDepth: 1
  maxPages: 2
  crawlDelay: 50
  parallelWorkers: 1

browser:
  headless: true
  timeout: 5000

generation:
  framework: "playwright"
  language: "typescript"
  outputDirectory: "${testOutputDir}"
  generatePageObjects: false
  generateFixtures: false
`;

      writeFileSync(limitedConfig, limitedConfigContent);

      const explorer = new BrowserExplorer();

      try {
        await explorer.initialize(limitedConfig);
        const result = await explorer.explore();

        expect(result.crawlResult.crawledUrls.length).toBeLessThanOrEqual(2);
      } finally {
        await explorer.cleanup();
      }
    }, 15000);
  });

  describe('Component Integration', () => {
    it('should integrate monitoring service correctly', async () => {
      const monitoring = new MonitoringService({
        enabled: true,
        metricsCollection: {
          enabled: true,
          flushInterval: 1000,
          maxMetrics: 100,
          exportFormat: 'console',
        },
        tracing: { enabled: true, samplingRate: 1.0, maxSpans: 100 },
        reporting: { enabled: false, interval: 5000, includeSummary: true },
      });

      await monitoring.initialize();

      // Record some test metrics
      monitoring.recordCounter('test_requests', 5);
      monitoring.recordGauge('test_memory', 1024);
      monitoring.trackPageRequest('http://localhost:3001', true, 250, 512);

      const spanId = monitoring.startSpan('test_operation');
      monitoring.addSpanTag(spanId, 'test', 'integration');
      monitoring.finishSpan(spanId);

      // Generate report
      const report = await monitoring.generateReport();

      expect(report).toBeDefined();
      expect(report.crawlMetrics.totalRequests).toBe(1);
      expect(report.crawlMetrics.successfulRequests).toBe(1);
      expect(report.systemMetrics).toBeDefined();
      expect(report.summary.overallHealth).toBeDefined();

      const metrics = monitoring.getMetrics();
      expect(Object.keys(metrics).length).toBeGreaterThan(0);

      const traces = monitoring.getTraces();
      expect(traces.length).toBe(1);
      expect(traces[0]?.operationName).toBe('test_operation');

      await monitoring.shutdown();
    }, 10000);

    it('should integrate stealth mode correctly', async () => {
      const page = await browser.newPage();
      const stealth = new StealthMode({
        userAgents: {
          enabled: true,
          rotateOnNewPage: true,
        },
        viewport: {
          randomize: true,
          commonSizes: [{ width: 1920, height: 1080 }],
        },
        timing: {
          humanLikeDelays: true,
          minDelay: 100,
          maxDelay: 500,
          typingSpeed: {
            min: 50,
            max: 150,
          },
        },
        fingerprinting: {
          spoofWebGL: true,
          spoofCanvas: true,
          spoofAudio: true,
          spoofTimezone: false,
          spoofLanguages: false,
        },
        navigation: {
          randomScrolling: false,
          mouseMoves: true,
          refererSpoofing: false,
        },
        headers: {
          acceptLanguage: ['en-US', 'en'],
          acceptEncoding: ['gzip', 'deflate'],
          customHeaders: {},
        },
      });

      try {
        await stealth.setupStealthPage(page);
        await stealth.navigateStealthily(page, `http://localhost:${testPort}`);

        const title = await page.title();
        expect(title).toBe('Test Home Page');

        // Test stealthy typing
        await stealth.typeStealthily(page, '#search-input', 'test query');

        const inputValue = await page.inputValue('#search-input');
        expect(inputValue).toBe('test query');
      } finally {
        await page.close();
      }
    }, 10000);

    it('should integrate CAPTCHA handler correctly', async () => {
      const page = await browser.newPage();
      const captchaHandler = new CaptchaHandler({
        autoDetect: true,
        solveAttempts: 2,
        timeout: 5000,
        manualSolving: {
          enabled: false,
          promptUser: false,
          timeout: 1000,
        },
      });

      try {
        await page.goto(`http://localhost:${testPort}`);

        // Test CAPTCHA detection (should not find any on our test page)
        const detection = await captchaHandler.detectCaptcha(page);
        expect(detection.detected).toBe(false);
        expect(detection.type).toBe('unknown');

        // Test workflow
        const workflowResult = await captchaHandler.handleCaptchaWorkflow(page);
        expect(workflowResult).toBe(true); // Should succeed since no CAPTCHA present
      } finally {
        await page.close();
      }
    }, 10000);

    it('should integrate session manager correctly', async () => {
      const sessionManager = new SessionManager({
        storage: {
          type: 'memory',
        },
        encryption: {
          enabled: false,
        },
        cleanup: {
          enabled: true,
          maxAge: 3600000,
          interval: 60000,
        },
      });

      const page = await browser.newPage();

      try {
        await page.goto(`http://localhost:${testPort}/login`);

        // Fill in login form
        await page.fill('#username', 'testuser');
        await page.fill('#password', 'testpass');

        // Capture session before login
        const sessionId = 'test-session-123';
        await sessionManager.captureSessionFromPage(page, sessionId, 'localhost', 'basic');

        // Load session
        const session = await sessionManager.loadSession(sessionId, 'localhost');
        expect(session).toBeDefined();
        expect(session?.cookies).toBeDefined();

        // Test session restoration
        const newPage = await browser.newPage();
        const restoreResult = await sessionManager.restoreSessionToPage(
          newPage,
          sessionId,
          'localhost'
        );
        expect(restoreResult).toBe(true);

        await newPage.close();

        // Cleanup
        await sessionManager.cleanupExpiredSessions();
      } finally {
        await page.close();
      }
    }, 10000);
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid URLs gracefully', async () => {
      const explorer = new BrowserExplorer();

      try {
        await explorer.initialize(testConfigPath);

        // This should throw an error
        await expect(explorer.explore('invalid-url')).rejects.toThrow();
      } finally {
        await explorer.cleanup();
      }
    });

    it('should handle network timeouts', async () => {
      // Create config with very short timeout
      const timeoutConfig = testConfigPath.replace('.yaml', '-timeout.yaml');
      const timeoutConfigContent = `
crawling:
  startUrl: http://localhost:9999  # Non-existent server
  maxDepth: 1
  maxPages: 1
  crawlDelay: 50

browser:
  headless: true
  timeout: 1000  # Very short timeout

generation:
  framework: "playwright"
  language: "typescript"
  outputDirectory: "${testOutputDir}"
`;

      writeFileSync(timeoutConfig, timeoutConfigContent);

      const explorer = new BrowserExplorer();

      try {
        await explorer.initialize(timeoutConfig);

        // This should handle the timeout gracefully
        await expect(explorer.explore()).rejects.toThrow();
      } finally {
        await explorer.cleanup();
      }
    }, 15000);

    it('should handle missing configuration files', async () => {
      // Mock fs.readFile to reject for non-existent files
      const fs = require('fs/promises');
      const originalReadFile = fs.readFile;
      fs.readFile.mockImplementation((path: string) => {
        if (path === '/non-existent/config.yaml') {
          return Promise.reject(new Error('ENOENT: no such file or directory'));
        }
        return originalReadFile(path);
      });
      
      const explorer = new BrowserExplorer();

      await expect(explorer.initialize('/non-existent/config.yaml')).rejects.toThrow();
      
      // Restore original mock
      fs.readFile.mockImplementation(originalReadFile);
    });

    it('should require initialization before exploration', async () => {
      const explorer = new BrowserExplorer();

      await expect(explorer.explore()).rejects.toThrow('BrowserExplorer not initialized');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent operations', async () => {
      const monitoring = new MonitoringService({
        enabled: true,
        reporting: {
          enabled: false,
          interval: 60000,
          includeSummary: false,
        },
      });

      await monitoring.initialize();

      // Simulate concurrent operations
      const operations = [];
      for (let i = 0; i < 10; i++) {
        const operation = monitoring.timeFunction(
          `concurrent_operation_${i}`,
          async () => {
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));
            return `result_${i}`;
          },
          { operation: 'concurrent_test' }
        );
        operations.push(operation);
      }

      const results = await Promise.all(operations);
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result).toBe(`result_${index}`);
      });

      const metrics = monitoring.getMetrics();
      expect(Object.keys(metrics)).toContain('concurrent_operation_0');

      await monitoring.shutdown();
    }, 10000);

    it('should handle memory cleanup correctly', async () => {
      const explorer = new BrowserExplorer();

      try {
        await explorer.initialize(testConfigPath);

        // Run multiple explorations to test memory cleanup
        for (let i = 0; i < 3; i++) {
          const result = await explorer.explore();
          expect(result).toBeDefined();

          // Add small delay between runs
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } finally {
        await explorer.cleanup();
      }
    }, 45000);
  });
});
