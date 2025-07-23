import { EventEmitter } from 'events';
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
export declare class MonitoringService extends EventEmitter {
    private config;
    private metrics;
    private traces;
    private activeSpans;
    private systemStartTime;
    private metricsFlushInterval?;
    private reportingInterval?;
    private crawlMetrics;
    constructor(config?: Partial<MonitoringConfig>);
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    recordCounter(name: string, value?: number, labels?: Record<string, string>): void;
    recordGauge(name: string, value: number, labels?: Record<string, string>): void;
    recordHistogram(name: string, value: number, buckets?: number[], labels?: Record<string, string>): void;
    recordTimer(name: string, duration: number, labels?: Record<string, string>): void;
    startTimer(name: string): () => void;
    timeFunction<T>(name: string, fn: () => Promise<T> | T, labels?: Record<string, string>): Promise<T>;
    startSpan(operationName: string, parentSpanId?: string, tags?: Record<string, unknown>): string;
    finishSpan(spanId: string, tags?: Record<string, unknown>): void;
    addSpanLog(spanId: string, level: 'info' | 'warn' | 'error' | 'debug', message: string, fields?: Record<string, unknown>): void;
    addSpanTag(spanId: string, key: string, value: unknown): void;
    endSpan(spanId: string, tags?: Record<string, unknown>): void;
    trackPageRequest(url: string, success: boolean, responseTime: number, bytesDownloaded: number): void;
    trackCaptchaSolved(type: string, success: boolean, timeToSolve: number): void;
    trackAuthenticationAttempt(strategy: string, success: boolean): void;
    collectSystemMetrics(): Promise<SystemMetrics>;
    generateReport(): Promise<MonitoringReport>;
    getMetrics(name?: string): Record<string, Metric[]>;
    getTraces(traceId?: string): TraceSpan[];
    getActiveSpans(): TraceSpan[];
    private addMetric;
    private startMetricsCollection;
    private startReporting;
    private flushMetrics;
    private exportPrometheusMetrics;
    private exportJsonMetrics;
    private exportConsoleMetrics;
    private checkAlerts;
    private determineOverallHealth;
    private generateTraceId;
    private generateSpanId;
    private initializeCrawlMetrics;
    private mergeWithDefaults;
}
//# sourceMappingURL=MonitoringService.d.ts.map