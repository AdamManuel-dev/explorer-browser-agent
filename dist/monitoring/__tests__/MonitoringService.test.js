"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MonitoringService_1 = require("../MonitoringService");
describe('MonitoringService', () => {
    let monitoringService;
    beforeEach(() => {
        monitoringService = new MonitoringService_1.MonitoringService({
            enabled: true,
            metricsCollection: {
                enabled: true,
                flushInterval: 1000,
                maxMetrics: 100,
                exportFormat: 'console',
            },
            tracing: {
                enabled: true,
                samplingRate: 1.0, // 100% for testing
                maxSpans: 100,
            },
            alerting: {
                enabled: true,
                thresholds: {
                    errorRate: 0.05,
                    responseTime: 5000,
                    memoryUsage: 0.8,
                    crawlFailureRate: 0.1,
                },
            },
            reporting: {
                enabled: false, // Disable for testing
                interval: 5000,
                includeSummary: true,
            },
        });
    });
    afterEach(async () => {
        await monitoringService.shutdown();
    });
    describe('Metrics Collection', () => {
        it('should record counter metrics', () => {
            monitoringService.recordCounter('test_counter', 5, { label: 'test' });
            const metrics = monitoringService.getMetrics('test_counter');
            expect(metrics.test_counter).toHaveLength(1);
            expect(metrics.test_counter?.[0]?.type).toBe('counter');
            expect(metrics.test_counter?.[0]?.value).toBe(5);
            expect(metrics.test_counter?.[0]?.labels).toEqual({ label: 'test' });
        });
        it('should record gauge metrics', () => {
            monitoringService.recordGauge('test_gauge', 42.5);
            const metrics = monitoringService.getMetrics('test_gauge');
            expect(metrics.test_gauge).toHaveLength(1);
            expect(metrics.test_gauge?.[0]?.type).toBe('gauge');
            expect(metrics.test_gauge?.[0]?.value).toBe(42.5);
        });
        it('should record histogram metrics', () => {
            const buckets = [0.1, 0.5, 1.0, 2.0, 5.0];
            monitoringService.recordHistogram('test_histogram', 1.5, buckets);
            const metrics = monitoringService.getMetrics('test_histogram');
            expect(metrics.test_histogram).toHaveLength(1);
            expect(metrics.test_histogram?.[0]?.type).toBe('histogram');
            expect(metrics.test_histogram?.[0]?.value).toBe(1.5);
            expect(metrics.test_histogram?.[0]?.buckets).toEqual(buckets);
        });
        it('should record timer metrics', () => {
            monitoringService.recordTimer('test_timer', 123.45);
            const metrics = monitoringService.getMetrics('test_timer');
            expect(metrics.test_timer).toHaveLength(1);
            expect(metrics.test_timer?.[0]?.type).toBe('timer');
            expect(metrics.test_timer?.[0]?.duration).toBe(123.45);
        });
        it('should not record metrics when disabled', () => {
            const disabledService = new MonitoringService_1.MonitoringService({
                metricsCollection: {
                    enabled: false,
                    flushInterval: 1000,
                    maxMetrics: 100,
                    exportFormat: 'console',
                },
            });
            disabledService.recordCounter('disabled_counter', 1);
            const metrics = disabledService.getMetrics('disabled_counter');
            expect(Object.keys(metrics)).toHaveLength(0);
        });
        it('should limit metrics to maxMetrics', () => {
            const service = new MonitoringService_1.MonitoringService({
                metricsCollection: {
                    enabled: true,
                    maxMetrics: 3,
                    flushInterval: 60000,
                    exportFormat: 'console',
                },
            });
            // Add more metrics than the limit
            for (let i = 0; i < 5; i++) {
                service.recordCounter('limited_counter', i);
            }
            const metrics = service.getMetrics('limited_counter');
            expect(metrics.limited_counter).toHaveLength(3);
            // Should keep the most recent metrics
            expect(metrics.limited_counter?.[0]?.value).toBe(2);
            expect(metrics.limited_counter?.[2]?.value).toBe(4);
        });
    });
    describe('Timer Utilities', () => {
        it('should provide timer function', (done) => {
            const endTimer = monitoringService.startTimer('test_timer_func');
            // Simulate some work
            setTimeout(() => {
                endTimer();
                const metrics = monitoringService.getMetrics('test_timer_func');
                expect(metrics.test_timer_func).toHaveLength(1);
                expect(metrics.test_timer_func?.[0]?.type).toBe('timer');
                expect(metrics.test_timer_func?.[0]?.duration).toBeGreaterThan(0);
                done();
            }, 10);
        });
        it('should time async functions successfully', async () => {
            const mockAsyncFunction = jest.fn(async () => {
                await new Promise((resolve) => setTimeout(resolve, 10));
                return 'success';
            });
            const result = await monitoringService.timeFunction('async_test', mockAsyncFunction, {
                operation: 'test',
            });
            expect(result).toBe('success');
            expect(mockAsyncFunction).toHaveBeenCalledTimes(1);
            const metrics = monitoringService.getMetrics('async_test');
            expect(metrics.async_test).toHaveLength(1);
            expect(metrics.async_test?.[0]?.labels).toEqual({ operation: 'test', status: 'success' });
        });
        it('should time async functions with errors', async () => {
            const mockAsyncFunction = jest.fn(async () => {
                await new Promise((resolve) => setTimeout(resolve, 10));
                throw new Error('Test error');
            });
            await expect(monitoringService.timeFunction('async_error_test', mockAsyncFunction)).rejects.toThrow('Test error');
            const metrics = monitoringService.getMetrics('async_error_test');
            expect(metrics.async_error_test).toHaveLength(1);
            expect(metrics.async_error_test?.[0]?.labels).toEqual({ status: 'error' });
        });
    });
    describe('Distributed Tracing', () => {
        it('should create and finish spans', () => {
            const spanId = monitoringService.startSpan('test_operation', undefined, { userId: '123' });
            expect(spanId).toBeTruthy();
            const activeSpans = monitoringService.getActiveSpans();
            expect(activeSpans).toHaveLength(1);
            expect(activeSpans[0]?.operationName).toBe('test_operation');
            expect(activeSpans[0]?.tags).toEqual({ userId: '123' });
            expect(activeSpans[0]?.status).toBe('active');
            monitoringService.finishSpan(spanId, { result: 'success' });
            const activeSpansAfter = monitoringService.getActiveSpans();
            expect(activeSpansAfter).toHaveLength(0);
            const allTraces = monitoringService.getTraces();
            expect(allTraces).toHaveLength(1);
            expect(allTraces[0]?.status).toBe('completed');
            expect(allTraces[0]?.tags).toEqual({ userId: '123', result: 'success' });
            expect(allTraces[0]?.duration).toBeGreaterThan(0);
        });
        it('should create nested spans', () => {
            const parentSpanId = monitoringService.startSpan('parent_operation');
            const childSpanId = monitoringService.startSpan('child_operation', parentSpanId);
            const activeSpans = monitoringService.getActiveSpans();
            expect(activeSpans).toHaveLength(2);
            const childSpan = activeSpans.find((s) => s.spanId === childSpanId);
            const parentSpan = activeSpans.find((s) => s.spanId === parentSpanId);
            expect(childSpan?.parentSpanId).toBe(parentSpanId);
            expect(childSpan?.traceId).toBe(parentSpan?.traceId);
            monitoringService.finishSpan(childSpanId);
            monitoringService.finishSpan(parentSpanId);
        });
        it('should add span logs and tags', () => {
            const spanId = monitoringService.startSpan('logged_operation');
            monitoringService.addSpanLog(spanId, 'info', 'Operation started', { step: 1 });
            monitoringService.addSpanTag(spanId, 'version', '1.0.0');
            const activeSpans = monitoringService.getActiveSpans();
            const span = activeSpans[0];
            expect(span?.logs).toHaveLength(1);
            expect(span?.logs?.[0]?.message).toBe('Operation started');
            expect(span?.logs?.[0]?.fields).toEqual({ step: 1 });
            expect(span?.tags?.version).toBe('1.0.0');
            monitoringService.finishSpan(spanId);
        });
        it('should not create spans when tracing is disabled', () => {
            const disabledService = new MonitoringService_1.MonitoringService({
                tracing: {
                    enabled: false,
                    samplingRate: 1.0,
                    maxSpans: 100,
                },
            });
            const spanId = disabledService.startSpan('disabled_operation');
            expect(spanId).toBe('');
            expect(disabledService.getActiveSpans()).toHaveLength(0);
        });
        it('should respect sampling rate', () => {
            const lowSamplingService = new MonitoringService_1.MonitoringService({
                tracing: {
                    enabled: true,
                    samplingRate: 0.0, // 0% sampling
                    maxSpans: 100,
                },
            });
            // Try creating multiple spans - none should be created due to 0% sampling
            const spanIds = [];
            for (let i = 0; i < 10; i++) {
                spanIds.push(lowSamplingService.startSpan(`operation_${i}`));
            }
            const activeSpans = lowSamplingService.getActiveSpans();
            expect(activeSpans).toHaveLength(0);
            expect(spanIds.every((id) => id === '')).toBe(true);
        });
    });
    describe('Crawl Metrics Tracking', () => {
        it('should track page requests', () => {
            monitoringService.trackPageRequest('https://example.com', true, 250, 1024);
            monitoringService.trackPageRequest('https://example.com/page2', false, 1000, 0);
            const report = monitoringService.generateReport();
            return report.then((r) => {
                expect(r.crawlMetrics.totalRequests).toBe(2);
                expect(r.crawlMetrics.successfulRequests).toBe(1);
                expect(r.crawlMetrics.failedRequests).toBe(1);
                expect(r.crawlMetrics.bytesDownloaded).toBe(1024);
                expect(r.crawlMetrics.pagesProcessed).toBe(1);
                expect(r.crawlMetrics.errorsEncountered).toBe(1);
                expect(r.crawlMetrics.averageResponseTime).toBe(625); // (250 + 1000) / 2
            });
        });
        it('should track CAPTCHA solving', () => {
            monitoringService.trackCaptchaSolved('recaptcha', true, 5000);
            monitoringService.trackCaptchaSolved('hcaptcha', false, 3000);
            const report = monitoringService.generateReport();
            return report.then((r) => {
                expect(r.crawlMetrics.captchasSolved).toBe(1);
            });
        });
        it('should track authentication attempts', () => {
            monitoringService.trackAuthenticationAttempt('oauth', true);
            monitoringService.trackAuthenticationAttempt('basic', false);
            const report = monitoringService.generateReport();
            return report.then((r) => {
                expect(r.crawlMetrics.authenticationAttempts).toBe(2);
            });
        });
    });
    describe('System Metrics', () => {
        it('should collect system metrics', async () => {
            const systemMetrics = await monitoringService.collectSystemMetrics();
            expect(systemMetrics.cpu).toBeDefined();
            expect(systemMetrics.memory).toBeDefined();
            expect(systemMetrics.network).toBeDefined();
            expect(systemMetrics.process).toBeDefined();
            expect(typeof systemMetrics.cpu.usage).toBe('number');
            expect(Array.isArray(systemMetrics.cpu.loadAverage)).toBe(true);
            expect(typeof systemMetrics.memory.used).toBe('number');
            expect(typeof systemMetrics.memory.total).toBe('number');
            expect(typeof systemMetrics.process.uptime).toBe('number');
            expect(typeof systemMetrics.process.pid).toBe('number');
        });
    });
    describe('Reporting and Alerts', () => {
        it('should generate monitoring report', async () => {
            // Add some test data
            monitoringService.trackPageRequest('https://test.com', true, 100, 512);
            monitoringService.trackPageRequest('https://test.com/fail', false, 5000, 0);
            const report = await monitoringService.generateReport();
            expect(report.timestamp).toBeInstanceOf(Date);
            expect(report.systemMetrics).toBeDefined();
            expect(report.crawlMetrics).toBeDefined();
            expect(report.summary).toBeDefined();
            expect(typeof report.activeTraces).toBe('number');
            expect(Array.isArray(report.alerts)).toBe(true);
            expect(report.summary.errorRate).toBe(0.5); // 1 failed out of 2 total
            expect(report.summary.totalOperations).toBe(2);
        });
        it('should generate alerts based on thresholds', async () => {
            // Create service with very low thresholds to trigger alerts
            const alertService = new MonitoringService_1.MonitoringService({
                alerting: {
                    enabled: true,
                    thresholds: {
                        errorRate: 0.01, // 1%
                        responseTime: 50, // 50ms
                        memoryUsage: 0.01, // 1%
                        crawlFailureRate: 0.01,
                    },
                },
            });
            // Add requests that will trigger alerts
            alertService.trackPageRequest('https://test.com', false, 1000, 0); // High response time and error
            const report = await alertService.generateReport();
            expect(report.alerts.length).toBeGreaterThan(0);
            const errorRateAlert = report.alerts.find((a) => a.type === 'error_rate');
            const responseTimeAlert = report.alerts.find((a) => a.type === 'response_time');
            const memoryAlert = report.alerts.find((a) => a.type === 'memory_usage');
            expect(errorRateAlert).toBeDefined();
            expect(responseTimeAlert).toBeDefined();
            expect(memoryAlert).toBeDefined();
            await alertService.shutdown();
        });
        it('should determine overall health correctly', async () => {
            // Test healthy state
            monitoringService.trackPageRequest('https://test.com', true, 100, 512);
            let report = await monitoringService.generateReport();
            expect(report.summary.overallHealth).toBe('healthy');
            // Test degraded state (moderate error rate)
            for (let i = 0; i < 10; i++) {
                monitoringService.trackPageRequest(`https://test.com/${i}`, i < 8, 100, 512);
            }
            report = await monitoringService.generateReport();
            expect(report.summary.overallHealth).toBe('degraded');
        });
    });
    describe('Service Lifecycle', () => {
        it('should initialize and shutdown properly', async () => {
            const service = new MonitoringService_1.MonitoringService({
                reporting: {
                    enabled: false, // Disable intervals for testing
                    interval: 5000,
                    includeSummary: true,
                },
            });
            const initPromise = new Promise((resolve) => {
                service.once('initialized', resolve);
            });
            await service.initialize();
            await initPromise;
            const shutdownPromise = new Promise((resolve) => {
                service.once('shutdown', resolve);
            });
            await service.shutdown();
            await shutdownPromise;
        });
        it('should emit events correctly', async () => {
            const service = new MonitoringService_1.MonitoringService({
                reporting: {
                    enabled: false,
                    interval: 5000,
                    includeSummary: true,
                },
            });
            const events = [];
            service.on('initialized', () => events.push('initialized'));
            service.on('shutdown', () => events.push('shutdown'));
            await service.initialize();
            await service.shutdown();
            expect(events).toEqual(['initialized', 'shutdown']);
        });
    });
});
//# sourceMappingURL=MonitoringService.test.js.map