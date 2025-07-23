import { Browser, BrowserContext, Page } from 'playwright';
import { EventEmitter } from 'events';
export interface ResourceManagerConfig {
    browserPool: {
        maxBrowsers: number;
        maxContextsPerBrowser: number;
        maxPagesPerContext: number;
        browserTypes: ('chromium' | 'firefox' | 'webkit')[];
        launchOptions: {
            headless: boolean;
            devtools: boolean;
            args: string[];
        };
    };
    memory: {
        maxMemoryUsage: number;
        gcThreshold: number;
        monitoringInterval: number;
    };
    cleanup: {
        idleTimeout: number;
        cleanupInterval: number;
        forceCleanupAfter: number;
    };
    monitoring: {
        enabled: boolean;
        metricsInterval: number;
        alertThresholds: {
            memoryUsage: number;
            cpuUsage: number;
            activePages: number;
        };
    };
}
export interface BrowserPoolItem {
    id: string;
    browser: Browser;
    type: 'chromium' | 'firefox' | 'webkit';
    contexts: ContextPoolItem[];
    createdAt: Date;
    lastUsed: Date;
    isIdle: boolean;
}
export interface ContextPoolItem {
    id: string;
    context: BrowserContext;
    pages: PagePoolItem[];
    createdAt: Date;
    lastUsed: Date;
    isIdle: boolean;
}
export interface PagePoolItem {
    id: string;
    page: Page;
    createdAt: Date;
    lastUsed: Date;
    isIdle: boolean;
    currentUrl: string;
}
export interface ResourceMetrics {
    browsers: {
        total: number;
        active: number;
        idle: number;
        byType: Record<string, number>;
    };
    contexts: {
        total: number;
        active: number;
        idle: number;
    };
    pages: {
        total: number;
        active: number;
        idle: number;
    };
    memory: {
        used: number;
        available: number;
        percentage: number;
    };
    cpu: {
        usage: number;
    };
    uptime: number;
}
export interface ResourceAllocation {
    browserId: string;
    contextId: string;
    pageId: string;
    browser: Browser;
    context: BrowserContext;
    page: Page;
    allocatedAt: Date;
}
export declare class ResourceManager extends EventEmitter {
    private config;
    private browserPools;
    private allocatedResources;
    private monitoringInterval?;
    private cleanupInterval?;
    private startTime;
    private isShuttingDown;
    constructor(config?: Partial<ResourceManagerConfig>);
    allocateResources(): Promise<ResourceAllocation>;
    releaseResources(allocationId: string): Promise<void>;
    getResourceMetrics(): Promise<ResourceMetrics>;
    cleanup(force?: boolean): Promise<void>;
    shutdown(): Promise<void>;
    private findAvailableBrowser;
    private findAvailableContext;
    private findAvailablePage;
    private createBrowser;
    private createContext;
    private createPage;
    private destroyBrowser;
    private destroyContext;
    private destroyPage;
    private getMemoryUsage;
    private getCpuUsage;
    private startMonitoring;
    private startCleanup;
    private generateId;
    private mergeWithDefaults;
}
//# sourceMappingURL=ResourceManager.d.ts.map