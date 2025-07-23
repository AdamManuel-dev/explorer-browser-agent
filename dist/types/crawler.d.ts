export interface CrawlNode {
    url: string;
    depth: number;
    parentUrl?: string;
    discoveredAt: Date;
}
export interface CrawlConfiguration {
    startUrl: string;
    maxDepth: number;
    maxPages: number;
    crawlDelay: number;
    allowedDomains: string[];
    respectRobotsTxt: boolean;
    userAgent: string;
    customHeaders?: Record<string, string>;
    parallelWorkers?: number;
}
export interface CrawlResult {
    pagesVisited: number;
    urls: string[];
    errors: CrawlError[];
    duration: number;
    crawlTree: Map<string, CrawlNode[]>;
    crawledUrls?: Map<string, any>;
}
export interface CrawlError {
    url: string;
    error: string;
    timestamp: Date;
}
export interface CrawlOptions {
    startUrl: string;
    maxDepth: number;
    maxPages: number;
    crawlDelay: number;
    allowedDomains: string[];
    respectRobotsTxt: boolean;
    userAgent: string;
    customHeaders?: Record<string, string>;
    parallelWorkers?: number;
}
export interface UrlInfo {
    url: string;
    depth: number;
    parentUrl?: string;
    discoveredAt: Date;
    status?: 'pending' | 'crawling' | 'completed' | 'failed';
    retries?: number;
    lastError?: string;
}
export interface DistributedCrawlConfig {
    startUrl: string;
    maxDepth: number;
    maxPages: number;
    crawlDelay: number;
    allowedDomains: string[];
    respectRobotsTxt: boolean;
    userAgent: string;
    customHeaders?: Record<string, string>;
    parallelWorkers?: number;
    workers?: number;
    queueStrategy?: 'fifo' | 'lifo' | 'priority';
    retryAttempts?: number;
    timeout?: number;
}
export interface ResilientCrawlerOptions {
    startUrl: string;
    maxDepth: number;
    maxPages: number;
    crawlDelay: number;
    delay?: number;
    allowedDomains: string[];
    respectRobotsTxt: boolean;
    respectRobots?: boolean;
    sameDomain?: boolean;
    userAgent: string;
    customHeaders?: Record<string, string>;
    parallelWorkers?: number;
    maxConcurrency?: number;
    retryAttempts?: number;
    backoffStrategy?: 'linear' | 'exponential';
    healthCheck?: boolean;
    circuitBreaker?: boolean;
}
//# sourceMappingURL=crawler.d.ts.map