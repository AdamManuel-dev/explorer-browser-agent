import { Page } from 'playwright';
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
export declare class BreadthFirstCrawler {
    private config;
    private queue;
    private visited;
    private robotsCache;
    private crawlResult;
    private pQueue;
    private startTime;
    constructor(config: CrawlConfiguration);
    crawl(): Promise<CrawlResult>;
    private getNodesAtCurrentDepth;
    private processNodesInParallel;
    private processNode;
    private crawlPage;
    private normalizeUrl;
    private canCrawl;
    private isAllowedDomain;
    extractUrls(page: Page, _baseUrl: string): Promise<string[]>;
    private isValidUrl;
}
//# sourceMappingURL=BreadthFirstCrawler.d.ts.map