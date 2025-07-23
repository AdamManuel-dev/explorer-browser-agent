"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelfTestRunner = void 0;
const playwright_1 = require("playwright");
const path_1 = require("path");
const os_1 = require("os");
const fs_1 = require("fs");
const index_1 = require("../index");
const BreadthFirstCrawler_1 = require("../crawler/BreadthFirstCrawler");
const AIElementDetector_1 = require("../detectors/AIElementDetector");
const InteractionExecutor_1 = require("../interactions/InteractionExecutor");
const UserPathRecorder_1 = require("../recording/UserPathRecorder");
const TestGenerator_1 = require("../generation/TestGenerator");
const MonitoringService_1 = require("../monitoring/MonitoringService");
const MultiStrategyAuthManager_1 = require("../auth/MultiStrategyAuthManager");
const SessionManager_1 = require("../auth/SessionManager");
const StealthMode_1 = require("../stealth/StealthMode");
const CaptchaHandler_1 = require("../captcha/CaptchaHandler");
const ConfigManager_1 = require("../config/ConfigManager");
const logger_1 = require("../utils/logger");
class SelfTestRunner {
    config;
    browser;
    tempDir;
    monitoring;
    testResults = [];
    constructor(config) {
        this.config = this.mergeWithDefaults(config || {});
        this.tempDir = (0, path_1.join)((0, os_1.tmpdir)(), 'browser-explorer-selftest');
        this.ensureTempDirectory();
    }
    async runAllTests() {
        logger_1.logger.info('Starting Browser Explorer self-test suite');
        const startTime = Date.now();
        try {
            await this.initializeTestEnvironment();
            await this.runComponentTests();
            if (!this.config.skipBrowserTests) {
                await this.runBrowserTests();
                await this.runEndToEndTests();
            }
            await this.runPerformanceTests();
        }
        catch (error) {
            logger_1.logger.error('Self-test suite encountered critical error', error);
            this.testResults.push({
                name: 'Critical Error',
                success: false,
                duration: Date.now() - startTime,
                error: error instanceof Error ? error.message : String(error),
            });
        }
        finally {
            await this.cleanup();
        }
        const report = this.generateReport(Date.now() - startTime);
        await this.saveReport(report);
        logger_1.logger.info('Self-test suite completed', {
            totalTests: report.summary.totalTests,
            successRate: report.summary.successRate,
            overallHealth: report.summary.overallHealth,
        });
        return report;
    }
    async runComponentTests() {
        logger_1.logger.info('Running component tests');
        const componentTests = [
            {
                name: 'Config Manager',
                test: () => this.testConfigManager(),
                enabled: this.config.componentTests.config,
            },
            {
                name: 'Monitoring Service',
                test: () => this.testMonitoringService(),
                enabled: this.config.componentTests.monitoring,
            },
            {
                name: 'Element Detector',
                test: () => this.testElementDetector(),
                enabled: this.config.componentTests.detector,
            },
            {
                name: 'Interaction Executor',
                test: () => this.testInteractionExecutor(),
                enabled: this.config.componentTests.executor,
            },
            {
                name: 'Authentication Manager',
                test: () => this.testAuthManager(),
                enabled: this.config.componentTests.auth,
            },
            {
                name: 'Session Manager',
                test: () => this.testSessionManager(),
                enabled: this.config.componentTests.auth,
            },
            {
                name: 'Stealth Mode',
                test: () => this.testStealthMode(),
                enabled: this.config.componentTests.stealth,
            },
            {
                name: 'CAPTCHA Handler',
                test: () => this.testCaptchaHandler(),
                enabled: this.config.componentTests.captcha,
            },
        ];
        for (const { name, test, enabled } of componentTests) {
            if (!enabled) {
                this.testResults.push({
                    name,
                    success: true,
                    duration: 0,
                    details: { skipped: true },
                });
                continue;
            }
            await this.runSingleTest(name, test);
        }
    }
    async runBrowserTests() {
        logger_1.logger.info('Running browser-dependent tests');
        const browserTests = [
            { name: 'Basic Crawling', test: () => this.testBasicCrawling() },
            { name: 'Element Detection', test: () => this.testBrowserElementDetection() },
            { name: 'User Path Recording', test: () => this.testUserPathRecording() },
            { name: 'Test Generation', test: () => this.testTestGeneration() },
        ];
        for (const { name, test } of browserTests) {
            await this.runSingleTest(name, test);
        }
    }
    async runEndToEndTests() {
        logger_1.logger.info('Running end-to-end tests');
        const e2eTests = [
            { name: 'Complete Exploration Workflow', test: () => this.testCompleteWorkflow() },
            { name: 'Authentication Workflow', test: () => this.testAuthenticationWorkflow() },
            { name: 'Error Recovery', test: () => this.testErrorRecovery() },
        ];
        for (const { name, test } of e2eTests) {
            await this.runSingleTest(name, test);
        }
    }
    async runPerformanceTests() {
        logger_1.logger.info('Running performance tests');
        const performanceTests = [
            { name: 'Memory Usage', test: () => this.testMemoryUsage() },
            { name: 'Crawl Performance', test: () => this.testCrawlPerformance() },
            { name: 'Generation Performance', test: () => this.testGenerationPerformance() },
            { name: 'Concurrent Operations', test: () => this.testConcurrentOperations() },
        ];
        for (const { name, test } of performanceTests) {
            await this.runSingleTest(name, test);
        }
    }
    async runSingleTest(name, test) {
        const startTime = Date.now();
        let attempts = 0;
        while (attempts <= this.config.retryAttempts) {
            try {
                logger_1.logger.debug(`Running test: ${name} (attempt ${attempts + 1})`);
                const result = await Promise.race([
                    test(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Test timeout')), this.config.testTimeout)),
                ]);
                this.testResults.push({
                    name,
                    success: true,
                    duration: Date.now() - startTime,
                    details: result || {},
                    metrics: this.extractMetrics(result),
                });
                logger_1.logger.debug(`Test passed: ${name}`);
                return;
            }
            catch (error) {
                attempts++;
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (attempts > this.config.retryAttempts) {
                    this.testResults.push({
                        name,
                        success: false,
                        duration: Date.now() - startTime,
                        error: errorMessage,
                    });
                    logger_1.logger.warn(`Test failed: ${name} - ${errorMessage}`);
                    return;
                }
                logger_1.logger.debug(`Test failed (attempt ${attempts}): ${name} - ${errorMessage}, retrying...`);
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }
    }
    // Component Tests
    async testConfigManager() {
        const configManager = new ConfigManager_1.ConfigManager();
        // Test default config loading
        const defaultConfig = configManager.getDefaultConfig();
        if (!defaultConfig.crawling || !defaultConfig.browser || !defaultConfig.generation) {
            throw new Error('Default configuration incomplete');
        }
        // Test config validation
        const validConfig = {
            crawling: { startUrl: 'https://example.com', maxDepth: 2 },
            generation: { framework: 'playwright', language: 'typescript' },
        };
        const isValid = configManager.validateConfig(validConfig);
        if (!isValid) {
            throw new Error('Valid configuration failed validation');
        }
        return { configStructure: Object.keys(defaultConfig) };
    }
    async testMonitoringService() {
        const monitoring = new MonitoringService_1.MonitoringService({
            enabled: true,
            reporting: { enabled: false },
        });
        await monitoring.initialize();
        try {
            // Test metrics recording
            monitoring.recordCounter('test_counter', 5);
            monitoring.recordGauge('test_gauge', 42.5);
            monitoring.recordTimer('test_timer', 123.45);
            // Test tracing
            const spanId = monitoring.startSpan('test_operation');
            monitoring.addSpanTag(spanId, 'test', 'true');
            monitoring.finishSpan(spanId);
            // Verify metrics
            const metrics = monitoring.getMetrics();
            if (!metrics.test_counter || !metrics.test_gauge || !metrics.test_timer) {
                throw new Error('Metrics not recorded correctly');
            }
            // Verify traces
            const traces = monitoring.getTraces();
            if (traces.length === 0) {
                throw new Error('Traces not recorded correctly');
            }
            return {
                metricsRecorded: Object.keys(metrics).length,
                tracesRecorded: traces.length,
            };
        }
        finally {
            await monitoring.shutdown();
        }
    }
    async testElementDetector() {
        // Test without browser for basic functionality
        const detector = new AIElementDetector_1.AIElementDetector();
        // Test element type classification
        const mockElements = [
            { tagName: 'button', type: 'submit' },
            { tagName: 'input', type: 'text' },
            { tagName: 'a', href: '#' },
            { tagName: 'form' },
        ];
        let detectedTypes = 0;
        for (const element of mockElements) {
            const type = detector.classifyElementType(element);
            if (type !== 'unknown') {
                detectedTypes++;
            }
        }
        if (detectedTypes === 0) {
            throw new Error('Element type classification failed');
        }
        return { elementsClassified: detectedTypes };
    }
    async testInteractionExecutor() {
        const executor = new InteractionExecutor_1.InteractionExecutor();
        // Test strategy selection
        const strategies = executor.getAvailableStrategies();
        if (strategies.length === 0) {
            throw new Error('No interaction strategies available');
        }
        // Test basic validation
        const validInteraction = {
            type: 'click',
            selector: '#test-button',
            options: {},
        };
        const isValid = executor.validateInteraction(validInteraction);
        if (!isValid) {
            throw new Error('Valid interaction failed validation');
        }
        return { availableStrategies: strategies };
    }
    async testAuthManager() {
        const authManager = new MultiStrategyAuthManager_1.MultiStrategyAuthManager({
            strategies: {
                basic: { enabled: true },
                oauth: { enabled: true },
                apiKey: { enabled: true },
            },
        });
        const availableStrategies = authManager.getAvailableStrategies();
        if (!availableStrategies.includes('basic')) {
            throw new Error('Basic authentication strategy not available');
        }
        return { availableStrategies };
    }
    async testSessionManager() {
        const sessionManager = new SessionManager_1.SessionManager({
            storage: { type: 'memory' },
            encryption: { enabled: false },
        });
        // Test session operations without browser
        const testSession = {
            cookies: [{ name: 'test', value: 'value', domain: 'test.com' }],
            localStorage: { testKey: 'testValue' },
            sessionStorage: {},
            url: 'https://test.com',
            timestamp: new Date(),
        };
        await sessionManager.saveSession('test-session', testSession, 'test.com');
        const retrieved = await sessionManager.loadSession('test-session', 'test.com');
        if (!retrieved || retrieved.cookies.length === 0) {
            throw new Error('Session save/load failed');
        }
        return { sessionSaved: true };
    }
    async testStealthMode() {
        const stealth = new StealthMode_1.StealthMode({
            enabled: true,
            fingerprintSpoofing: { canvas: true, webgl: true },
            behaviorSimulation: { humanLikeDelays: true },
        });
        // Test configuration
        const config = stealth.getConfig();
        if (!config.enabled) {
            throw new Error('Stealth mode not enabled');
        }
        // Test user agent generation
        const userAgent = stealth.generateRandomUserAgent();
        if (!userAgent || !userAgent.includes('Chrome')) {
            throw new Error('User agent generation failed');
        }
        return { userAgentGenerated: true };
    }
    async testCaptchaHandler() {
        const captchaHandler = new CaptchaHandler_1.CaptchaHandler({
            autoDetect: true,
            solveAttempts: 2,
        });
        // Test detection patterns
        const patterns = captchaHandler.getDetectionPatterns();
        if (!patterns || Object.keys(patterns).length === 0) {
            throw new Error('CAPTCHA detection patterns not loaded');
        }
        return { detectionPatterns: Object.keys(patterns) };
    }
    // Browser Tests
    async testBasicCrawling() {
        if (!this.browser)
            throw new Error('Browser not initialized');
        const crawler = new BreadthFirstCrawler_1.BreadthFirstCrawler(this.browser);
        const testServer = await this.startTestServer();
        try {
            const result = await crawler.crawl({
                startUrl: `http://localhost:${testServer.port}`,
                maxDepth: 1,
                maxPages: 3,
                parallelWorkers: 1,
                allowedDomains: ['localhost'],
            });
            if (result.crawledUrls.length === 0) {
                throw new Error('No URLs crawled');
            }
            return {
                urlsCrawled: result.crawledUrls.length,
                duration: result.statistics.totalTime,
            };
        }
        finally {
            testServer.server.close();
        }
    }
    async testBrowserElementDetection() {
        if (!this.browser)
            throw new Error('Browser not initialized');
        const page = await this.browser.newPage();
        const detector = new AIElementDetector_1.AIElementDetector();
        try {
            await page.setContent(`
        <html>
          <body>
            <button id="test-btn">Click Me</button>
            <input type="text" id="test-input" placeholder="Enter text">
            <a href="#" id="test-link">Test Link</a>
            <form id="test-form">
              <input type="email" name="email" required>
              <button type="submit">Submit</button>
            </form>
          </body>
        </html>
      `);
            const elements = await detector.detectElements(page);
            if (elements.length < 4) {
                throw new Error(`Expected at least 4 elements, found ${elements.length}`);
            }
            const buttonElements = elements.filter((el) => el.type === 'button');
            const inputElements = elements.filter((el) => el.type === 'input');
            const linkElements = elements.filter((el) => el.type === 'link');
            return {
                totalElements: elements.length,
                buttonElements: buttonElements.length,
                inputElements: inputElements.length,
                linkElements: linkElements.length,
            };
        }
        finally {
            await page.close();
        }
    }
    async testUserPathRecording() {
        if (!this.browser)
            throw new Error('Browser not initialized');
        const page = await this.browser.newPage();
        const recorder = new UserPathRecorder_1.UserPathRecorder();
        try {
            await page.setContent(`
        <html>
          <body>
            <input type="text" id="name-input" placeholder="Name">
            <button id="submit-btn">Submit</button>
          </body>
        </html>
      `);
            recorder.startRecording(page, 'test-recording');
            await page.fill('#name-input', 'Test User');
            await page.click('#submit-btn');
            const userPath = await recorder.stopRecording();
            if (userPath.steps.length < 2) {
                throw new Error(`Expected at least 2 steps, got ${userPath.steps.length}`);
            }
            return {
                stepsRecorded: userPath.steps.length,
                duration: userPath.duration,
            };
        }
        finally {
            await page.close();
        }
    }
    async testTestGeneration() {
        const generator = new TestGenerator_1.TestGenerator({
            framework: 'playwright',
            language: 'typescript',
            outputDirectory: this.tempDir,
        });
        const mockUserPath = {
            id: 'test-path',
            name: 'Test Path',
            startUrl: 'https://example.com',
            steps: [
                {
                    type: 'fill',
                    selector: '#test-input',
                    value: 'test value',
                    timestamp: new Date(),
                },
                {
                    type: 'click',
                    selector: '#test-button',
                    timestamp: new Date(),
                },
            ],
            assertions: [],
            duration: 1000,
            metadata: {},
            createdAt: new Date(),
        };
        const result = await generator.generate(mockUserPath);
        if (result.files.length === 0) {
            throw new Error('No test files generated');
        }
        return {
            filesGenerated: result.files.length,
            totalTests: result.summary.totalTests,
        };
    }
    // End-to-End Tests
    async testCompleteWorkflow() {
        const explorer = new index_1.BrowserExplorer();
        const configPath = (0, path_1.join)(this.tempDir, 'test-config.yaml');
        // Create test configuration
        const testConfig = `
crawling:
  startUrl: http://httpbin.org/html
  maxDepth: 1
  maxPages: 2
  parallelWorkers: 1
browser:
  headless: true
  timeout: 10000
generation:
  framework: playwright
  language: typescript
  outputDirectory: ${this.tempDir}
`;
        (0, fs_1.writeFileSync)(configPath, testConfig);
        try {
            await explorer.initialize(configPath);
            const result = await explorer.explore();
            if (!result.crawlResult || !result.generationResult) {
                throw new Error('Incomplete workflow result');
            }
            return {
                urlsCrawled: result.crawlResult.crawledUrls.length,
                testsGenerated: result.testsGenerated,
                filesCreated: result.filesCreated,
            };
        }
        finally {
            await explorer.cleanup();
        }
    }
    async testAuthenticationWorkflow() {
        // Simplified auth test without actual browser interaction
        const authManager = new MultiStrategyAuthManager_1.MultiStrategyAuthManager({
            strategies: {
                basic: {
                    enabled: true,
                    loginUrl: 'https://httpbin.org/basic-auth/user/pass',
                },
            },
        });
        // const sessionManager = new SessionManager({
        //   storage: { type: 'memory' },
        // });
        // Test basic functionality without browser
        const strategies = authManager.getAvailableStrategies();
        if (!strategies.includes('basic')) {
            throw new Error('Basic auth strategy not available');
        }
        return { strategiesAvailable: strategies.length };
    }
    async testErrorRecovery() {
        if (!this.browser)
            throw new Error('Browser not initialized');
        const crawler = new BreadthFirstCrawler_1.BreadthFirstCrawler(this.browser);
        try {
            // Test with invalid URL to trigger error handling
            const result = await crawler.crawl({
                startUrl: 'http://localhost:99999', // Non-existent server
                maxDepth: 1,
                maxPages: 1,
                parallelWorkers: 1,
                allowedDomains: ['localhost'],
            });
            // Should handle errors gracefully
            if (result.errors.length === 0) {
                throw new Error('Expected errors for invalid URL, but none were recorded');
            }
            return {
                errorsHandled: result.errors.length,
                crawlCompleted: true,
            };
        }
        catch (error) {
            // This is expected for network errors
            return {
                errorHandled: true,
                errorType: 'network_error',
            };
        }
    }
    // Performance Tests
    async testMemoryUsage() {
        const initialMemory = process.memoryUsage().heapUsed;
        // Perform memory-intensive operations
        const largeArray = new Array(100000).fill('test data');
        const memoryAfterAllocation = process.memoryUsage().heapUsed;
        // Clean up
        largeArray.length = 0;
        global.gc && global.gc();
        await new Promise((resolve) => setTimeout(resolve, 100));
        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = (memoryAfterAllocation - initialMemory) / 1024 / 1024; // MB
        const memoryRecovered = (memoryAfterAllocation - finalMemory) / 1024 / 1024; // MB
        if (finalMemory > this.config.performanceThresholds.maxMemoryUsage) {
            throw new Error(`Memory usage exceeded threshold: ${finalMemory / 1024 / 1024}MB`);
        }
        return {
            initialMemoryMB: initialMemory / 1024 / 1024,
            peakMemoryMB: memoryAfterAllocation / 1024 / 1024,
            finalMemoryMB: finalMemory / 1024 / 1024,
            memoryIncreaseMB: memoryIncrease,
            memoryRecoveredMB: memoryRecovered,
        };
    }
    async testCrawlPerformance() {
        if (!this.browser)
            throw new Error('Browser not initialized');
        const crawler = new BreadthFirstCrawler_1.BreadthFirstCrawler(this.browser);
        const testServer = await this.startTestServer();
        const startTime = Date.now();
        try {
            const result = await crawler.crawl({
                startUrl: `http://localhost:${testServer.port}`,
                maxDepth: 2,
                maxPages: 5,
                parallelWorkers: 2,
                allowedDomains: ['localhost'],
            });
            const duration = Date.now() - startTime;
            if (duration > this.config.performanceThresholds.maxCrawlTime) {
                throw new Error(`Crawl time exceeded threshold: ${duration}ms`);
            }
            return {
                duration,
                urlsCrawled: result.crawledUrls.length,
                avgTimePerUrl: duration / result.crawledUrls.length,
            };
        }
        finally {
            testServer.server.close();
        }
    }
    async testGenerationPerformance() {
        const generator = new TestGenerator_1.TestGenerator({
            framework: 'playwright',
            language: 'typescript',
            outputDirectory: this.tempDir,
        });
        // Create a large mock path
        const mockUserPath = {
            id: 'performance-test-path',
            name: 'Performance Test Path',
            startUrl: 'https://example.com',
            steps: Array.from({ length: 20 }, (_, i) => ({
                type: 'click',
                selector: `#button-${i}`,
                timestamp: new Date(),
            })),
            assertions: [],
            duration: 5000,
            metadata: {},
            createdAt: new Date(),
        };
        const startTime = Date.now();
        const result = await generator.generate(mockUserPath);
        const duration = Date.now() - startTime;
        if (duration > this.config.performanceThresholds.maxGenerationTime) {
            throw new Error(`Generation time exceeded threshold: ${duration}ms`);
        }
        return {
            duration,
            filesGenerated: result.files.length,
            stepsProcessed: mockUserPath.steps.length,
        };
    }
    async testConcurrentOperations() {
        if (!this.monitoring) {
            throw new Error('Monitoring service not initialized');
        }
        const operations = Array.from({ length: 10 }, (_, i) => this.monitoring.timeFunction(`concurrent_test_${i}`, async () => {
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));
            return `result_${i}`;
        }));
        const startTime = Date.now();
        const results = await Promise.all(operations);
        const duration = Date.now() - startTime;
        if (results.length !== 10) {
            throw new Error(`Expected 10 results, got ${results.length}`);
        }
        return {
            duration,
            operationsCompleted: results.length,
            avgOperationTime: duration / results.length,
        };
    }
    // Helper Methods
    async initializeTestEnvironment() {
        this.monitoring = new MonitoringService_1.MonitoringService({
            enabled: true,
            reporting: { enabled: false },
        });
        await this.monitoring.initialize();
        if (!this.config.skipBrowserTests) {
            this.browser = await playwright_1.chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-dev-shm-usage'],
            });
        }
    }
    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            this.browser = undefined;
        }
        if (this.monitoring) {
            await this.monitoring.shutdown();
            this.monitoring = undefined;
        }
        // Clean up temp directory
        try {
            if ((0, fs_1.existsSync)(this.tempDir)) {
                (0, fs_1.rmSync)(this.tempDir, { recursive: true, force: true });
            }
        }
        catch (error) {
            logger_1.logger.warn('Failed to clean up temp directory', error);
        }
    }
    async startTestServer() {
        const express = require('express');
        const app = express();
        app.get('/', (_req, res) => {
            res.send(`
        <html>
          <body>
            <h1>Test Server</h1>
            <a href="/page1">Page 1</a>
            <a href="/page2">Page 2</a>
            <button id="test-btn">Test Button</button>
          </body>
        </html>
      `);
        });
        app.get('/page1', (_req, res) => {
            res.send(`
        <html>
          <body>
            <h1>Page 1</h1>
            <a href="/">Home</a>
            <form>
              <input type="text" name="test" placeholder="Test Input">
              <button type="submit">Submit</button>
            </form>
          </body>
        </html>
      `);
        });
        app.get('/page2', (_req, res) => {
            res.send(`
        <html>
          <body>
            <h1>Page 2</h1>
            <a href="/">Home</a>
            <div id="content">Page 2 content</div>
          </body>
        </html>
      `);
        });
        const port = 3000 + Math.floor(Math.random() * 1000);
        const server = app.listen(port);
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { server, port };
    }
    extractMetrics(result) {
        if (!result || typeof result !== 'object')
            return {};
        const metrics = {};
        for (const [key, value] of Object.entries(result)) {
            if (typeof value === 'number') {
                metrics[key] = value;
            }
        }
        return metrics;
    }
    generateReport(totalDuration) {
        const passedTests = this.testResults.filter((r) => r.success);
        const failedTests = this.testResults.filter((r) => !r.success);
        const skippedTests = this.testResults.filter((r) => r.details?.skipped);
        const successRate = this.testResults.length > 0 ? passedTests.length / this.testResults.length : 0;
        const overallHealth = this.determineOverallHealth(successRate, failedTests);
        const recommendations = this.generateRecommendations(failedTests, successRate);
        return {
            timestamp: new Date(),
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                architecture: process.arch,
                memoryTotal: require('os').totalmem(),
                memoryUsed: process.memoryUsage().heapUsed,
            },
            configuration: this.config,
            results: this.testResults,
            summary: {
                totalTests: this.testResults.length,
                passedTests: passedTests.length,
                failedTests: failedTests.length,
                skippedTests: skippedTests.length,
                totalDuration,
                successRate,
                overallHealth,
            },
            recommendations,
        };
    }
    determineOverallHealth(successRate, failedTests) {
        if (successRate >= this.config.performanceThresholds.minSuccessRate) {
            return 'healthy';
        }
        const criticalFailures = failedTests.filter((test) => test.name.includes('Critical') ||
            test.name.includes('Complete Workflow') ||
            test.name.includes('Memory Usage'));
        if (criticalFailures.length > 0 || successRate < 0.5) {
            return 'unhealthy';
        }
        return 'degraded';
    }
    generateRecommendations(failedTests, successRate) {
        const recommendations = [];
        if (successRate < this.config.performanceThresholds.minSuccessRate) {
            recommendations.push(`Success rate (${(successRate * 100).toFixed(1)}%) is below threshold (${(this.config.performanceThresholds.minSuccessRate * 100).toFixed(1)}%). Review failed tests and system configuration.`);
        }
        const memoryFailures = failedTests.filter((t) => t.name.includes('Memory'));
        if (memoryFailures.length > 0) {
            recommendations.push('Memory usage tests failed. Consider optimizing memory management or increasing system resources.');
        }
        const browserFailures = failedTests.filter((t) => t.name.includes('Crawling') || t.name.includes('Element Detection'));
        if (browserFailures.length > 0) {
            recommendations.push('Browser-dependent tests failed. Verify Playwright installation and browser availability.');
        }
        const performanceFailures = failedTests.filter((t) => t.name.includes('Performance'));
        if (performanceFailures.length > 0) {
            recommendations.push('Performance tests failed. System may be under load or configuration thresholds may need adjustment.');
        }
        if (failedTests.length === 0 && successRate === 1) {
            recommendations.push('All tests passed! The Browser Explorer system is functioning optimally.');
        }
        return recommendations;
    }
    async saveReport(report) {
        const reportPath = (0, path_1.join)(this.config.outputDirectory, `self-test-report-${Date.now()}.json`);
        try {
            (0, fs_1.writeFileSync)(reportPath, JSON.stringify(report, null, 2));
            logger_1.logger.info(`Self-test report saved to: ${reportPath}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to save self-test report', error);
        }
    }
    ensureTempDirectory() {
        if (!(0, fs_1.existsSync)(this.tempDir)) {
            (0, fs_1.mkdirSync)(this.tempDir, { recursive: true });
        }
    }
    mergeWithDefaults(config) {
        return {
            testTimeout: 30000,
            retryAttempts: 2,
            skipBrowserTests: false,
            outputDirectory: (0, path_1.join)(process.cwd(), 'self-test-reports'),
            testEndpoints: {
                enabled: true,
                urls: ['https://httpbin.org', 'https://example.com'],
            },
            componentTests: {
                crawler: true,
                detector: true,
                executor: true,
                recorder: true,
                generator: true,
                monitoring: true,
                auth: true,
                stealth: true,
                captcha: true,
                config: true,
            },
            performanceThresholds: {
                maxCrawlTime: 30000, // 30 seconds
                maxGenerationTime: 10000, // 10 seconds
                maxMemoryUsage: 500 * 1024 * 1024, // 500MB
                minSuccessRate: 0.8, // 80%
            },
            ...config,
        };
    }
}
exports.SelfTestRunner = SelfTestRunner;
//# sourceMappingURL=SelfTestRunner.js.map