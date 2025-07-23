import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface MetricValue {
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
}

export interface CounterMetric extends MetricValue {
  type: 'counter';
}

export interface GaugeMetric extends MetricValue {
  type: 'gauge';
}

export interface HistogramMetric extends MetricValue {
  type: 'histogram';
  buckets?: number[];
}

export interface TimerMetric extends MetricValue {
  type: 'timer';
  duration: number;
}

export type Metric = CounterMetric | GaugeMetric | HistogramMetric | TimerMetric;

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  tags: Record<string, unknown>;
  logs: Array<{
    timestamp: Date;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    fields?: Record<string, unknown>;
  }>;
  status: 'active' | 'completed' | 'error';
  error?: string;
}

export interface MonitoringConfig {
  enabled: boolean;
  metricsCollection: {
    enabled: boolean;
    flushInterval: number;
    maxMetrics: number;
    exportFormat: 'prometheus' | 'json' | 'console';
  };
  tracing: {
    enabled: boolean;
    samplingRate: number;
    maxSpans: number;
    exportEndpoint?: string;
  };
  alerting: {
    enabled: boolean;
    thresholds: {
      errorRate: number;
      responseTime: number;
      memoryUsage: number;
      crawlFailureRate: number;
    };
    webhookUrl?: string;
  };
  reporting: {
    enabled: boolean;
    interval: number;
    includeSummary: boolean;
  };
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  network: {
    bytesReceived: number;
    bytesSent: number;
  };
  process: {
    uptime: number;
    pid: number;
    version: string;
  };
}

export interface CrawlMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  requestsPerSecond: number;
  bytesDownloaded: number;
  pagesProcessed: number;
  errorsEncountered: number;
  captchasSolved: number;
  authenticationAttempts: number;
}

export interface MonitoringReport {
  timestamp: Date;
  systemMetrics: SystemMetrics;
  crawlMetrics: CrawlMetrics;
  activeTraces: number;
  alerts: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: Date;
  }>;
  summary: {
    overallHealth: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    totalOperations: number;
    errorRate: number;
  };
}

export class MonitoringService extends EventEmitter {
  private config: MonitoringConfig;

  private metrics = new Map<string, Metric[]>();

  private traces = new Map<string, TraceSpan>();

  private activeSpans = new Map<string, TraceSpan>();

  private systemStartTime = Date.now();

  private metricsFlushInterval?: NodeJS.Timeout;

  private reportingInterval?: NodeJS.Timeout;

  private crawlMetrics: CrawlMetrics;

  constructor(config?: Partial<MonitoringConfig>) {
    super();
    this.config = this.mergeWithDefaults(config || {});
    this.crawlMetrics = this.initializeCrawlMetrics();

    if (this.config.enabled) {
      this.initialize();
    }
  }

