"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringService = void 0;
const perf_hooks_1 = require("perf_hooks");
const events_1 = require("events");
const logger_1 = require("../utils/logger");
class MonitoringService extends events_1.EventEmitter {
    config;
    metrics = new Map();
    traces = new Map();
    activeSpans = new Map();
    systemStartTime = Date.now();
    metricsFlushInterval;
    reportingInterval;
    crawlMetrics;
    constructor(config) {
        super();
        this.config = this.mergeWithDefaults(config || {});
        this.crawlMetrics = this.initializeCrawlMetrics();
        if (this.config.enabled) {
            this.initialize();
        }
    }
    async initialize() {
        logger_1.logger.info('Initializing monitoring service', {
            metricsEnabled: this.config.metricsCollection.enabled,
            tracingEnabled: this.config.tracing.enabled,
            alertingEnabled: this.config.alerting.enabled,
        });
        if (this.config.metricsCollection.enabled) {
            this.startMetricsCollection();
        }
        if (this.config.reporting.enabled) {
            this.startReporting();
        }
        // Emit initialization event
        this.emit('initialized', {
            timestamp: new Date(),
            config: this.config,
        });
    }
    async shutdown() {
        logger_1.logger.info('Shutting down monitoring service');
        if (this.metricsFlushInterval) {
            clearInterval(this.metricsFlushInterval);
        }
        if (this.reportingInterval) {
            clearInterval(this.reportingInterval);
        }
        // Close any active spans
        for (const span of this.activeSpans.values()) {
            this.finishSpan(span.spanId, { error: 'Service shutdown' });
        }
        // Final metrics flush
        if (this.config.metricsCollection.enabled) {
            await this.flushMetrics();
        }
        this.emit('shutdown', { timestamp: new Date() });
    }
    // Metrics Collection
    recordCounter(name, value = 1, labels) {
        if (!this.config.metricsCollection.enabled)
            return;
        const metric = {
            type: 'counter',
            value,
            timestamp: new Date(),
            labels,
        };
        this.addMetric(name, metric);
    }
    recordGauge(name, value, labels) {
        if (!this.config.metricsCollection.enabled)
            return;
        const metric = {
            type: 'gauge',
            value,
            timestamp: new Date(),
            labels,
        };
        this.addMetric(name, metric);
    }
    recordHistogram(name, value, buckets, labels) {
        if (!this.config.metricsCollection.enabled)
            return;
        const metric = {
            type: 'histogram',
            value,
            timestamp: new Date(),
            buckets,
            labels,
        };
        this.addMetric(name, metric);
    }
    recordTimer(name, duration, labels) {
        if (!this.config.metricsCollection.enabled)
            return;
        const metric = {
            type: 'timer',
            value: duration,
            duration,
            timestamp: new Date(),
            labels,
        };
        this.addMetric(name, metric);
    }
    // Timing utilities
    startTimer(name) {
        const startTime = perf_hooks_1.performance.now();
        return () => {
            const duration = perf_hooks_1.performance.now() - startTime;
            this.recordTimer(name, duration);
        };
    }
    async timeFunction(name, fn, labels) {
        const startTime = perf_hooks_1.performance.now();
        let error = null;
        try {
            const result = await fn();
            const duration = perf_hooks_1.performance.now() - startTime;
            this.recordTimer(name, duration, { ...labels, status: 'success' });
            return result;
        }
        catch (err) {
            error = err instanceof Error ? err : new Error(String(err));
            const duration = perf_hooks_1.performance.now() - startTime;
            this.recordTimer(name, duration, { ...labels, status: 'error' });
            throw error;
        }
    }
    // Distributed Tracing
    startSpan(operationName, parentSpanId, tags) {
        if (!this.config.tracing.enabled)
            return '';
        // Simple sampling based on rate
        if (Math.random() > this.config.tracing.samplingRate) {
            return '';
        }
        const traceId = parentSpanId
            ? this.activeSpans.get(parentSpanId)?.traceId || this.generateTraceId()
            : this.generateTraceId();
        const spanId = this.generateSpanId();
        const span = {
            traceId,
            spanId,
            parentSpanId,
            operationName,
            startTime: new Date(),
            tags: tags || {},
            logs: [],
            status: 'active',
        };
        this.activeSpans.set(spanId, span);
        this.traces.set(spanId, span);
        logger_1.logger.debug('Started trace span', {
            traceId,
            spanId,
            operationName,
            parentSpanId,
        });
        return spanId;
    }
    finishSpan(spanId, tags) {
        if (!this.config.tracing.enabled || !spanId)
            return;
        const span = this.activeSpans.get(spanId);
        if (!span)
            return;
        span.endTime = new Date();
        span.duration = span.endTime.getTime() - span.startTime.getTime();
        span.status = tags?.error ? 'error' : 'completed';
        span.error = tags?.error;
        if (tags) {
            span.tags = { ...span.tags, ...tags };
        }
        this.activeSpans.delete(spanId);
        logger_1.logger.debug('Finished trace span', {
            traceId: span.traceId,
            spanId,
            duration: span.duration,
            status: span.status,
        });
        // Clean up old traces if limit exceeded
        if (this.traces.size > this.config.tracing.maxSpans) {
            const oldestSpanId = Array.from(this.traces.keys())[0];
            if (oldestSpanId) {
                this.traces.delete(oldestSpanId);
            }
        }
    }
    addSpanLog(spanId, level, message, fields) {
        if (!this.config.tracing.enabled || !spanId)
            return;
        const span = this.activeSpans.get(spanId);
        if (!span)
            return;
        span.logs.push({
            timestamp: new Date(),
            level,
            message,
            fields,
        });
    }
    addSpanTag(spanId, key, value) {
        if (!this.config.tracing.enabled || !spanId)
            return;
        const span = this.activeSpans.get(spanId);
        if (!span)
            return;
        span.tags[key] = value;
    }
    // Crawl-specific metrics tracking
    trackPageRequest(url, success, responseTime, bytesDownloaded) {
        this.crawlMetrics.totalRequests++;
        if (success) {
            this.crawlMetrics.successfulRequests++;
            this.crawlMetrics.bytesDownloaded += bytesDownloaded;
            this.crawlMetrics.pagesProcessed++;
        }
        else {
            this.crawlMetrics.failedRequests++;
            this.crawlMetrics.errorsEncountered++;
        }
        // Update average response time (simple moving average)
        this.crawlMetrics.averageResponseTime =
            (this.crawlMetrics.averageResponseTime * (this.crawlMetrics.totalRequests - 1) +
                responseTime) /
                this.crawlMetrics.totalRequests;
        // Record metrics
        this.recordCounter('crawl_requests_total', 1, { status: success ? 'success' : 'error' });
        this.recordTimer('crawl_request_duration', responseTime, { url });
        this.recordCounter('crawl_bytes_downloaded', bytesDownloaded);
    }
    trackCaptchaSolved(type, success, timeToSolve) {
        if (success) {
            this.crawlMetrics.captchasSolved++;
        }
        this.recordCounter('captcha_attempts_total', 1, {
            type,
            status: success ? 'solved' : 'failed',
        });
        this.recordTimer('captcha_solve_duration', timeToSolve, { type });
    }
    trackAuthenticationAttempt(strategy, success) {
        this.crawlMetrics.authenticationAttempts++;
        this.recordCounter('auth_attempts_total', 1, {
            strategy,
            status: success ? 'success' : 'failed',
        });
    }
    // System metrics collection
    async collectSystemMetrics() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        return {
            cpu: {
                usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
                loadAverage: require('os').loadavg(),
            },
            memory: {
                used: memUsage.rss,
                total: require('os').totalmem(),
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                external: memUsage.external,
            },
            network: {
                bytesReceived: 0, // Would be collected from network interface stats
                bytesSent: 0,
            },
            process: {
                uptime: process.uptime(),
                pid: process.pid,
                version: process.version,
            },
        };
    }
    // Reporting and alerts
    async generateReport() {
        const systemMetrics = await this.collectSystemMetrics();
        const errorRate = this.crawlMetrics.totalRequests > 0
            ? this.crawlMetrics.failedRequests / this.crawlMetrics.totalRequests
            : 0;
        // Calculate requests per second
        const uptime = (Date.now() - this.systemStartTime) / 1000;
        this.crawlMetrics.requestsPerSecond = uptime > 0 ? this.crawlMetrics.totalRequests / uptime : 0;
        const alerts = this.checkAlerts(systemMetrics, errorRate);
        const overallHealth = this.determineOverallHealth(alerts, systemMetrics, errorRate);
        return {
            timestamp: new Date(),
            systemMetrics,
            crawlMetrics: { ...this.crawlMetrics },
            activeTraces: this.activeSpans.size,
            alerts,
            summary: {
                overallHealth,
                uptime,
                totalOperations: this.crawlMetrics.totalRequests,
                errorRate,
            },
        };
    }
    getMetrics(name) {
        if (name) {
            const metrics = this.metrics.get(name);
            return metrics ? { [name]: metrics } : {};
        }
        return Object.fromEntries(this.metrics.entries());
    }
    getTraces(traceId) {
        if (traceId) {
            return Array.from(this.traces.values()).filter((span) => span.traceId === traceId);
        }
        return Array.from(this.traces.values());
    }
    getActiveSpans() {
        return Array.from(this.activeSpans.values());
    }
    addMetric(name, metric) {
        if (!this.metrics.has(name)) {
            this.metrics.set(name, []);
        }
        const metrics = this.metrics.get(name);
        metrics.push(metric);
        // Keep only recent metrics to prevent memory leaks
        if (metrics.length > this.config.metricsCollection.maxMetrics) {
            metrics.shift();
        }
    }
    startMetricsCollection() {
        this.metricsFlushInterval = setInterval(async () => {
            try {
                await this.flushMetrics();
            }
            catch (error) {
                logger_1.logger.error('Error flushing metrics', error);
            }
        }, this.config.metricsCollection.flushInterval);
    }
    startReporting() {
        this.reportingInterval = setInterval(async () => {
            try {
                const report = await this.generateReport();
                this.emit('report', report);
                if (this.config.reporting.includeSummary) {
                    logger_1.logger.info('Monitoring report', {
                        health: report.summary.overallHealth,
                        uptime: report.summary.uptime,
                        totalOps: report.summary.totalOperations,
                        errorRate: report.summary.errorRate,
                        activeTraces: report.activeTraces,
                        memoryUsage: report.systemMetrics.memory.heapUsed,
                    });
                }
            }
            catch (error) {
                logger_1.logger.error('Error generating monitoring report', error);
            }
        }, this.config.reporting.interval);
    }
    async flushMetrics() {
        if (this.metrics.size === 0)
            return;
        const allMetrics = Object.fromEntries(this.metrics.entries());
        switch (this.config.metricsCollection.exportFormat) {
            case 'prometheus':
                await this.exportPrometheusMetrics(allMetrics);
                break;
            case 'json':
                await this.exportJsonMetrics(allMetrics);
                break;
            case 'console':
                this.exportConsoleMetrics(allMetrics);
                break;
        }
        // Clear metrics after flush
        this.metrics.clear();
    }
    async exportPrometheusMetrics(metrics) {
        // Placeholder for Prometheus export
        logger_1.logger.debug('Exporting metrics in Prometheus format', {
            metricCount: Object.keys(metrics).length,
        });
    }
    async exportJsonMetrics(metrics) {
        // Placeholder for JSON export (could write to file or send to endpoint)
        logger_1.logger.debug('Exporting metrics in JSON format', {
            metricCount: Object.keys(metrics).length,
            metrics: JSON.stringify(metrics, null, 2),
        });
    }
    exportConsoleMetrics(metrics) {
        for (const [name, metricList] of Object.entries(metrics)) {
            const latest = metricList[metricList.length - 1];
            if (latest) {
                console.log(`${name}: ${latest.value} (${latest.type})`);
            }
        }
    }
    checkAlerts(systemMetrics, errorRate) {
        const alerts = [];
        const timestamp = new Date();
        if (errorRate > this.config.alerting.thresholds.errorRate) {
            alerts.push({
                type: 'error_rate',
                severity: errorRate > 0.5 ? 'critical' : 'high',
                message: `Error rate is ${(errorRate * 100).toFixed(2)}%, exceeding threshold of ${(this.config.alerting.thresholds.errorRate * 100).toFixed(2)}%`,
                timestamp,
            });
        }
        const memoryUsagePercent = systemMetrics.memory.heapUsed / systemMetrics.memory.heapTotal;
        if (memoryUsagePercent > this.config.alerting.thresholds.memoryUsage) {
            alerts.push({
                type: 'memory_usage',
                severity: memoryUsagePercent > 0.9 ? 'critical' : 'high',
                message: `Memory usage is ${(memoryUsagePercent * 100).toFixed(2)}%, exceeding threshold of ${(this.config.alerting.thresholds.memoryUsage * 100).toFixed(2)}%`,
                timestamp,
            });
        }
        if (this.crawlMetrics.averageResponseTime > this.config.alerting.thresholds.responseTime) {
            alerts.push({
                type: 'response_time',
                severity: 'medium',
                message: `Average response time is ${this.crawlMetrics.averageResponseTime.toFixed(2)}ms, exceeding threshold of ${this.config.alerting.thresholds.responseTime}ms`,
                timestamp,
            });
        }
        return alerts;
    }
    determineOverallHealth(alerts, _systemMetrics, errorRate) {
        const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
        const highAlerts = alerts.filter((a) => a.severity === 'high');
        if (criticalAlerts.length > 0) {
            return 'unhealthy';
        }
        if (highAlerts.length > 0 || errorRate > 0.1) {
            return 'degraded';
        }
        return 'healthy';
    }
    generateTraceId() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
    generateSpanId() {
        return Math.random().toString(36).substring(2, 10);
    }
    initializeCrawlMetrics() {
        return {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            requestsPerSecond: 0,
            bytesDownloaded: 0,
            pagesProcessed: 0,
            errorsEncountered: 0,
            captchasSolved: 0,
            authenticationAttempts: 0,
        };
    }
    mergeWithDefaults(config) {
        return {
            enabled: true,
            metricsCollection: {
                enabled: true,
                flushInterval: 30000, // 30 seconds
                maxMetrics: 1000,
                exportFormat: 'console',
                ...config.metricsCollection,
            },
            tracing: {
                enabled: true,
                samplingRate: 0.1, // 10% sampling
                maxSpans: 1000,
                ...config.tracing,
            },
            alerting: {
                enabled: true,
                thresholds: {
                    errorRate: 0.05, // 5%
                    responseTime: 5000, // 5 seconds
                    memoryUsage: 0.8, // 80%
                    crawlFailureRate: 0.1, // 10%
                },
                ...config.alerting,
            },
            reporting: {
                enabled: true,
                interval: 60000, // 1 minute
                includeSummary: true,
                ...config.reporting,
            },
            ...config,
        };
    }
}
exports.MonitoringService = MonitoringService;
//# sourceMappingURL=MonitoringService.js.map