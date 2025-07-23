#!/usr/bin/env node

import { Command } from 'commander';
import { SelfTestRunner, SelfTestConfig } from './SelfTestRunner';
import { logger } from '../utils/logger';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const program = new Command();

program
  .name('browser-explorer-self-test')
  .description('Browser Explorer Self-Test Runner')
  .version('1.0.0');

program
  .command('run')
  .description('Run the complete self-test suite')
  .option('-o, --output <dir>', 'Output directory for test reports', './self-test-reports')
  .option('--skip-browser', 'Skip browser-dependent tests', false)
  .option('--timeout <ms>', 'Test timeout in milliseconds', '30000')
  .option('--retries <count>', 'Number of retry attempts for failed tests', '2')
  .option('--components <list>', 'Comma-separated list of components to test', 'all')
  .option('--performance-only', 'Run only performance tests', false)
  .option('--quick', 'Run a quick subset of tests', false)
  .option('--verbose', 'Enable verbose logging', false)
  .action(async (options) => {
    try {
      if (options.verbose) {
        logger.level = 'debug';
      }

      // Ensure output directory exists
      if (!existsSync(options.output)) {
        mkdirSync(options.output, { recursive: true });
      }

      const config: Partial<SelfTestConfig> = {
        outputDirectory: options.output,
        skipBrowserTests: options.skipBrowser,
        testTimeout: parseInt(options.timeout),
        retryAttempts: parseInt(options.retries),
      };

      // Configure component tests
      if (options.components !== 'all') {
        const components = options.components.split(',').map((c: string) => c.trim());
        config.componentTests = {
          crawler: components.includes('crawler'),
          detector: components.includes('detector'),
          executor: components.includes('executor'),
          recorder: components.includes('recorder'),
          generator: components.includes('generator'),
          monitoring: components.includes('monitoring'),
          auth: components.includes('auth'),
          stealth: components.includes('stealth'),
          captcha: components.includes('captcha'),
          config: components.includes('config'),
        };
      }

      // Quick test configuration
      if (options.quick) {
        config.componentTests = {
          crawler: true,
          detector: true,
          executor: false,
          recorder: false,
          generator: false,
          monitoring: true,
          auth: false,
          stealth: false,
          captcha: false,
          config: true,
        };
        config.skipBrowserTests = true;
        config.testTimeout = 10000;
      }

      const runner = new SelfTestRunner(config);
      
      console.log('🚀 Starting Browser Explorer Self-Test Suite...');
      console.log(`📁 Output directory: ${options.output}`);
      console.log(`⏱️  Test timeout: ${config.testTimeout}ms`);
      console.log(`🔄 Retry attempts: ${config.retryAttempts}`);
      console.log('');

      const report = await runner.runAllTests();

      // Display results
      console.log('');
      console.log('📊 Test Results Summary:');
      console.log('=' .repeat(50));
      console.log(`Total Tests: ${report.summary.totalTests}`);
      console.log(`✅ Passed: ${report.summary.passedTests}`);
      console.log(`❌ Failed: ${report.summary.failedTests}`);
      console.log(`⏭️  Skipped: ${report.summary.skippedTests}`);
      console.log(`📈 Success Rate: ${(report.summary.successRate * 100).toFixed(1)}%`);
      console.log(`⏱️  Total Duration: ${(report.summary.totalDuration / 1000).toFixed(2)}s`);
      console.log(`🏥 Overall Health: ${getHealthEmoji(report.summary.overallHealth)} ${report.summary.overallHealth.toUpperCase()}`);
      console.log('');

      if (report.summary.failedTests > 0) {
        console.log('❌ Failed Tests:');
        console.log('-'.repeat(30));
        report.results
          .filter(r => !r.success)
          .forEach(test => {
            console.log(`  • ${test.name}: ${test.error || 'Unknown error'}`);
          });
        console.log('');
      }

      if (report.recommendations.length > 0) {
        console.log('💡 Recommendations:');
        console.log('-'.repeat(30));
        report.recommendations.forEach((rec, index) => {
          console.log(`  ${index + 1}. ${rec}`);
        });
        console.log('');
      }

      // Environment info
      console.log('🖥️  Environment:');
      console.log('-'.repeat(20));
      console.log(`Node.js: ${report.environment.nodeVersion}`);
      console.log(`Platform: ${report.environment.platform} (${report.environment.architecture})`);
      console.log(`Memory: ${(report.environment.memoryUsed / 1024 / 1024).toFixed(0)}MB / ${(report.environment.memoryTotal / 1024 / 1024).toFixed(0)}MB`);
      console.log('');

      const reportFile = join(options.output, `self-test-report-${Date.now()}.json`);
      console.log(`📄 Detailed report saved to: ${reportFile}`);

      // Exit with appropriate code
      process.exit(report.summary.failedTests > 0 ? 1 : 0);

    } catch (error) {
      console.error('❌ Self-test suite failed:', error);
      process.exit(1);
    }
  });

