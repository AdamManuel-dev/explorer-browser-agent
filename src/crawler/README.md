# Crawler Module

The crawler module provides comprehensive web crawling capabilities with support for breadth-first search, resilient crawling, and distributed crawling architectures.

## Components

### BreadthFirstCrawler

A systematic web crawler that uses breadth-first search algorithm to explore websites.

**Features:**
- Queue-based BFS algorithm
- URL normalization and deduplication
- Concurrent crawling with configurable worker pools
- Robots.txt compliance
- Domain filtering and depth limiting
- Comprehensive error handling and reporting

**Usage:**
```typescript
import { BreadthFirstCrawler } from './crawler';
import { chromium } from 'playwright';

const browser = await chromium.launch();
const crawler = new BreadthFirstCrawler(browser);

const result = await crawler.crawl({
  startUrl: 'https://example.com',
  maxDepth: 3,
  maxPages: 100,
  parallelWorkers: 4,
  allowedDomains: ['example.com'],
  respectRobotsTxt: true,
});

console.log(`Crawled ${result.crawledUrls.length} pages`);
```

### ResilientCrawler

An enhanced crawler with circuit breaker patterns, retry logic, and health monitoring.

**Features:**
- Circuit breaker for fault tolerance
- Exponential backoff retry strategies
- Health check monitoring
- Automatic recovery mechanisms
- Detailed failure tracking

**Usage:**
```typescript
import { ResilientCrawler } from './crawler';

const resilientCrawler = new ResilientCrawler(browser, {
  circuitBreaker: {
    failureThreshold: 5,
    recoveryTimeout: 10000,
  },
  retry: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 5000,
  },
});

const result = await resilientCrawler.crawl(crawlOptions);
```

### DistributedCrawler

A distributed crawling system using Redis for coordination and job queuing.

**Features:**
- Redis-based job queue with priority levels
- Worker coordination and heartbeat monitoring
- Horizontal scaling support
- Job retry logic with exponential backoff
- Distributed URL deduplication
- Real-time worker status monitoring

**Usage:**
```typescript
import { DistributedCrawler } from './crawler';

const distributedCrawler = new DistributedCrawler(browser, {
  workerId: 'worker-1',
  concurrency: 4,
  redis: {
    host: 'localhost',
    port: 6379,
    keyPrefix: 'crawl-job',
  },
  queueConfig: {
    maxRetries: 3,
    retryDelay: 2000,
    priorityLevels: 5,
  },
});

await distributedCrawler.startWorker();
const result = await distributedCrawler.distributedCrawl('https://example.com');
```

### CrawlerService

A high-level service that orchestrates different crawler types and provides a unified interface.

**Usage:**
```typescript
import { CrawlerService } from './crawler';

const service = new CrawlerService({
  startUrl: 'https://example.com',
  maxDepth: 2,
  maxPages: 50,
});

await service.initialize();
const result = await service.crawl();
await service.cleanup();
```

## Configuration Options

### CrawlConfiguration
```typescript
interface CrawlConfiguration {
  startUrl: string;
  maxDepth: number;
  maxPages: number;
  crawlDelay: number;
  parallelWorkers: number;
  allowedDomains: string[];
  excludePatterns: string[];
  respectRobotsTxt: boolean;
  userAgent: string;
  timeout: number;
  retryAttempts: number;
}
```

### Circuit Breaker Configuration
```typescript
interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
}
```

### Distributed Crawl Configuration
```typescript
interface DistributedCrawlConfig extends CrawlOptions {
  redis: RedisConfig;
  workerId: string;
  concurrency: number;
  queueConfig: {
    maxRetries: number;
    retryDelay: number;
    priorityLevels: number;
    cleanupInterval: number;
  };
  coordination: {
    heartbeatInterval: number;
    workerTimeout: number;
    resultSyncInterval: number;
  };
}
```

## Best Practices

1. **Resource Management**: Always close browsers and clean up resources after crawling
2. **Rate Limiting**: Use appropriate delays to avoid overwhelming target servers
3. **Error Handling**: Implement proper error handling for network failures and timeouts
4. **Domain Filtering**: Use allowedDomains to prevent crawling unintended sites
5. **Monitoring**: Enable monitoring to track crawl progress and performance
6. **Distributed Setup**: Use Redis clustering for high-availability distributed crawling

## Performance Considerations

- **Concurrency**: Adjust parallelWorkers based on target server capacity
- **Memory Usage**: Monitor memory consumption for large crawls
- **Network**: Consider bandwidth limitations and connection pooling
- **Storage**: Use appropriate storage backends for large result sets

## Error Handling

The crawlers provide comprehensive error reporting:
- Network errors (timeouts, connection failures)
- HTTP errors (4xx, 5xx status codes)
- Parsing errors (malformed HTML, JavaScript errors)
- Configuration errors (invalid URLs, missing parameters)

All errors are logged with context and included in crawl results for analysis.