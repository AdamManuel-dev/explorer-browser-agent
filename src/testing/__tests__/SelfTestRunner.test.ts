import { join } from 'path';
import { tmpdir } from 'os';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { SelfTestRunner } from '../SelfTestRunner';

// Mock external dependencies
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue({
      newPage: jest.fn().mockResolvedValue({
        setContent: jest.fn(),
        fill: jest.fn(),
        click: jest.fn(),
        close: jest.fn(),
      }),
      close: jest.fn(),
    }),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('SelfTestRunner', () => {
  let testRunner: SelfTestRunner;
  let tempTestDir: string;

  beforeEach(() => {
    tempTestDir = join(tmpdir(), 'selftest-runner-test', Date.now().toString());
    mkdirSync(tempTestDir, { recursive: true });

    testRunner = new SelfTestRunner({
      skipBrowserTests: true, // Skip browser tests in unit tests
      testTimeout: 5000,
      retryAttempts: 1,
      outputDirectory: tempTestDir,
      componentTests: {
        crawler: false, // Disable to speed up tests
        detector: true,
        executor: true,
        recorder: false,
        generator: false,
        monitoring: true,
        auth: true,
        stealth: true,
        captcha: true,
        config: true,
      },
    });
  });

  afterEach(() => {
    try {
      if (existsSync(tempTestDir)) {
        rmSync(tempTestDir, { recursive: true, force: true });
      }
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Configuration', () => {
    it('should use default configuration when none provided', () => {
      const defaultRunner = new SelfTestRunner();
      expect(defaultRunner).toBeDefined();
    });

    it('should merge provided configuration with defaults', () => {
      const customRunner = new SelfTestRunner({
        testTimeout: 10000,
        retryAttempts: 3,
      });
      expect(customRunner).toBeDefined();
    });
  });

  describe('Component Tests', () => {
    it('should run config manager test', async () => {
      const runner = new SelfTestRunner({
        skipBrowserTests: true,
        testTimeout: 5000,
        componentTests: {
          config: true,
          crawler: false,
          detector: false,
          executor: false,
          recorder: false,
          generator: false,
          monitoring: false,
          auth: false,
          stealth: false,
          captcha: false,
        },
      });

      const report = await runner.runAllTests();

      expect(report).toBeDefined();
      expect(report.results.length).toBeGreaterThan(0);

      const configTest = report.results.find((r) => r.name === 'Config Manager');
      expect(configTest).toBeDefined();
    }, 10000);

    it('should run monitoring service test', async () => {
      const runner = new SelfTestRunner({
        skipBrowserTests: true,
        testTimeout: 5000,
        componentTests: {
          monitoring: true,
          config: false,
          crawler: false,
          detector: false,
          executor: false,
          recorder: false,
          generator: false,
          auth: false,
          stealth: false,
          captcha: false,
        },
      });

      const report = await runner.runAllTests();

      const monitoringTest = report.results.find((r) => r.name === 'Monitoring Service');
      expect(monitoringTest).toBeDefined();
      expect(monitoringTest?.success).toBe(true);
    }, 10000);

    it('should run element detector test', async () => {
      const runner = new SelfTestRunner({
        skipBrowserTests: true,
        testTimeout: 5000,
        componentTests: {
          detector: true,
          config: false,
          crawler: false,
          executor: false,
          recorder: false,
          generator: false,
          monitoring: false,
          auth: false,
          stealth: false,
          captcha: false,
        },
      });

      const report = await runner.runAllTests();

      const detectorTest = report.results.find((r) => r.name === 'Element Detector');
      expect(detectorTest).toBeDefined();
      expect(detectorTest?.success).toBe(true);
    }, 10000);

    it('should run interaction executor test', async () => {
      const runner = new SelfTestRunner({
        skipBrowserTests: true,
        testTimeout: 5000,
        componentTests: {
          executor: true,
          config: false,
          crawler: false,
          detector: false,
          recorder: false,
          generator: false,
          monitoring: false,
          auth: false,
          stealth: false,
          captcha: false,
        },
      });

      const report = await runner.runAllTests();

      const executorTest = report.results.find((r) => r.name === 'Interaction Executor');
      expect(executorTest).toBeDefined();
      expect(executorTest?.success).toBe(true);
    }, 10000);

    it('should run authentication manager test', async () => {
      const runner = new SelfTestRunner({
        skipBrowserTests: true,
        testTimeout: 5000,
        componentTests: {
          auth: true,
          config: false,
          crawler: false,
          detector: false,
          executor: false,
          recorder: false,
          generator: false,
          monitoring: false,
          stealth: false,
          captcha: false,
        },
      });

      const report = await runner.runAllTests();

      const authTest = report.results.find((r) => r.name === 'Authentication Manager');
      expect(authTest).toBeDefined();
      expect(authTest?.success).toBe(true);
    }, 10000);

    it('should run stealth mode test', async () => {
      const runner = new SelfTestRunner({
        skipBrowserTests: true,
        testTimeout: 5000,
        componentTests: {
          stealth: true,
          config: false,
          crawler: false,
          detector: false,
          executor: false,
          recorder: false,
          generator: false,
          monitoring: false,
          auth: false,
          captcha: false,
        },
      });

      const report = await runner.runAllTests();

      const stealthTest = report.results.find((r) => r.name === 'Stealth Mode');
      expect(stealthTest).toBeDefined();
      expect(stealthTest?.success).toBe(true);
    }, 10000);

    it('should run captcha handler test', async () => {
      const runner = new SelfTestRunner({
        skipBrowserTests: true,
        testTimeout: 5000,
        componentTests: {
          captcha: true,
          config: false,
          crawler: false,
          detector: false,
          executor: false,
          recorder: false,
          generator: false,
          monitoring: false,
          auth: false,
          stealth: false,
        },
      });

      const report = await runner.runAllTests();

      const captchaTest = report.results.find((r) => r.name === 'CAPTCHA Handler');
      expect(captchaTest).toBeDefined();
      expect(captchaTest?.success).toBe(true);
    }, 10000);
  });

  describe('Performance Tests', () => {
    it('should run memory usage performance test', async () => {
      const runner = new SelfTestRunner({
        skipBrowserTests: true,
        testTimeout: 10000,
        componentTests: {
          config: false,
          crawler: false,
          detector: false,
          executor: false,
          recorder: false,
          generator: false,
          monitoring: false,
          auth: false,
          stealth: false,
          captcha: false,
        },
      });

      const report = await runner.runAllTests();

      const memoryTest = report.results.find((r) => r.name === 'Memory Usage');
      expect(memoryTest).toBeDefined();
      expect(memoryTest?.success).toBe(true);
      expect(memoryTest?.metrics).toBeDefined();
      expect(memoryTest?.metrics?.initialMemoryMB).toBeGreaterThan(0);
    }, 15000);

    it('should run concurrent operations test', async () => {
      const runner = new SelfTestRunner({
        skipBrowserTests: true,
        testTimeout: 10000,
        componentTests: {
          config: false,
          crawler: false,
          detector: false,
          executor: false,
          recorder: false,
          generator: false,
          monitoring: true, // Need monitoring for concurrent test
          auth: false,
          stealth: false,
          captcha: false,
        },
      });

      const report = await runner.runAllTests();

      const concurrentTest = report.results.find((r) => r.name === 'Concurrent Operations');
      expect(concurrentTest).toBeDefined();
      expect(concurrentTest?.success).toBe(true);
      expect(concurrentTest?.metrics?.operationsCompleted).toBe(10);
    }, 15000);
  });

  describe('Test Reporting', () => {
    it('should generate comprehensive test report', async () => {
      const report = await testRunner.runAllTests();

      expect(report).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.environment).toBeDefined();
      expect(report.environment.nodeVersion).toBeTruthy();
      expect(report.environment.platform).toBeTruthy();
      expect(report.configuration).toBeDefined();
      expect(report.results).toBeInstanceOf(Array);
      expect(report.summary).toBeDefined();
      expect(report.recommendations).toBeInstanceOf(Array);
    }, 15000);

    it('should calculate correct summary statistics', async () => {
      const report = await testRunner.runAllTests();

      expect(report.summary.totalTests).toBeGreaterThan(0);
      expect(
        report.summary.passedTests + report.summary.failedTests + report.summary.skippedTests
      ).toBe(report.summary.totalTests);
      expect(report.summary.successRate).toBeGreaterThanOrEqual(0);
      expect(report.summary.successRate).toBeLessThanOrEqual(1);
      expect(report.summary.totalDuration).toBeGreaterThan(0);
      expect(['healthy', 'degraded', 'unhealthy']).toContain(report.summary.overallHealth);
    }, 15000);

    it('should include environment information', async () => {
      const report = await testRunner.runAllTests();

      expect(report.environment.nodeVersion).toMatch(/^v\d+\.\d+\.\d+/);
      expect(report.environment.platform).toBeTruthy();
      expect(report.environment.architecture).toBeTruthy();
      expect(report.environment.memoryTotal).toBeGreaterThan(0);
      expect(report.environment.memoryUsed).toBeGreaterThan(0);
    }, 10000);

    it('should provide actionable recommendations', async () => {
      const report = await testRunner.runAllTests();

      expect(report.recommendations).toBeInstanceOf(Array);
      // Should have at least one recommendation (success message or improvement suggestion)
      expect(report.recommendations.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle test timeouts gracefully', async () => {
      const timeoutRunner = new SelfTestRunner({
        skipBrowserTests: true,
        testTimeout: 1, // Very short timeout to trigger timeout
        retryAttempts: 0,
        componentTests: {
          config: true,
          crawler: false,
          detector: false,
          executor: false,
          recorder: false,
          generator: false,
          monitoring: false,
          auth: false,
          stealth: false,
          captcha: false,
        },
      });

      const report = await timeoutRunner.runAllTests();

      expect(report.summary.failedTests).toBeGreaterThan(0);
      const failedTest = report.results.find((r) => !r.success);
      expect(failedTest?.error).toContain('timeout');
    }, 10000);

    it('should retry failed tests according to configuration', async () => {
      const retryRunner = new SelfTestRunner({
        skipBrowserTests: true,
        testTimeout: 5000,
        retryAttempts: 2, // Allow retries
        componentTests: {
          config: true,
          crawler: false,
          detector: false,
          executor: false,
          recorder: false,
          generator: false,
          monitoring: false,
          auth: false,
          stealth: false,
          captcha: false,
        },
      });

      const report = await retryRunner.runAllTests();

      // Even with retries, config test should eventually pass
      const configTest = report.results.find((r) => r.name === 'Config Manager');
      expect(configTest).toBeDefined();
    }, 15000);

    it('should continue running tests even if some fail', async () => {
      const partialFailureRunner = new SelfTestRunner({
        skipBrowserTests: true,
        testTimeout: 5000,
        retryAttempts: 0,
        componentTests: {
          config: true,
          detector: true,
          executor: true,
          crawler: false,
          recorder: false,
          generator: false,
          monitoring: false,
          auth: false,
          stealth: false,
          captcha: false,
        },
      });

      const report = await partialFailureRunner.runAllTests();

      // Should have run multiple tests even if some fail
      expect(report.results.length).toBeGreaterThan(1);
      expect(report.summary.totalTests).toBeGreaterThan(1);
    }, 15000);
  });

  describe('Configuration Validation', () => {
    it('should skip tests when components are disabled', async () => {
      const selectiveRunner = new SelfTestRunner({
        skipBrowserTests: true,
        componentTests: {
          config: true,
          crawler: false,
          detector: false,
          executor: false,
          recorder: false,
          generator: false,
          monitoring: false,
          auth: false,
          stealth: false,
          captcha: false,
        },
      });

      const report = await selectiveRunner.runAllTests();

      // Should only run config test
      const configTest = report.results.find((r) => r.name === 'Config Manager');
      expect(configTest).toBeDefined();
      expect(configTest?.success).toBe(true);

      // Other tests should be skipped
      const skippedTests = report.results.filter((r) => r.details?.skipped);
      expect(skippedTests.length).toBeGreaterThan(0);
    }, 10000);

    it('should respect browser test skip flag', async () => {
      const noBrowserRunner = new SelfTestRunner({
        skipBrowserTests: true,
        componentTests: {
          config: true,
          crawler: false,
          detector: false,
          executor: false,
          recorder: false,
          generator: false,
          monitoring: false,
          auth: false,
          stealth: false,
          captcha: false,
        },
      });

      const report = await noBrowserRunner.runAllTests();

      // Should not contain any browser-specific tests
      const browserTests = report.results.filter(
        (r) =>
          r.name.includes('Basic Crawling') ||
          r.name.includes('Element Detection') ||
          r.name.includes('User Path Recording')
      );
      expect(browserTests.length).toBe(0);
    }, 10000);
  });
});
