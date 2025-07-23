"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourceManager = void 0;
const playwright_1 = require("playwright");
const events_1 = require("events");
const logger_1 = require("./logger");
class ResourceManager extends events_1.EventEmitter {
    config;
    browserPools = new Map();
    allocatedResources = new Map();
    monitoringInterval;
    cleanupInterval;
    startTime = Date.now();
    isShuttingDown = false;
    constructor(config) {
        super();
        this.config = this.mergeWithDefaults(config || {});
        this.startMonitoring();
        this.startCleanup();
    }
    async allocateResources() {
        if (this.isShuttingDown) {
            throw new Error('ResourceManager is shutting down');
        }
        logger_1.logger.debug('Allocating resources');
        try {
            // Check if we need to create a new browser
            let browserItem = this.findAvailableBrowser();
            if (!browserItem) {
                browserItem = await this.createBrowser();
            }
            // Check if we need to create a new context
            let contextItem = this.findAvailableContext(browserItem);
            if (!contextItem) {
                contextItem = await this.createContext(browserItem);
            }
            // Check if we need to create a new page
            let pageItem = this.findAvailablePage(contextItem);
            if (!pageItem) {
                pageItem = await this.createPage(contextItem);
            }
            // Mark resources as in use
            browserItem.isIdle = false;
            browserItem.lastUsed = new Date();
            contextItem.isIdle = false;
            contextItem.lastUsed = new Date();
            pageItem.isIdle = false;
            pageItem.lastUsed = new Date();
            const allocation = {
                browserId: browserItem.id,
                contextId: contextItem.id,
                pageId: pageItem.id,
                browser: browserItem.browser,
                context: contextItem.context,
                page: pageItem.page,
                allocatedAt: new Date(),
            };
            const allocationId = this.generateId();
            this.allocatedResources.set(allocationId, allocation);
            logger_1.logger.debug('Resources allocated', {
                allocationId,
                browserId: browserItem.id,
                contextId: contextItem.id,
                pageId: pageItem.id,
            });
            this.emit('resourceAllocated', allocation);
            return allocation;
        }
        catch (error) {
            logger_1.logger.error('Failed to allocate resources', error);
            throw error;
        }
    }
    async releaseResources(allocationId) {
        const allocation = this.allocatedResources.get(allocationId);
        if (!allocation) {
            logger_1.logger.warn('Attempted to release unknown allocation', { allocationId });
            return;
        }
        logger_1.logger.debug('Releasing resources', { allocationId });
        try {
            // Mark resources as idle
            const browserItem = this.browserPools.get(allocation.browserId);
            if (browserItem) {
                const contextItem = browserItem.contexts.find((c) => c.id === allocation.contextId);
                if (contextItem) {
                    const pageItem = contextItem.pages.find((p) => p.id === allocation.pageId);
                    if (pageItem) {
                        pageItem.isIdle = true;
                        pageItem.lastUsed = new Date();
                    }
                    // Check if all pages in context are idle
                    if (contextItem.pages.every((p) => p.isIdle)) {
                        contextItem.isIdle = true;
                        contextItem.lastUsed = new Date();
                    }
                }
                // Check if all contexts in browser are idle
                if (browserItem.contexts.every((c) => c.isIdle)) {
                    browserItem.isIdle = true;
                    browserItem.lastUsed = new Date();
                }
            }
            this.allocatedResources.delete(allocationId);
            this.emit('resourceReleased', allocation);
        }
        catch (error) {
            logger_1.logger.error('Error releasing resources', { allocationId, error });
        }
    }
    async getResourceMetrics() {
        const browsers = Array.from(this.browserPools.values());
        const contexts = browsers.flatMap((b) => b.contexts);
        const pages = contexts.flatMap((c) => c.pages);
        // Calculate memory usage
        const memoryUsage = await this.getMemoryUsage();
        const memoryInfo = {
            used: memoryUsage.used,
            available: memoryUsage.total - memoryUsage.used,
            percentage: (memoryUsage.used / memoryUsage.total) * 100,
        };
        // Calculate CPU usage
        const cpuUsage = await this.getCpuUsage();
        return {
            browsers: {
                total: browsers.length,
                active: browsers.filter((b) => !b.isIdle).length,
                idle: browsers.filter((b) => b.isIdle).length,
                byType: browsers.reduce((acc, b) => {
                    acc[b.type] = (acc[b.type] || 0) + 1;
                    return acc;
                }, {}),
            },
            contexts: {
                total: contexts.length,
                active: contexts.filter((c) => !c.isIdle).length,
                idle: contexts.filter((c) => c.isIdle).length,
            },
            pages: {
                total: pages.length,
                active: pages.filter((p) => !p.isIdle).length,
                idle: pages.filter((p) => p.isIdle).length,
            },
            memory: memoryInfo,
            cpu: {
                usage: cpuUsage,
            },
            uptime: Date.now() - this.startTime,
        };
    }
    async cleanup(force = false) {
        logger_1.logger.debug('Starting resource cleanup', { force });
        const now = Date.now();
        let cleaned = 0;
        for (const [browserId, browserItem] of this.browserPools.entries()) {
            const browserAge = now - browserItem.lastUsed.getTime();
            const shouldCleanupBrowser = force ||
                (browserItem.isIdle && browserAge > this.config.cleanup.idleTimeout) ||
                browserAge > this.config.cleanup.forceCleanupAfter;
            if (shouldCleanupBrowser) {
                await this.destroyBrowser(browserId);
                cleaned++;
                continue;
            }
            // Cleanup contexts
            for (let i = browserItem.contexts.length - 1; i >= 0; i--) {
                const contextItem = browserItem.contexts[i];
                if (!contextItem)
                    continue;
                const contextAge = now - contextItem.lastUsed.getTime();
                const shouldCleanupContext = force ||
                    (contextItem.isIdle && contextAge > this.config.cleanup.idleTimeout) ||
                    contextAge > this.config.cleanup.forceCleanupAfter;
                if (shouldCleanupContext) {
                    await this.destroyContext(browserItem, contextItem.id);
                    continue;
                }
                // Cleanup pages
                for (let j = contextItem.pages.length - 1; j >= 0; j--) {
                    const pageItem = contextItem.pages[j];
                    if (!pageItem)
                        continue;
                    const pageAge = now - pageItem.lastUsed.getTime();
                    const shouldCleanupPage = force ||
                        (pageItem.isIdle && pageAge > this.config.cleanup.idleTimeout) ||
                        pageAge > this.config.cleanup.forceCleanupAfter;
                    if (shouldCleanupPage) {
                        await this.destroyPage(contextItem, pageItem.id);
                    }
                }
            }
        }
        if (cleaned > 0) {
            logger_1.logger.info('Resource cleanup completed', { cleanedBrowsers: cleaned });
        }
        // Trigger garbage collection if memory usage is high
        const memoryUsage = await this.getMemoryUsage();
        if (memoryUsage.used > this.config.memory.gcThreshold) {
            if (global.gc) {
                global.gc();
                logger_1.logger.debug('Triggered garbage collection');
            }
        }
    }
    async shutdown() {
        logger_1.logger.info('Shutting down ResourceManager');
        this.isShuttingDown = true;
        // Stop monitoring
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        // Force cleanup all resources
        await this.cleanup(true);
        this.emit('shutdown');
        logger_1.logger.info('ResourceManager shutdown complete');
    }
    findAvailableBrowser() {
        for (const browserItem of this.browserPools.values()) {
            if (browserItem.isIdle &&
                browserItem.contexts.length < this.config.browserPool.maxContextsPerBrowser) {
                return browserItem;
            }
        }
        return null;
    }
    findAvailableContext(browserItem) {
        for (const contextItem of browserItem.contexts) {
            if (contextItem.isIdle &&
                contextItem.pages.length < this.config.browserPool.maxPagesPerContext) {
                return contextItem;
            }
        }
        return null;
    }
    findAvailablePage(contextItem) {
        return contextItem.pages.find((p) => p.isIdle) || null;
    }
    async createBrowser() {
        if (this.browserPools.size >= this.config.browserPool.maxBrowsers) {
            throw new Error('Maximum browser pool size reached');
        }
        // Select browser type (round-robin or random)
        const { browserTypes } = this.config.browserPool;
        const browserType = browserTypes[this.browserPools.size % browserTypes.length];
        logger_1.logger.debug('Creating new browser', { type: browserType });
        let browser;
        switch (browserType) {
            case 'chromium':
                browser = await playwright_1.chromium.launch(this.config.browserPool.launchOptions);
                break;
            case 'firefox':
                browser = await playwright_1.firefox.launch(this.config.browserPool.launchOptions);
                break;
            case 'webkit':
                browser = await playwright_1.webkit.launch(this.config.browserPool.launchOptions);
                break;
            default:
                throw new Error(`Unsupported browser type: ${browserType}`);
        }
        const browserItem = {
            id: this.generateId(),
            browser,
            type: browserType,
            contexts: [],
            createdAt: new Date(),
            lastUsed: new Date(),
            isIdle: true,
        };
        this.browserPools.set(browserItem.id, browserItem);
        // Set up browser event handlers
        browser.on('disconnected', () => {
            logger_1.logger.warn('Browser disconnected', { browserId: browserItem.id });
            this.browserPools.delete(browserItem.id);
        });
        logger_1.logger.info('Browser created', {
            browserId: browserItem.id,
            type: browserType,
            totalBrowsers: this.browserPools.size,
        });
        this.emit('browserCreated', browserItem);
        return browserItem;
    }
    async createContext(browserItem) {
        if (browserItem.contexts.length >= this.config.browserPool.maxContextsPerBrowser) {
            throw new Error('Maximum contexts per browser reached');
        }
        logger_1.logger.debug('Creating new context', { browserId: browserItem.id });
        const context = await browserItem.browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: 'BrowserExplorer/1.0',
        });
        const contextItem = {
            id: this.generateId(),
            context,
            pages: [],
            createdAt: new Date(),
            lastUsed: new Date(),
            isIdle: true,
        };
        browserItem.contexts.push(contextItem);
        logger_1.logger.debug('Context created', {
            contextId: contextItem.id,
            browserId: browserItem.id,
        });
        this.emit('contextCreated', contextItem);
        return contextItem;
    }
    async createPage(contextItem) {
        if (contextItem.pages.length >= this.config.browserPool.maxPagesPerContext) {
            throw new Error('Maximum pages per context reached');
        }
        logger_1.logger.debug('Creating new page', { contextId: contextItem.id });
        const page = await contextItem.context.newPage();
        const pageItem = {
            id: this.generateId(),
            page,
            createdAt: new Date(),
            lastUsed: new Date(),
            isIdle: true,
            currentUrl: 'about:blank',
        };
        contextItem.pages.push(pageItem);
        // Set up page event handlers
        page.on('load', () => {
            pageItem.currentUrl = page.url();
        });
        logger_1.logger.debug('Page created', {
            pageId: pageItem.id,
            contextId: contextItem.id,
        });
        this.emit('pageCreated', pageItem);
        return pageItem;
    }
    async destroyBrowser(browserId) {
        const browserItem = this.browserPools.get(browserId);
        if (!browserItem)
            return;
        logger_1.logger.debug('Destroying browser', { browserId });
        try {
            await browserItem.browser.close();
            this.browserPools.delete(browserId);
            logger_1.logger.info('Browser destroyed', { browserId });
            this.emit('browserDestroyed', { browserId });
        }
        catch (error) {
            logger_1.logger.error('Error destroying browser', { browserId, error });
        }
    }
    async destroyContext(browserItem, contextId) {
        const contextIndex = browserItem.contexts.findIndex((c) => c.id === contextId);
        if (contextIndex === -1)
            return;
        const contextItem = browserItem.contexts[contextIndex];
        if (!contextItem)
            return;
        logger_1.logger.debug('Destroying context', { contextId });
        try {
            await contextItem.context.close();
            browserItem.contexts.splice(contextIndex, 1);
            logger_1.logger.debug('Context destroyed', { contextId });
            this.emit('contextDestroyed', { contextId });
        }
        catch (error) {
            logger_1.logger.error('Error destroying context', { contextId, error });
        }
    }
    async destroyPage(contextItem, pageId) {
        const pageIndex = contextItem.pages.findIndex((p) => p.id === pageId);
        if (pageIndex === -1)
            return;
        const pageItem = contextItem.pages[pageIndex];
        if (!pageItem)
            return;
        logger_1.logger.debug('Destroying page', { pageId });
        try {
            await pageItem.page.close();
            contextItem.pages.splice(pageIndex, 1);
            logger_1.logger.debug('Page destroyed', { pageId });
            this.emit('pageDestroyed', { pageId });
        }
        catch (error) {
            logger_1.logger.error('Error destroying page', { pageId, error });
        }
    }
    async getMemoryUsage() {
        const usage = process.memoryUsage();
        return {
            used: Math.round(usage.heapUsed / 1024 / 1024), // MB
            total: Math.round(usage.heapTotal / 1024 / 1024), // MB
        };
    }
    async getCpuUsage() {
        // Simple CPU usage calculation (placeholder)
        // In a real implementation, you might use a library like 'pidusage'
        return Math.random() * 100; // Mock value
    }
    startMonitoring() {
        if (!this.config.monitoring.enabled)
            return;
        this.monitoringInterval = setInterval(async () => {
            try {
                const metrics = await this.getResourceMetrics();
                // Check alert thresholds
                if (metrics.memory.used > this.config.monitoring.alertThresholds.memoryUsage) {
                    this.emit('memoryAlert', metrics.memory);
                }
                if (metrics.cpu.usage > this.config.monitoring.alertThresholds.cpuUsage) {
                    this.emit('cpuAlert', metrics.cpu);
                }
                if (metrics.pages.active > this.config.monitoring.alertThresholds.activePages) {
                    this.emit('pageAlert', metrics.pages);
                }
                this.emit('metrics', metrics);
            }
            catch (error) {
                logger_1.logger.error('Error collecting metrics', error);
            }
        }, this.config.monitoring.metricsInterval);
    }
    startCleanup() {
        this.cleanupInterval = setInterval(async () => {
            try {
                await this.cleanup();
            }
            catch (error) {
                logger_1.logger.error('Error during scheduled cleanup', error);
            }
        }, this.config.cleanup.cleanupInterval);
    }
    generateId() {
        return Math.random().toString(36).substring(2, 15);
    }
    mergeWithDefaults(config) {
        return {
            browserPool: {
                maxBrowsers: 5,
                maxContextsPerBrowser: 10,
                maxPagesPerContext: 5,
                browserTypes: ['chromium'],
                launchOptions: {
                    headless: true,
                    devtools: false,
                    args: ['--no-sandbox', '--disable-setuid-sandbox'],
                },
                ...config.browserPool,
            },
            memory: {
                maxMemoryUsage: 2048, // 2GB
                gcThreshold: 1024, // 1GB
                monitoringInterval: 10000, // 10 seconds
                ...config.memory,
            },
            cleanup: {
                idleTimeout: 300000, // 5 minutes
                cleanupInterval: 60000, // 1 minute
                forceCleanupAfter: 1800000, // 30 minutes
                ...config.cleanup,
            },
            monitoring: {
                enabled: true,
                metricsInterval: 30000, // 30 seconds
                alertThresholds: {
                    memoryUsage: 1536, // 1.5GB
                    cpuUsage: 80, // 80%
                    activePages: 50,
                },
                ...config.monitoring,
            },
        };
    }
}
exports.ResourceManager = ResourceManager;
//# sourceMappingURL=ResourceManager.js.map