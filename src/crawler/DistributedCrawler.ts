import { Browser } from 'playwright';
import { BreadthFirstCrawler, CrawlOptions } from './BreadthFirstCrawler';
import { CrawlResult, UrlInfo } from '../types/crawler';
import { logger } from '../utils/logger';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

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
  metadata?: Record<string, any>;
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

export class DistributedCrawler {
  private config: DistributedCrawlConfig;
  private baseCrawler: BreadthFirstCrawler;
  private redis: MockRedisClient; // In real implementation, use actual Redis client
  private isRunning = false;
  private heartbeatInterval?: NodeJS.Timeout;
  private syncInterval?: NodeJS.Timeout;
  private processedUrls = new Set<string>();
  private workerStats: WorkerStatus;

  constructor(browser: Browser, config: DistributedCrawlConfig) {
    this.config = config;
    this.baseCrawler = new BreadthFirstCrawler(browser);
    this.redis = new MockRedisClient(config.redis);
    
    this.workerStats = {
      workerId: config.workerId,
      status: 'idle',
      pagesProcessed: 0,
      startedAt: new Date(),
      lastHeartbeat: new Date(),
      errors: 0,
    };
  }

  async startWorker(): Promise<void> {
    logger.info('Starting distributed crawler worker', { 
      workerId: this.config.workerId,
      concurrency: this.config.concurrency,
    });

    this.isRunning = true;
    this.workerStats.status = 'active';

    // Initialize Redis connection
    await this.redis.connect();

    // Register worker
    await this.registerWorker();

    // Start heartbeat
    this.startHeartbeat();

    // Start result synchronization
    this.startResultSync();

    // Start processing jobs
    await this.processJobQueue();

    logger.info('Distributed crawler worker started successfully', {
      workerId: this.config.workerId,
    });
  }

  async stopWorker(): Promise<void> {
    logger.info('Stopping distributed crawler worker', {
      workerId: this.config.workerId,
    });

    this.isRunning = false;
    this.workerStats.status = 'stopping';

    // Stop intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Unregister worker
    await this.unregisterWorker();

    // Close Redis connection
    await this.redis.disconnect();

    logger.info('Distributed crawler worker stopped');
  }

  async enqueueCrawlJob(
    url: string,
    depth: number = 0,
    priority: number = 1,
    metadata?: Record<string, any>
  ): Promise<string> {
    const job: CrawlJob = {
      id: this.generateJobId(),
      url,
      depth,
      priority,
      retries: 0,
      createdAt: new Date(),
      metadata,
    };

    const queueKey = this.getQueueKey(priority);
    await this.redis.lpush(queueKey, JSON.stringify(job));

    logger.debug('Job enqueued', { 
      jobId: job.id, 
      url, 
      depth, 
      priority 
    });

    return job.id;
  }

  async getWorkerStatuses(): Promise<WorkerStatus[]> {
    const workerKeys = await this.redis.keys(`${this.config.redis.keyPrefix}:worker:*`);
    const workers: WorkerStatus[] = [];

    for (const key of workerKeys) {
      const workerData = await this.redis.get(key);
      if (workerData) {
        const worker = JSON.parse(workerData);
        worker.startedAt = new Date(worker.startedAt);
        worker.lastHeartbeat = new Date(worker.lastHeartbeat);
        workers.push(worker);
      }
    }

    return workers;
  }

  async getQueueStatistics(): Promise<{
    totalJobs: number;
    jobsByPriority: Record<number, number>;
    activeWorkers: number;
    completedJobs: number;
  }> {
    const stats = {
      totalJobs: 0,
      jobsByPriority: {} as Record<number, number>,
      activeWorkers: 0,
      completedJobs: 0,
    };

    // Count jobs by priority
    for (let priority = 1; priority <= this.config.queueConfig.priorityLevels; priority++) {
      const queueKey = this.getQueueKey(priority);
      const jobCount = await this.redis.llen(queueKey);
      stats.jobsByPriority[priority] = jobCount;
      stats.totalJobs += jobCount;
    }

    // Count active workers
    const workers = await this.getWorkerStatuses();
    stats.activeWorkers = workers.filter(w => w.status === 'active').length;

    // Count completed jobs
    const completedKey = `${this.config.redis.keyPrefix}:completed`;
    stats.completedJobs = await this.redis.scard(completedKey);

    return stats;
  }