  async initialize(): Promise<void> {
    logger.info('Initializing monitoring service', {
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

  async shutdown(): Promise<void> {
    logger.info('Shutting down monitoring service');

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
  recordCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    if (!this.config.metricsCollection.enabled) return;

    const metric: CounterMetric = {
      type: 'counter',
      value,
      timestamp: new Date(),
      labels,
    };

    this.addMetric(name, metric);
  }

  recordGauge(name: string, value: number, labels?: Record<string, string>): void {
    if (!this.config.metricsCollection.enabled) return;

    const metric: GaugeMetric = {
      type: 'gauge',
      value,
      timestamp: new Date(),
      labels,
    };

    this.addMetric(name, metric);
  }

  recordHistogram(
    name: string,
    value: number,
    buckets?: number[],
    labels?: Record<string, string>
  ): void {
    if (!this.config.metricsCollection.enabled) return;

    const metric: HistogramMetric = {
      type: 'histogram',
      value,
      timestamp: new Date(),
      buckets,
      labels,
    };

    this.addMetric(name, metric);
  }

  recordTimer(name: string, duration: number, labels?: Record<string, string>): void {
    if (!this.config.metricsCollection.enabled) return;

    const metric: TimerMetric = {
      type: 'timer',
      value: duration,
      duration,
      timestamp: new Date(),
      labels,
    };

    this.addMetric(name, metric);
  }

  // Timing utilities
  startTimer(name: string): () => void {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      this.recordTimer(name, duration);
    };
  }

  async timeFunction<T>(
    name: string,
    fn: () => Promise<T> | T,
    labels?: Record<string, string>
  ): Promise<T> {
    const startTime = performance.now();
    let error: Error | null = null;

    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      this.recordTimer(name, duration, { ...labels, status: 'success' });
      return result;
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      const duration = performance.now() - startTime;
      this.recordTimer(name, duration, { ...labels, status: 'error' });
      throw error;
    }
  }

  // Distributed Tracing
  startSpan(operationName: string, parentSpanId?: string, tags?: Record<string, unknown>): string {
    if (!this.config.tracing.enabled) return '';

    // Simple sampling based on rate
    if (Math.random() > this.config.tracing.samplingRate) {
      return '';
    }

    const traceId = parentSpanId
      ? this.activeSpans.get(parentSpanId)?.traceId || this.generateTraceId()
      : this.generateTraceId();

    const spanId = this.generateSpanId();

    const span: TraceSpan = {
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

    logger.debug('Started trace span', {
      traceId,
      spanId,
      operationName,
      parentSpanId,
    });

    return spanId;
  }

  finishSpan(spanId: string, tags?: Record<string, unknown>): void {
    if (!this.config.tracing.enabled || !spanId) return;

    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.endTime = new Date();
    span.duration = span.endTime.getTime() - span.startTime.getTime();
    span.status = tags?.error ? 'error' : 'completed';
    span.error = tags?.error as string | undefined;

    if (tags) {
      span.tags = { ...span.tags, ...tags };
    }

    this.activeSpans.delete(spanId);

    logger.debug('Finished trace span', {
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

  addSpanLog(
    spanId: string,
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    fields?: Record<string, unknown>
  ): void {
    if (!this.config.tracing.enabled || !spanId) return;

    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.logs.push({
      timestamp: new Date(),
      level,
      message,
      fields,
    });
  }

  addSpanTag(spanId: string, key: string, value: unknown): void {
    if (!this.config.tracing.enabled || !spanId) return;

    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.tags[key] = value;
  }

  // Alias for finishSpan to maintain compatibility
  endSpan(spanId: string, tags?: Record<string, unknown>): void {
    this.finishSpan(spanId, tags);
  }

  // Crawl-specific metrics tracking
  trackPageRequest(
    url: string,
    success: boolean,
    responseTime: number,
    bytesDownloaded: number
  ): void {
    this.crawlMetrics.totalRequests++;

    if (success) {
      this.crawlMetrics.successfulRequests++;
      this.crawlMetrics.bytesDownloaded += bytesDownloaded;
      this.crawlMetrics.pagesProcessed++;
    } else {
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

  trackCaptchaSolved(type: string, success: boolean, timeToSolve: number): void {
    if (success) {
      this.crawlMetrics.captchasSolved++;
    }

    this.recordCounter('captcha_attempts_total', 1, {
      type,
      status: success ? 'solved' : 'failed',
    });
    this.recordTimer('captcha_solve_duration', timeToSolve, { type });
  }

  trackAuthenticationAttempt(strategy: string, success: boolean): void {
    this.crawlMetrics.authenticationAttempts++;

    this.recordCounter('auth_attempts_total', 1, {
      strategy,
      status: success ? 'success' : 'failed',
    });
  }

  // System metrics collection
  async collectSystemMetrics(): Promise<SystemMetrics> {
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
  async generateReport(): Promise<MonitoringReport> {
    const systemMetrics = await this.collectSystemMetrics();
    const errorRate =
      this.crawlMetrics.totalRequests > 0
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

  getMetrics(name?: string): Record<string, Metric[]> {
    if (name) {
      const metrics = this.metrics.get(name);
      return metrics ? { [name]: metrics } : {};
    }

    return Object.fromEntries(this.metrics.entries());
  }

  getTraces(traceId?: string): TraceSpan[] {
    if (traceId) {
      return Array.from(this.traces.values()).filter((span) => span.traceId === traceId);
    }

    return Array.from(this.traces.values());
  }

  getActiveSpans(): TraceSpan[] {
    return Array.from(this.activeSpans.values());
  }

  private addMetric(name: string, metric: Metric): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metrics = this.metrics.get(name)!;
    metrics.push(metric);

    // Keep only recent metrics to prevent memory leaks
    if (metrics.length > this.config.metricsCollection.maxMetrics) {
      metrics.shift();
    }
  }

  private startMetricsCollection(): void {
    this.metricsFlushInterval = setInterval(async () => {
      try {
        await this.flushMetrics();
      } catch (error) {
        logger.error('Error flushing metrics', error);
      }
    }, this.config.metricsCollection.flushInterval);
  }

  private startReporting(): void {
    this.reportingInterval = setInterval(async () => {
      try {
        const report = await this.generateReport();
        this.emit('report', report);

        if (this.config.reporting.includeSummary) {
          logger.info('Monitoring report', {
            health: report.summary.overallHealth,
            uptime: report.summary.uptime,
            totalOps: report.summary.totalOperations,
            errorRate: report.summary.errorRate,
            activeTraces: report.activeTraces,
            memoryUsage: report.systemMetrics.memory.heapUsed,
          });
        }
      } catch (error) {
        logger.error('Error generating monitoring report', error);
      }
    }, this.config.reporting.interval);
  }

  private async flushMetrics(): Promise<void> {
    if (this.metrics.size === 0) return;

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
      default:
        logger.warn('Unknown metrics export format');
    }

    // Clear metrics after flush
    this.metrics.clear();
  }

  private async exportPrometheusMetrics(metrics: Record<string, Metric[]>): Promise<void> {
    // Placeholder for Prometheus export
    logger.debug('Exporting metrics in Prometheus format', {
      metricCount: Object.keys(metrics).length,
    });
  }

  private async exportJsonMetrics(metrics: Record<string, Metric[]>): Promise<void> {
    // Placeholder for JSON export (could write to file or send to endpoint)
    logger.debug('Exporting metrics in JSON format', {
      metricCount: Object.keys(metrics).length,
      metrics: JSON.stringify(metrics, null, 2),
    });
  }

  private exportConsoleMetrics(metrics: Record<string, Metric[]>): void {
    for (const [name, metricList] of Object.entries(metrics)) {
      const latest = metricList[metricList.length - 1];
      if (latest) {
        logger.info(`${name}: ${latest.value} (${latest.type})`);
      }
    }
  }

  private checkAlerts(
    systemMetrics: SystemMetrics,
    errorRate: number
  ): Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: Date;
  }> {
    const alerts = [];
    const timestamp = new Date();

    if (errorRate > this.config.alerting.thresholds.errorRate) {
      alerts.push({
        type: 'error_rate',
        severity: errorRate > 0.5 ? 'critical' : ('high' as 'critical' | 'high'),
        message: `Error rate is ${(errorRate * 100).toFixed(2)}%, exceeding threshold of ${(this.config.alerting.thresholds.errorRate * 100).toFixed(2)}%`,
        timestamp,
      });
    }

    const memoryUsagePercent = systemMetrics.memory.heapUsed / systemMetrics.memory.heapTotal;
    if (memoryUsagePercent > this.config.alerting.thresholds.memoryUsage) {
      alerts.push({
        type: 'memory_usage',
        severity: memoryUsagePercent > 0.9 ? 'critical' : ('high' as 'critical' | 'high'),
        message: `Memory usage is ${(memoryUsagePercent * 100).toFixed(2)}%, exceeding threshold of ${(this.config.alerting.thresholds.memoryUsage * 100).toFixed(2)}%`,
        timestamp,
      });
    }

    if (this.crawlMetrics.averageResponseTime > this.config.alerting.thresholds.responseTime) {
      alerts.push({
        type: 'response_time',
        severity: 'medium' as 'medium',
        message: `Average response time is ${this.crawlMetrics.averageResponseTime.toFixed(2)}ms, exceeding threshold of ${this.config.alerting.thresholds.responseTime}ms`,
        timestamp,
      });
    }

    return alerts;
  }

  private determineOverallHealth(
    alerts: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      timestamp: Date;
    }>,
    _systemMetrics: SystemMetrics,
    errorRate: number
  ): 'healthy' | 'degraded' | 'unhealthy' {
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

  private generateTraceId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private generateSpanId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  private initializeCrawlMetrics(): CrawlMetrics {
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

  private mergeWithDefaults(config: Partial<MonitoringConfig>): MonitoringConfig {
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
