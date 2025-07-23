"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResilientCrawler = exports.CircuitBreakerState = void 0;
const BreadthFirstCrawler_1 = require("./BreadthFirstCrawler");
const logger_1 = require("../utils/logger");
var CircuitBreakerState;
(function (CircuitBreakerState) {
    CircuitBreakerState["CLOSED"] = "closed";
    CircuitBreakerState["OPEN"] = "open";
    CircuitBreakerState["HALF_OPEN"] = "half-open";
})(CircuitBreakerState || (exports.CircuitBreakerState = CircuitBreakerState = {}));
class ResilientCrawler {
    baseCrawler;
    options;
    circuitBreakerState = CircuitBreakerState.CLOSED;
    failureCount = 0;
    lastFailure;
    healthCheckInterval;
    problematicDomains = new Set();
    crawlAttempts = [];
    backupUserAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    ];
    constructor(browser, options) {
        this.options = this.mergeWithDefaults(options || {});
        // Create CrawlConfiguration from ResilientCrawlerOptions
        const crawlConfig = {
            startUrl: this.options.startUrl,
            maxDepth: this.options.maxDepth,
            maxPages: this.options.maxPages,
            crawlDelay: this.options.crawlDelay || 1000,
            allowedDomains: this.options.allowedDomains,
            respectRobotsTxt: this.options.respectRobotsTxt || false,
            userAgent: this.options.userAgent,
            customHeaders: this.options.customHeaders,
            parallelWorkers: this.options.parallelWorkers || 5,
        };
        this.baseCrawler = new BreadthFirstCrawler_1.BreadthFirstCrawler(crawlConfig);
        if (this.options.healthCheck.enabled) {
            this.startHealthCheck();
        }
    }
    async crawl(options) {
        logger_1.logger.info('Starting resilient crawl', {
            url: options.startUrl,
            circuitBreakerState: this.circuitBreakerState,
        });
        // Check circuit breaker
        if (this.circuitBreakerState === CircuitBreakerState.OPEN) {
            throw new Error('Circuit breaker is open - crawling temporarily disabled');
        }
        // Merge options with resilient defaults
        const crawlOptions = this.prepareCrawlOptions(options);
        try {
            const result = await this.executeWithRetry(async () => this.baseCrawler.crawl());
            this.recordSuccess();
            return result;
        }
        catch (error) {
            this.recordFailure(error);
            throw error;
        }
    }
    async crawlWithFallback(options) {
        let lastError = null;
        const strategies = this.generateFallbackStrategies(options);
        for (const strategy of strategies) {
            try {
                logger_1.logger.info('Attempting crawl with strategy', { strategy: strategy.name });
                const result = await this.crawl(strategy.options);
                logger_1.logger.info('Fallback strategy succeeded', { strategy: strategy.name });
                return result;
            }
            catch (error) {
                lastError = error;
                logger_1.logger.warn('Fallback strategy failed', {
                    strategy: strategy.name,
                    error: lastError.message,
                });
                // Add domain to problematic list if network-related error
                if (this.isNetworkError(lastError)) {
                    const domain = new URL(options.startUrl).hostname;
                    this.problematicDomains.add(domain);
                }
            }
        }
        throw lastError || new Error('All fallback strategies failed');
    }
    async healthCheck(url) {
        const testUrl = url || this.options.startUrl;
        const startTime = Date.now();
        try {
            // Simple fetch-based health check since we don't have direct browser access
            const response = await fetch(testUrl, {
                method: 'HEAD',
                headers: {
                    'User-Agent': this.options.userAgent,
                },
                signal: AbortSignal.timeout(this.options.healthCheck.timeout),
            });
            const responseTime = Date.now() - startTime;
            return {
                isHealthy: response.ok,
                responseTime,
                timestamp: new Date(),
            };
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            return {
                isHealthy: false,
                responseTime,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date(),
            };
        }
    }
    getCircuitBreakerState() {
        return this.circuitBreakerState;
    }
    getFailureCount() {
        return this.failureCount;
    }
    getProblematicDomains() {
        return Array.from(this.problematicDomains);
    }
    getCrawlAttempts() {
        return [...this.crawlAttempts];
    }
    resetCircuitBreaker() {
        this.circuitBreakerState = CircuitBreakerState.CLOSED;
        this.failureCount = 0;
        this.lastFailure = undefined;
        logger_1.logger.info('Circuit breaker reset manually');
    }
    clearProblematicDomains() {
        this.problematicDomains.clear();
        logger_1.logger.info('Problematic domains list cleared');
    }
    destroy() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
    }
    async executeWithRetry(operation) {
        let lastError = null;
        for (let attempt = 0; attempt <= this.options.retry.maxRetries; attempt++) {
            try {
                const result = await operation();
                if (attempt > 0) {
                    logger_1.logger.info('Operation succeeded after retry', { attempt });
                }
                return result;
            }
            catch (error) {
                lastError = error;
                if (attempt === this.options.retry.maxRetries) {
                    logger_1.logger.error('Operation failed after all retries', {
                        attempts: attempt + 1,
                        error: lastError.message,
                    });
                    break;
                }
                if (!this.isRetryableError(lastError)) {
                    logger_1.logger.warn('Non-retryable error encountered', { error: lastError.message });
                    break;
                }
                const delay = this.calculateRetryDelay(attempt);
                logger_1.logger.warn('Operation failed, retrying', {
                    attempt: attempt + 1,
                    delay,
                    error: lastError.message,
                });
                await this.sleep(delay);
            }
        }
        throw lastError || new Error('Operation failed');
    }
    prepareCrawlOptions(options) {
        const preparedOptions = { ...options };
        // Apply fallback strategies
        if (this.options.fallbackStrategies.reduceParallelism && this.failureCount > 0) {
            // Reduce parallelism when failures occur
            preparedOptions.parallelWorkers = Math.max(1, (preparedOptions.parallelWorkers || 3) / 2);
        }
        // Skip problematic domains
        if (this.options.fallbackStrategies.skipProblematicDomains) {
            const domain = new URL(options.startUrl).hostname;
            if (this.problematicDomains.has(domain)) {
                throw new Error(`Domain ${domain} is in the problematic domains list`);
            }
        }
        return preparedOptions;
    }
    generateFallbackStrategies(options) {
        const strategies = [];
        // Strategy 1: Original options
        strategies.push({
            name: 'original',
            options: { ...options },
        });
        // Strategy 2: Reduced parallelism
        strategies.push({
            name: 'reduced-parallelism',
            options: {
                ...options,
                parallelWorkers: 1,
                crawlDelay: Math.max(options.crawlDelay || 1000, 2000),
            },
        });
        // Strategy 3: Backup user agent
        if (this.options.fallbackStrategies.useBackupUserAgent) {
            const randomUserAgent = this.backupUserAgents[Math.floor(Math.random() * this.backupUserAgents.length)];
            strategies.push({
                name: 'backup-user-agent',
                options: {
                    ...options,
                    userAgent: randomUserAgent,
                    crawlDelay: Math.max(options.crawlDelay || 1000, 1500),
                },
            });
        }
        // Strategy 4: Conservative approach
        strategies.push({
            name: 'conservative',
            options: {
                ...options,
                maxDepth: Math.min(options.maxDepth, 2),
                maxPages: Math.min(options.maxPages, 20),
                crawlDelay: Math.max(options.crawlDelay || 1000, 3000),
                parallelWorkers: 1,
            },
        });
        return strategies;
    }
    recordSuccess() {
        if (this.circuitBreakerState === CircuitBreakerState.HALF_OPEN) {
            this.circuitBreakerState = CircuitBreakerState.CLOSED;
            this.failureCount = 0;
            logger_1.logger.info('Circuit breaker closed after successful operation');
        }
    }
    recordFailure(error) {
        this.failureCount++;
        this.lastFailure = new Date();
        this.crawlAttempts.push({
            url: this.options.startUrl,
            attempt: this.failureCount,
            timestamp: new Date(),
            success: false,
            error: error.message,
        });
        // Keep only recent attempts
        if (this.crawlAttempts.length > 100) {
            this.crawlAttempts = this.crawlAttempts.slice(-50);
        }
        if (this.failureCount >= this.options.circuitBreaker.failureThreshold) {
            this.circuitBreakerState = CircuitBreakerState.OPEN;
            logger_1.logger.warn('Circuit breaker opened due to failures', {
                failureCount: this.failureCount,
                threshold: this.options.circuitBreaker.failureThreshold,
            });
            // Schedule recovery attempt
            setTimeout(() => {
                if (this.circuitBreakerState === CircuitBreakerState.OPEN) {
                    this.circuitBreakerState = CircuitBreakerState.HALF_OPEN;
                    logger_1.logger.info('Circuit breaker moved to half-open state');
                }
            }, this.options.circuitBreaker.recoveryTimeout);
        }
    }
    isRetryableError(error) {
        const errorMessage = error.message.toLowerCase();
        return this.options.retry.retryableErrors.some((pattern) => errorMessage.includes(pattern.toLowerCase()));
    }
    isNetworkError(error) {
        const networkErrors = ['net::', 'timeout', 'connection', 'dns', 'socket'];
        const errorMessage = error.message.toLowerCase();
        return networkErrors.some((pattern) => errorMessage.includes(pattern));
    }
    calculateRetryDelay(attempt) {
        const { baseDelay } = this.options.retry;
        const multiplier = this.options.retry.backoffMultiplier;
        const { maxDelay } = this.options.retry;
        const delay = baseDelay * multiplier ** attempt;
        return Math.min(delay, maxDelay);
    }
    startHealthCheck() {
        this.healthCheckInterval = setInterval(async () => {
            try {
                const result = await this.healthCheck();
                if (!result.isHealthy) {
                    logger_1.logger.warn('Health check failed', {
                        error: result.error,
                        responseTime: result.responseTime,
                    });
                }
                else {
                    logger_1.logger.debug('Health check passed', {
                        responseTime: result.responseTime,
                    });
                }
            }
            catch (error) {
                logger_1.logger.error('Health check error', error);
            }
        }, this.options.healthCheck.interval);
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    mergeWithDefaults(options) {
        return {
            // Base crawl options
            startUrl: options.startUrl || '',
            maxDepth: options.maxDepth || 3,
            maxPages: options.maxPages || 100,
            crawlDelay: options.crawlDelay || 1000,
            respectRobotsTxt: options.respectRobotsTxt ?? true,
            allowedDomains: options.allowedDomains || [],
            userAgent: options.userAgent || 'Mozilla/5.0 (compatible; BrowserExplorer/1.0)',
            parallelWorkers: options.parallelWorkers || 3,
            // Circuit breaker configuration
            circuitBreaker: {
                failureThreshold: 5,
                recoveryTimeout: 60000, // 1 minute
                monitoringPeriod: 300000, // 5 minutes
                ...options.circuitBreaker,
            },
            // Retry configuration
            retry: {
                maxRetries: 3,
                baseDelay: 1000,
                maxDelay: 10000,
                backoffMultiplier: 2,
                retryableErrors: [
                    'timeout',
                    'net::',
                    'connection reset',
                    'socket hang up',
                    'enotfound',
                    'econnreset',
                    'econnrefused',
                ],
                ...options.retry,
            },
            // Health check configuration
            healthCheck: {
                enabled: true,
                interval: 30000, // 30 seconds
                timeout: 10000, // 10 seconds
                ...options.healthCheck,
            },
            // Fallback strategies
            fallbackStrategies: {
                useBackupUserAgent: true,
                reduceParallelism: true,
                skipProblematicDomains: true,
                ...options.fallbackStrategies,
            },
        };
    }
}
exports.ResilientCrawler = ResilientCrawler;
//# sourceMappingURL=ResilientCrawler.js.map