  async distributedCrawl(startUrl: string): Promise<DistributedCrawlResult> {
    logger.info('Starting distributed crawl', { startUrl, workerId: this.config.workerId });

    const startTime = Date.now();
    let redisOperations = 0;

    try {
      // Enqueue initial job
      await this.enqueueCrawlJob(startUrl, 0, 1);
      redisOperations++;

      // Wait for crawl completion or timeout
      await this.waitForCrawlCompletion();

      // Collect results from all workers
      const results = await this.collectDistributedResults();
      redisOperations += results.length;

      const totalTime = Date.now() - startTime;
      const queueStats = await this.getQueueStatistics();
      redisOperations += 4; // For queue statistics calls

      return {
        ...this.aggregateResults(results),
        workerId: this.config.workerId,
        coordinationMetrics: {
          totalWorkers: queueStats.activeWorkers,
          jobsProcessed: this.workerStats.pagesProcessed,
          jobsQueued: queueStats.totalJobs,
          totalRedisOperations: redisOperations,
        },
      };

    } catch (error) {
      logger.error('Distributed crawl failed', error);
      throw error;
    }
  }

  private async processJobQueue(): Promise<void> {
    logger.debug('Starting job queue processing');

    while (this.isRunning) {
      try {
        // Process jobs concurrently
        const processingPromises: Promise<void>[] = [];
        
        for (let i = 0; i < this.config.concurrency; i++) {
          processingPromises.push(this.processNextJob());
        }

        await Promise.all(processingPromises);

        // Brief pause to prevent tight loop
        await this.sleep(100);

      } catch (error) {
        logger.error('Error in job queue processing', error);
        this.workerStats.errors++;
        await this.sleep(1000);
      }
    }
  }

  private async processNextJob(): Promise<void> {
    // Get next job from highest priority queue
    const job = await this.dequeueJob();
    
    if (!job) {
      // No jobs available, worker is idle
      this.workerStats.status = 'idle';
      await this.sleep(1000);
      return;
    }

    this.workerStats.status = 'active';
    this.workerStats.currentUrl = job.url;

    logger.debug('Processing job', { 
      jobId: job.id, 
      url: job.url, 
      depth: job.depth 
    });

    try {
      // Check if URL already processed
      if (await this.isUrlProcessed(job.url)) {
        logger.debug('URL already processed, skipping', { url: job.url });
        await this.markJobCompleted(job);
        return;
      }

      // Process the URL
      const result = await this.processSingleUrl(job);

      if (result.success) {
        // Mark URL as processed
        await this.markUrlProcessed(job.url);
        
        // Enqueue discovered URLs
        await this.enqueueDiscoveredUrls(result.discoveredUrls, job.depth + 1);
        
        // Store results
        await this.storeResult(job.id, result);
        
        // Mark job as completed
        await this.markJobCompleted(job);
        
        this.workerStats.pagesProcessed++;
        
      } else {
        // Handle job failure
        await this.handleJobFailure(job, result.error);
      }

    } catch (error) {
      logger.error('Job processing error', { jobId: job.id, error });
      await this.handleJobFailure(job, error instanceof Error ? error.message : String(error));
      this.workerStats.errors++;
    }

    this.workerStats.currentUrl = undefined;
  }

  private async dequeueJob(): Promise<CrawlJob | null> {
    // Try queues in priority order (highest to lowest)
    for (let priority = this.config.queueConfig.priorityLevels; priority >= 1; priority--) {
      const queueKey = this.getQueueKey(priority);
      const jobData = await this.redis.rpop(queueKey);
      
      if (jobData) {
        const job = JSON.parse(jobData);
        job.createdAt = new Date(job.createdAt);
        job.assignedTo = this.config.workerId;
        
        return job;
      }
    }

    return null;
  }

