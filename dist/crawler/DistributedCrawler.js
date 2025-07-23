"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DistributedCrawler = void 0;
const BreadthFirstCrawler_1 = require("./BreadthFirstCrawler");
const logger_1 = require("../utils/logger");
const MockRedisClient_1 = require("./MockRedisClient");
class DistributedCrawler {
    config;
    baseCrawler;
    redis; // In real implementation, use actual Redis client
    isRunning = false;
    heartbeatInterval;
    syncInterval;
    processedUrls = new Set();
    workerStats;
    constructor(browser, config) {
        this.config = config;
        // Create CrawlConfiguration from DistributedCrawlConfig
        const crawlConfig = {
            startUrl: config.startUrl,
            maxDepth: config.maxDepth,
            maxPages: config.maxPages,
            crawlDelay: config.crawlDelay,
            allowedDomains: config.allowedDomains,
            respectRobotsTxt: config.respectRobotsTxt,
            userAgent: config.userAgent,
            customHeaders: config.customHeaders,
            parallelWorkers: config.parallelWorkers,
        };
        this.baseCrawler = new BreadthFirstCrawler_1.BreadthFirstCrawler(crawlConfig);
        this.redis = new MockRedisClient_1.MockRedisClient(config.redis);
        this.workerStats = {
            workerId: config.workerId,
            status: 'idle',
            pagesProcessed: 0,
            startedAt: new Date(),
            lastHeartbeat: new Date(),
            errors: 0,
        };
    }
    async startWorker() {
        logger_1.logger.info('Starting distributed crawler worker', {
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
        logger_1.logger.info('Distributed crawler worker started successfully', {
            workerId: this.config.workerId,
        });
    }
    async stopWorker() {
        logger_1.logger.info('Stopping distributed crawler worker', {
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
        logger_1.logger.info('Distributed crawler worker stopped');
    }
    async enqueueCrawlJob(url, depth = 0, priority = 1, metadata) {
        const job = {
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
        logger_1.logger.debug('Job enqueued', {
            jobId: job.id,
            url,
            depth,
            priority,
        });
        return job.id;
    }
    async getWorkerStatuses() {
        const workerKeys = await this.redis.keys(`${this.config.redis.keyPrefix}:worker:*`);
        const workers = [];
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
    async getQueueStatistics() {
        const stats = {
            totalJobs: 0,
            jobsByPriority: {},
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
        stats.activeWorkers = workers.filter((w) => w.status === 'active').length;
        // Count completed jobs
        const completedKey = `${this.config.redis.keyPrefix}:completed`;
        stats.completedJobs = await this.redis.scard(completedKey);
        return stats;
    }
    async distributedCrawl(startUrl) {
        logger_1.logger.info('Starting distributed crawl', { startUrl, workerId: this.config.workerId });
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
        }
        catch (error) {
            logger_1.logger.error('Distributed crawl failed', error);
            throw error;
        }
    }
    async processJobQueue() {
        logger_1.logger.debug('Starting job queue processing');
        while (this.isRunning) {
            try {
                // Process jobs concurrently
                const processingPromises = [];
                for (let i = 0; i < this.config.concurrency; i++) {
                    processingPromises.push(this.processNextJob());
                }
                await Promise.all(processingPromises);
                // Brief pause to prevent tight loop
                await this.sleep(100);
            }
            catch (error) {
                logger_1.logger.error('Error in job queue processing', error);
                this.workerStats.errors++;
                await this.sleep(1000);
            }
        }
    }
    async processNextJob() {
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
        logger_1.logger.debug('Processing job', {
            jobId: job.id,
            url: job.url,
            depth: job.depth,
        });
        try {
            // Check if URL already processed
            if (await this.isUrlProcessed(job.url)) {
                logger_1.logger.debug('URL already processed, skipping', { url: job.url });
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
                const crawlResultItem = {
                    pageInfo: result.pageInfo,
                    crawledUrls: result.pageInfo ? [result.pageInfo] : [],
                    statistics: {
                        totalPages: 1,
                        totalTime: Date.now() - job.createdAt.getTime(),
                        averageLoadTime: 0,
                        maxDepthReached: job.depth,
                        errorCount: 0,
                    },
                };
                await this.storeResult(job.id, crawlResultItem);
                // Mark job as completed
                await this.markJobCompleted(job);
                this.workerStats.pagesProcessed++;
            }
            else {
                // Handle job failure
                await this.handleJobFailure(job, {
                    url: job.url,
                    error: result.error || 'Unknown error',
                    timestamp: new Date(),
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Job processing error', { jobId: job.id, error });
            await this.handleJobFailure(job, {
                url: job.url,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date(),
            });
            this.workerStats.errors++;
        }
        this.workerStats.currentUrl = undefined;
    }
    async dequeueJob() {
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
    async processSingleUrl(job) {
        try {
            // Update the base crawler's configuration for this specific URL
            // Note: Since BreadthFirstCrawler takes config in constructor,
            // we need to create a new instance for each URL or modify its approach
            const result = await this.baseCrawler.crawl();
            // Extract discovered URLs from the result
            const discoveredUrls = result.urls.filter((url) => !this.processedUrls.has(url)).slice(0, 50); // Limit to prevent queue explosion
            return {
                success: true,
                discoveredUrls,
                pageInfo: {
                    url: job.url,
                    depth: job.depth,
                    parentUrl: job.metadata?.parentUrl,
                    discoveredAt: new Date(),
                    status: 'completed',
                },
            };
        }
        catch (error) {
            return {
                success: false,
                discoveredUrls: [],
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async enqueueDiscoveredUrls(urls, depth) {
        if (depth >= this.config.maxDepth) {
            return;
        }
        const promises = urls.map((url) => this.enqueueCrawlJob(url, depth, this.calculatePriority(url, depth)));
        await Promise.all(promises);
    }
    calculatePriority(url, depth) {
        // Higher priority for shallower depths
        let priority = Math.max(1, this.config.queueConfig.priorityLevels - depth);
        // Boost priority for certain URL patterns
        if (url.includes('/api/') || url.includes('/admin/')) {
            priority = Math.min(this.config.queueConfig.priorityLevels, priority + 1);
        }
        return priority;
    }
    async handleJobFailure(job, error) {
        job.retries++;
        if (job.retries < this.config.queueConfig.maxRetries) {
            // Re-queue with lower priority
            job.priority = Math.max(1, job.priority - 1);
            const queueKey = this.getQueueKey(job.priority);
            await this.redis.lpush(queueKey, JSON.stringify(job));
            logger_1.logger.debug('Job re-queued after failure', {
                jobId: job.id,
                retries: job.retries,
                newPriority: job.priority,
            });
            // Add delay before retry
            await this.sleep(this.config.queueConfig.retryDelay);
        }
        else {
            // Mark as failed
            const failedKey = `${this.config.redis.keyPrefix}:failed`;
            await this.redis.sadd(failedKey, JSON.stringify({
                ...job,
                finalError: typeof error === 'string' ? error : error.error,
                failedAt: new Date(),
            }));
            logger_1.logger.warn('Job failed permanently', {
                jobId: job.id,
                retries: job.retries,
                error,
            });
        }
    }
    async registerWorker() {
        const workerKey = `${this.config.redis.keyPrefix}:worker:${this.config.workerId}`;
        await this.redis.setex(workerKey, this.config.coordination.workerTimeout, JSON.stringify(this.workerStats));
    }
    async unregisterWorker() {
        const workerKey = `${this.config.redis.keyPrefix}:worker:${this.config.workerId}`;
        await this.redis.del(workerKey);
    }
    startHeartbeat() {
        this.heartbeatInterval = setInterval(async () => {
            try {
                this.workerStats.lastHeartbeat = new Date();
                await this.registerWorker();
            }
            catch (error) {
                logger_1.logger.error('Heartbeat failed', error);
            }
        }, this.config.coordination.heartbeatInterval);
    }
    startResultSync() {
        this.syncInterval = setInterval(async () => {
            try {
                await this.syncResults();
            }
            catch (error) {
                logger_1.logger.error('Result sync failed', error);
            }
        }, this.config.coordination.resultSyncInterval);
    }
    async syncResults() {
        // Placeholder for result synchronization
        logger_1.logger.debug('Syncing results');
    }
    async isUrlProcessed(url) {
        const processedKey = `${this.config.redis.keyPrefix}:processed`;
        return this.redis.sismember(processedKey, url);
    }
    async markUrlProcessed(url) {
        const processedKey = `${this.config.redis.keyPrefix}:processed`;
        await this.redis.sadd(processedKey, url);
        this.processedUrls.add(url);
    }
    async markJobCompleted(job) {
        const completedKey = `${this.config.redis.keyPrefix}:completed`;
        await this.redis.sadd(completedKey, job.id);
    }
    async storeResult(jobId, result) {
        const resultKey = `${this.config.redis.keyPrefix}:result:${jobId}`;
        await this.redis.setex(resultKey, 3600, JSON.stringify(result)); // Store for 1 hour
    }
    async waitForCrawlCompletion() {
        // Wait until all queues are empty and no workers are active
        while (this.isRunning) {
            const stats = await this.getQueueStatistics();
            if (stats.totalJobs === 0) {
                const workers = await this.getWorkerStatuses();
                const activeWorkers = workers.filter((w) => w.status === 'active');
                if (activeWorkers.length === 0) {
                    logger_1.logger.info('Distributed crawl completed');
                    break;
                }
            }
            await this.sleep(5000);
        }
    }
    async collectDistributedResults() {
        const resultKeys = await this.redis.keys(`${this.config.redis.keyPrefix}:result:*`);
        const results = [];
        for (const key of resultKeys) {
            const resultData = await this.redis.get(key);
            if (resultData) {
                results.push(JSON.parse(resultData));
            }
        }
        return results;
    }
    aggregateResults(results) {
        // Aggregate all worker results into a single result
        const allUrls = [];
        const allErrors = [];
        const crawlTree = new Map();
        let totalTime = 0;
        results.forEach((result) => {
            if (result.pageInfo) {
                allUrls.push(result.pageInfo.url);
            }
            if (result.crawledUrls) {
                result.crawledUrls.forEach((urlInfo) => {
                    allUrls.push(urlInfo.url);
                });
            }
            if (result.error) {
                allErrors.push(result.error);
            }
            if (result.errors) {
                allErrors.push(...result.errors);
            }
            if (result.statistics) {
                totalTime += result.statistics.totalTime;
            }
        });
        return {
            pagesVisited: allUrls.length,
            urls: Array.from(new Set(allUrls)), // Remove duplicates
            errors: allErrors,
            duration: totalTime,
            crawlTree,
        };
    }
    getQueueKey(priority) {
        return `${this.config.redis.keyPrefix}:queue:${priority}`;
    }
    generateJobId() {
        return `job_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.DistributedCrawler = DistributedCrawler;
//# sourceMappingURL=DistributedCrawler.js.map