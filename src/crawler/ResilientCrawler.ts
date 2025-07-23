import { Browser } from 'playwright';
import { BreadthFirstCrawler, CrawlOptions, CrawlConfiguration } from './BreadthFirstCrawler';
import { CrawlResult } from '../types/crawler';
import { logger } from '../utils/logger';

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

export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half-open',
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

export class ResilientCrawler {
  private baseCrawler: BreadthFirstCrawler;

  private options: ResilientCrawlerOptions;

  private circuitBreakerState: CircuitBreakerState = CircuitBreakerState.CLOSED;

  private failureCount = 0;

  // private lastFailure?: Date;
  private healthCheckInterval?: NodeJS.Timeout;

  private problematicDomains = new Set<string>();

  private crawlAttempts: CrawlAttempt[] = [];

  private backupUserAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
  ];

  constructor(browser: Browser, options?: Partial<ResilientCrawlerOptions>) {
    this.options = this.mergeWithDefaults(options || {});
    // Create CrawlConfiguration from ResilientCrawlerOptions
    const crawlConfig: CrawlConfiguration = {
      startUrl: this.options.startUrl,
      maxDepth: this.options.maxDepth,
      maxPages: this.options.maxPages,
      crawlDelay: this.options.crawlDelay || this.options.delay || 1000,
      allowedDomains: this.options.allowedDomains,
      respectRobotsTxt: this.options.respectRobotsTxt || this.options.respectRobots || false,
      userAgent: this.options.userAgent,
      customHeaders: this.options.customHeaders,
      parallelWorkers: this.options.parallelWorkers || this.options.maxConcurrency || 5,
    };
    this.baseCrawler = new BreadthFirstCrawler(crawlConfig);

    if (this.options.healthCheck.enabled) {
      this.startHealthCheck();
    }
  }

  async crawl(options: CrawlOptions): Promise<CrawlResult> {
    logger.info('Starting resilient crawl', {
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
      const result = await this.executeWithRetry(async () => this.baseCrawler.crawl(crawlOptions));

      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error as Error);
      throw error;
    }
  }

  async crawlWithFallback(options: CrawlOptions): Promise<CrawlResult> {
    let lastError: Error | null = null;
    const strategies = this.generateFallbackStrategies(options);

    for (const strategy of strategies) {
      try {
        logger.info('Attempting crawl with strategy', { strategy: strategy.name });
        const result = await this.crawl(strategy.options);

        logger.info('Fallback strategy succeeded', { strategy: strategy.name });
        return result;
      } catch (error) {
        lastError = error as Error;
        logger.warn('Fallback strategy failed', {
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

  async healthCheck(url?: string): Promise<HealthCheckResult> {
    const testUrl = url || this.options.startUrl;
    const startTime = Date.now();

    try {
      const page = await this.baseCrawler.browser.newPage();

      try {
        await page.goto(testUrl, {
          waitUntil: 'domcontentloaded',
          timeout: this.options.healthCheck.timeout,
        });

        const responseTime = Date.now() - startTime;

        return {
          isHealthy: true,
          responseTime,
          timestamp: new Date(),
        };
      } finally {
        await page.close();
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        isHealthy: false,
        responseTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      };
    }
  }

  getCircuitBreakerState(): CircuitBreakerState {
    return this.circuitBreakerState;
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  getProblematicDomains(): string[] {
    return Array.from(this.problematicDomains);
  }

  getCrawlAttempts(): CrawlAttempt[] {
    return [...this.crawlAttempts];
  }

  resetCircuitBreaker(): void {
    this.circuitBreakerState = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.lastFailure = undefined;
    logger.info('Circuit breaker reset manually');
  }

  clearProblematicDomains(): void {
    this.problematicDomains.clear();
    logger.info('Problematic domains list cleared');
  }

  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.options.retry.maxRetries; attempt++) {
      try {
        const result = await operation();

        if (attempt > 0) {
          logger.info('Operation succeeded after retry', { attempt });
        }

        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt === this.options.retry.maxRetries) {
          logger.error('Operation failed after all retries', {
            attempts: attempt + 1,
            error: lastError.message,
          });
          break;
        }

        if (!this.isRetryableError(lastError)) {
          logger.warn('Non-retryable error encountered', { error: lastError.message });
          break;
        }

        const delay = this.calculateRetryDelay(attempt);
        logger.warn('Operation failed, retrying', {
          attempt: attempt + 1,
          delay,
          error: lastError.message,
        });

        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Operation failed');
  }

  private prepareCrawlOptions(options: CrawlOptions): CrawlOptions {
    const preparedOptions = { ...options };

    // Apply fallback strategies
    if (this.options.fallbackStrategies.reduceParallelism && this.failureCount > 0) {
      // Reduce parallelism when failures occur
      preparedOptions.maxConcurrency = Math.max(1, (preparedOptions.maxConcurrency || 3) / 2);
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

  private generateFallbackStrategies(
    options: CrawlOptions
  ): Array<{ name: string; options: CrawlOptions }> {
    const strategies: Array<{ name: string; options: CrawlOptions }> = [];

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
        maxConcurrency: 1,
        delay: Math.max(options.delay || 1000, 2000),
      },
    });

    // Strategy 3: Backup user agent
    if (this.options.fallbackStrategies.useBackupUserAgent) {
      const randomUserAgent =
        this.backupUserAgents[Math.floor(Math.random() * this.backupUserAgents.length)];

      strategies.push({
        name: 'backup-user-agent',
        options: {
          ...options,
          userAgent: randomUserAgent,
          delay: Math.max(options.delay || 1000, 1500),
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
        delay: Math.max(options.delay || 1000, 3000),
        maxConcurrency: 1,
      },
    });

    return strategies;
  }

  private recordSuccess(): void {
    if (this.circuitBreakerState === CircuitBreakerState.HALF_OPEN) {
      this.circuitBreakerState = CircuitBreakerState.CLOSED;
      this.failureCount = 0;
      logger.info('Circuit breaker closed after successful operation');
    }
  }

  private recordFailure(error: Error): void {
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
      logger.warn('Circuit breaker opened due to failures', {
        failureCount: this.failureCount,
        threshold: this.options.circuitBreaker.failureThreshold,
      });

      // Schedule recovery attempt
      setTimeout(() => {
        if (this.circuitBreakerState === CircuitBreakerState.OPEN) {
          this.circuitBreakerState = CircuitBreakerState.HALF_OPEN;
          logger.info('Circuit breaker moved to half-open state');
        }
      }, this.options.circuitBreaker.recoveryTimeout);
    }
  }

  private isRetryableError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    return this.options.retry.retryableErrors.some((pattern) =>
      errorMessage.includes(pattern.toLowerCase())
    );
  }

  private isNetworkError(error: Error): boolean {
    const networkErrors = ['net::', 'timeout', 'connection', 'dns', 'socket'];
    const errorMessage = error.message.toLowerCase();
    return networkErrors.some((pattern) => errorMessage.includes(pattern));
  }

  private calculateRetryDelay(attempt: number): number {
    const { baseDelay } = this.options.retry;
    const multiplier = this.options.retry.backoffMultiplier;
    const { maxDelay } = this.options.retry;

    const delay = baseDelay * multiplier ** attempt;
    return Math.min(delay, maxDelay);
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const result = await this.healthCheck();

        if (!result.isHealthy) {
          logger.warn('Health check failed', {
            error: result.error,
            responseTime: result.responseTime,
          });
        } else {
          logger.debug('Health check passed', {
            responseTime: result.responseTime,
          });
        }
      } catch (error) {
        logger.error('Health check error', error);
      }
    }, this.options.healthCheck.interval);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private mergeWithDefaults(options: Partial<ResilientCrawlerOptions>): ResilientCrawlerOptions {
    return {
      // Base crawl options
      startUrl: options.startUrl || '',
      maxDepth: options.maxDepth || 3,
      maxPages: options.maxPages || 100,
      delay: options.delay || 1000,
      respectRobots: options.respectRobots ?? true,
      sameDomain: options.sameDomain ?? true,
      maxConcurrency: options.maxConcurrency || 3,

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