  private async processSingleUrl(job: CrawlJob): Promise<{
    success: boolean;
    discoveredUrls: string[];
    error?: string;
    pageInfo?: UrlInfo;
  }> {
    try {
      // Use base crawler to process single URL
      const options: CrawlOptions = {
        ...this.config,
        startUrl: job.url,
        maxDepth: 0, // Only process this specific URL
        maxPages: 1,
      };

      const result = await this.baseCrawler.crawl(options);
      
      // Extract discovered URLs from the result
      const discoveredUrls = result.crawledUrls
        .flatMap(urlInfo => urlInfo.links || [])
        .filter(url => !this.processedUrls.has(url))
        .slice(0, 50); // Limit to prevent queue explosion

      return {
        success: true,
        discoveredUrls,
        pageInfo: result.crawledUrls[0],
      };

    } catch (error) {
      return {
        success: false,
        discoveredUrls: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async enqueueDiscoveredUrls(urls: string[], depth: number): Promise<void> {
    if (depth >= this.config.maxDepth) {
      return;
    }

    const promises = urls.map(url => 
      this.enqueueCrawlJob(url, depth, this.calculatePriority(url, depth))
    );

    await Promise.all(promises);
  }

  private calculatePriority(url: string, depth: number): number {
    // Higher priority for shallower depths
    let priority = Math.max(1, this.config.queueConfig.priorityLevels - depth);
    
    // Boost priority for certain URL patterns
    if (url.includes('/api/') || url.includes('/admin/')) {
      priority = Math.min(this.config.queueConfig.priorityLevels, priority + 1);
    }

    return priority;
  }

  private async handleJobFailure(job: CrawlJob, error: string): Promise<void> {
    job.retries++;

    if (job.retries < this.config.queueConfig.maxRetries) {
      // Re-queue with lower priority
      job.priority = Math.max(1, job.priority - 1);
      
      const queueKey = this.getQueueKey(job.priority);
      await this.redis.lpush(queueKey, JSON.stringify(job));
      
      logger.debug('Job re-queued after failure', { 
        jobId: job.id, 
        retries: job.retries,
        newPriority: job.priority,
      });

      // Add delay before retry
      await this.sleep(this.config.queueConfig.retryDelay);
      
    } else {
      // Mark as failed
      const failedKey = `${this.config.redis.keyPrefix}:failed`;
      await this.redis.sadd(failedKey, JSON.stringify({
        ...job,
        finalError: error,
        failedAt: new Date(),
      }));
      
      logger.warn('Job failed permanently', { 
        jobId: job.id, 
        retries: job.retries,
        error,
      });
    }
  }

  private async registerWorker(): Promise<void> {
    const workerKey = `${this.config.redis.keyPrefix}:worker:${this.config.workerId}`;
    await this.redis.setex(
      workerKey,
      this.config.coordination.workerTimeout,
      JSON.stringify(this.workerStats)
    );
  }

  private async unregisterWorker(): Promise<void> {
    const workerKey = `${this.config.redis.keyPrefix}:worker:${this.config.workerId}`;
    await this.redis.del(workerKey);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        this.workerStats.lastHeartbeat = new Date();
        await this.registerWorker();
      } catch (error) {
        logger.error('Heartbeat failed', error);
      }
    }, this.config.coordination.heartbeatInterval);
  }

  private startResultSync(): void {
    this.syncInterval = setInterval(async () => {
      try {
        await this.syncResults();
      } catch (error) {
        logger.error('Result sync failed', error);
      }
    }, this.config.coordination.resultSyncInterval);
  }

  private async syncResults(): Promise<void> {
    // Placeholder for result synchronization
    logger.debug('Syncing results');
  }