program
  .command('quick')
  .description('Run a quick health check')
  .option('-o, --output <dir>', 'Output directory for test reports', './self-test-reports')
  .option('--verbose', 'Enable verbose logging', false)
  .action(async (options) => {
    try {
      if (options.verbose) {
        logger.level = 'debug';
      }

      const config: Partial<SelfTestConfig> = {
        outputDirectory: options.output,
        skipBrowserTests: true,
        testTimeout: 5000,
        retryAttempts: 1,
        componentTests: {
          crawler: false,
          detector: true,
          executor: false,
          recorder: false,
          generator: false,
          monitoring: true,
          auth: false,
          stealth: false,
          captcha: false,
          config: true,
        },
      };

      const runner = new SelfTestRunner(config);
      
      console.log('⚡ Running quick health check...');
      
      const report = await runner.runAllTests();

      console.log('');
      console.log(`🏥 System Health: ${getHealthEmoji(report.summary.overallHealth)} ${report.summary.overallHealth.toUpperCase()}`);
      console.log(`📈 Tests: ${report.summary.passedTests}/${report.summary.totalTests} passed`);
      
      if (report.summary.failedTests > 0) {
        console.log('⚠️  Issues detected. Run full test suite for details.');
      }

      process.exit(report.summary.failedTests > 0 ? 1 : 0);

    } catch (error) {
      console.error('❌ Quick health check failed:', error);
      process.exit(1);
    }
  });

program
  .command('components')
  .description('List available components for testing')
  .action(() => {
    console.log('Available Components:');
    console.log('==================');
    console.log('• crawler     - Web crawling functionality');
    console.log('• detector    - Element detection and classification');
    console.log('• executor    - Interaction execution strategies');
    console.log('• recorder    - User path recording');
    console.log('• generator   - Test code generation');
    console.log('• monitoring  - Metrics collection and tracing');
    console.log('• auth        - Authentication strategies');
    console.log('• stealth     - Anti-bot detection evasion');
    console.log('• captcha     - CAPTCHA detection and handling');
    console.log('• config      - Configuration management');
    console.log('');
    console.log('Usage examples:');
    console.log('  # Test specific components');
    console.log('  browser-explorer-self-test run --components crawler,detector,monitoring');
    console.log('');
    console.log('  # Test all components (default)');
    console.log('  browser-explorer-self-test run --components all');
  });

program
  .command('validate')
  .description('Validate system requirements and configuration')
  .action(async () => {
    console.log('🔍 Validating system requirements...');
    console.log('');

    const checks = [
      {
        name: 'Node.js Version',
        check: () => {
          const version = process.version;
          const major = parseInt(version.substring(1).split('.')[0]);
          return { success: major >= 16, details: version };
        }
      },
      {
        name: 'Available Memory',
        check: () => {
          const totalMem = require('os').totalmem();
          const freeMem = require('os').freemem();
          const totalGB = totalMem / 1024 / 1024 / 1024;
          const freeGB = freeMem / 1024 / 1024 / 1024;
          return { 
            success: totalGB >= 4, 
            details: `${totalGB.toFixed(1)}GB total, ${freeGB.toFixed(1)}GB free` 
          };
        }
      },
      {
        name: 'Playwright Browsers',
        check: async () => {
          try {
            const { chromium } = require('playwright');
            const browser = await chromium.launch({ headless: true });
            await browser.close();
            return { success: true, details: 'Chromium available' };
          } catch (error) {
            return { success: false, details: 'Run: npx playwright install' };
          }
        }
      },
      {
        name: 'Write Permissions',
        check: () => {
          try {
            const testFile = join(process.cwd(), '.test-write-permission');
            require('fs').writeFileSync(testFile, 'test');
            require('fs').unlinkSync(testFile);
            return { success: true, details: 'Write access verified' };
          } catch (error) {
            return { success: false, details: 'No write access to current directory' };
          }
        }
      }
    ];

    let allPassed = true;

    for (const check of checks) {
      try {
        const result = await check.check();
        const status = result.success ? '✅' : '❌';
        console.log(`${status} ${check.name}: ${result.details}`);
        if (!result.success) allPassed = false;
      } catch (error) {
        console.log(`❌ ${check.name}: Error - ${error}`);
        allPassed = false;
      }
    }

    console.log('');
    if (allPassed) {
      console.log('🎉 All system requirements validated successfully!');
      console.log('   You can now run the self-test suite.');
    } else {
      console.log('⚠️  Some requirements failed validation.');
      console.log('   Please address the issues above before running tests.');
    }

    process.exit(allPassed ? 0 : 1);
  });

function getHealthEmoji(health: string): string {
  switch (health) {
    case 'healthy': return '💚';
    case 'degraded': return '💛';
    case 'unhealthy': return '❤️';
    default: return '❓';
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
  process.exit(1);
});

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}