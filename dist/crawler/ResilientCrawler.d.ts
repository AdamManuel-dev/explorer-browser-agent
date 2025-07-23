import { Browser } from 'playwright';
import { CrawlOptions } from './BreadthFirstCrawler';
import { CrawlResult } from '../types/crawler';
export interface CircuitBreakerConfig {
    failureThreshold: number;
    recoveryTimeout: number;
    monitoringPeriod: number;
}
export interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    retryableErrors: string[];
}
export interface ResilientCrawlerOptions extends CrawlOptions {
    circuitBreaker: CircuitBreakerConfig;
    retry: RetryConfig;
    healthCheck: {
        enabled: boolean;
        interval: number;
        timeout: number;
    };
    fallbackStrategies: {
        useBackupUserAgent: boolean;
        reduceParallelism: boolean;
        skipProblematicDomains: boolean;
    };
}
export declare enum CircuitBreakerState {
    CLOSED = "closed",
    OPEN = "open",
    HALF_OPEN = "half-open"
}
export interface HealthCheckResult {
    isHealthy: boolean;
    responseTime: number;
    error?: string;
    timestamp: Date;
}
export interface CrawlAttempt {
    url: string;
    attempt: number;
    timestamp: Date;
    success: boolean;
    error?: string;
    responseTime?: number;
}
export declare class ResilientCrawler {
    private baseCrawler;
    private options;
    private circuitBreakerState;
    private failureCount;
    private lastFailure?;
    private healthCheckInterval?;
    private problematicDomains;
    private crawlAttempts;
    private backupUserAgents;
    constructor(browser: Browser, options?: Partial<ResilientCrawlerOptions>);
    crawl(options: CrawlOptions): Promise<CrawlResult>;
    crawlWithFallback(options: CrawlOptions): Promise<CrawlResult>;
    healthCheck(url?: string): Promise<HealthCheckResult>;
    getCircuitBreakerState(): CircuitBreakerState;
    getFailureCount(): number;
    getProblematicDomains(): string[];
    getCrawlAttempts(): CrawlAttempt[];
    resetCircuitBreaker(): void;
    clearProblematicDomains(): void;
    destroy(): void;
    private executeWithRetry;
    private prepareCrawlOptions;
    private generateFallbackStrategies;
    private recordSuccess;
    private recordFailure;
    private isRetryableError;
    private isNetworkError;
    private calculateRetryDelay;
    private startHealthCheck;
    private sleep;
    private mergeWithDefaults;
}
//# sourceMappingURL=ResilientCrawler.d.ts.map