  private async isUrlProcessed(url: string): Promise<boolean> {
    const processedKey = `${this.config.redis.keyPrefix}:processed`;
    return await this.redis.sismember(processedKey, url);
  }

  private async markUrlProcessed(url: string): Promise<void> {
    const processedKey = `${this.config.redis.keyPrefix}:processed`;
    await this.redis.sadd(processedKey, url);
    this.processedUrls.add(url);
  }

  private async markJobCompleted(job: CrawlJob): Promise<void> {
    const completedKey = `${this.config.redis.keyPrefix}:completed`;
    await this.redis.sadd(completedKey, job.id);
  }

  private async storeResult(jobId: string, result: any): Promise<void> {
    const resultKey = `${this.config.redis.keyPrefix}:result:${jobId}`;
    await this.redis.setex(resultKey, 3600, JSON.stringify(result)); // Store for 1 hour
  }

  private async waitForCrawlCompletion(): Promise<void> {
    // Wait until all queues are empty and no workers are active
    while (this.isRunning) {
      const stats = await this.getQueueStatistics();
      
      if (stats.totalJobs === 0) {
        const workers = await this.getWorkerStatuses();
        const activeWorkers = workers.filter(w => w.status === 'active');
        
        if (activeWorkers.length === 0) {
          logger.info('Distributed crawl completed');
          break;
        }
      }

      await this.sleep(5000);
    }
  }

  private async collectDistributedResults(): Promise<any[]> {
    const resultKeys = await this.redis.keys(`${this.config.redis.keyPrefix}:result:*`);
    const results: any[] = [];

    for (const key of resultKeys) {
      const resultData = await this.redis.get(key);
      if (resultData) {
        results.push(JSON.parse(resultData));
      }
    }

    return results;
  }

  private aggregateResults(results: any[]): CrawlResult {
    // Aggregate all worker results into a single result
    const aggregated: CrawlResult = {
      crawledUrls: [],
      errors: [],
      statistics: {
        totalPages: 0,
        totalTime: 0,
        averageLoadTime: 0,
        maxDepthReached: 0,
        errorCount: 0,
      },
    };

    results.forEach(result => {
      if (result.pageInfo) {
        aggregated.crawledUrls.push(result.pageInfo);
      }
      if (result.error) {
        aggregated.errors.push(result.error);
      }
    });

    aggregated.statistics.totalPages = aggregated.crawledUrls.length;
    aggregated.statistics.errorCount = aggregated.errors.length;

    return aggregated;
  }

  private getQueueKey(priority: number): string {
    return `${this.config.redis.keyPrefix}:queue:${priority}`;
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Mock Redis client for demonstration (would use actual Redis client in production)
class MockRedisClient {
  private store = new Map<string, any>();
  private lists = new Map<string, any[]>();
  private sets = new Map<string, Set<any>>();

  constructor(private config: RedisConfig) {}

  async connect(): Promise<void> {
    logger.debug('Mock Redis connected');
  }

  async disconnect(): Promise<void> {
    logger.debug('Mock Redis disconnected');
  }

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    this.store.set(key, value);
    // In real implementation, would set expiration
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
    this.lists.delete(key);
    this.sets.delete(key);
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.store.keys()).filter(key => regex.test(key));
  }

  async lpush(key: string, value: string): Promise<void> {
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }
    this.lists.get(key)!.unshift(value);
  }

  async rpop(key: string): Promise<string | null> {
    const list = this.lists.get(key);
    return list && list.length > 0 ? list.pop() || null : null;
  }

  async llen(key: string): Promise<number> {
    const list = this.lists.get(key);
    return list ? list.length : 0;
  }

  async sadd(key: string, value: string): Promise<void> {
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set());
    }
    this.sets.get(key)!.add(value);
  }

  async sismember(key: string, value: string): Promise<boolean> {
    const set = this.sets.get(key);
    return set ? set.has(value) : false;
  }

  async scard(key: string): Promise<number> {
    const set = this.sets.get(key);
    return set ? set.size : 0;
  }
}