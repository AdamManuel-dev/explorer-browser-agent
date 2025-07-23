import { Browser } from 'playwright';
import { CrawlOptions } from './BreadthFirstCrawler';
import { CrawlResult, RedisConfig } from '../types/crawler';
export interface DistributedCrawlConfig extends CrawlOptions {
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
export interface WorkerStatus {
    workerId: string;
    status: 'active' | 'idle' | 'error' | 'stopping';
    currentUrl?: string;
    pagesProcessed: number;
    startedAt: Date;
    lastHeartbeat: Date;
    errors: number;
}
export interface CrawlJob {
    id: string;
    url: string;
    depth: number;
    priority: number;
    retries: number;
    createdAt: Date;
    assignedTo?: string;
    metadata?: Record<string, unknown>;
}
export interface DistributedCrawlResult extends CrawlResult {
    workerId: string;
    coordinationMetrics: {
        totalWorkers: number;
        jobsProcessed: number;
        jobsQueued: number;
        totalRedisOperations: number;
    };
}
export declare class DistributedCrawler {
    private config;
    private baseCrawler;
    private redis;
    private isRunning;
    private heartbeatInterval?;
    private syncInterval?;
    private processedUrls;
    private workerStats;
    constructor(browser: Browser, config: DistributedCrawlConfig);
    startWorker(): Promise<void>;
    stopWorker(): Promise<void>;
    enqueueCrawlJob(url: string, depth?: number, priority?: number, metadata?: Record<string, unknown>): Promise<string>;
    getWorkerStatuses(): Promise<WorkerStatus[]>;
    getQueueStatistics(): Promise<{
        totalJobs: number;
        jobsByPriority: Record<number, number>;
        activeWorkers: number;
        completedJobs: number;
    }>;
    distributedCrawl(startUrl: string): Promise<DistributedCrawlResult>;
    private processJobQueue;
    private processNextJob;
    private dequeueJob;
    private processSingleUrl;
    private enqueueDiscoveredUrls;
    private calculatePriority;
    private handleJobFailure;
    private registerWorker;
    private unregisterWorker;
    private startHeartbeat;
    private startResultSync;
    private syncResults;
    private isUrlProcessed;
    private markUrlProcessed;
    private markJobCompleted;
    private storeResult;
    private waitForCrawlCompletion;
    private collectDistributedResults;
    private aggregateResults;
    private getQueueKey;
    private generateJobId;
    private sleep;
}
//# sourceMappingURL=DistributedCrawler.d.ts.map