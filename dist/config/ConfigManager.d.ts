export interface BrowserExplorerConfig {
    app: {
        name: string;
        version: string;
        environment: 'development' | 'production' | 'test';
        logLevel: 'debug' | 'info' | 'warn' | 'error';
    };
    crawling: {
        startUrl?: string;
        maxDepth: number;
        maxPages: number;
        crawlDelay: number;
        parallelWorkers: number;
        allowedDomains: string[];
        excludePatterns: string[];
        respectRobotsTxt: boolean;
        userAgent: string;
        customHeaders?: Record<string, string>;
    };
    browser: {
        headless: boolean;
        viewport: {
            width: number;
            height: number;
        };
        timeout: number;
        slowMo?: number;
        devtools?: boolean;
        args?: string[];
    };
    detection: {
        enableAI: boolean;
        aiProvider?: 'openai' | 'anthropic';
        enableTraditional: boolean;
        timeout: number;
        retryAttempts: number;
        customSelectors?: Record<string, string[]>;
    };
    generation: {
        framework: 'playwright' | 'cypress' | 'puppeteer';
        language: 'typescript' | 'javascript';
        outputDirectory: string;
        generatePageObjects: boolean;
        generateFixtures: boolean;
        generateHelpers: boolean;
        useAAAPattern: boolean;
        addComments: boolean;
        testNamingConvention: 'describe-it' | 'test';
        formatting: {
            indent: string;
            quotes: 'single' | 'double';
            semicolons: boolean;
            trailingComma: boolean;
            lineWidth: number;
        };
    };
    authentication?: {
        enabled: boolean;
        strategy: 'basic' | 'oauth' | 'api' | 'custom';
        loginUrl?: string;
        credentials?: {
            username?: string;
            password?: string;
            apiKey?: string;
        };
        sessionPersistence: boolean;
        cookieFile?: string;
    };
    database?: {
        url: string;
        pool?: {
            min: number;
            max: number;
        };
        migrations?: {
            directory: string;
        };
    };
    redis?: {
        url: string;
        keyPrefix?: string;
        ttl?: number;
    };
    apiKeys?: {
        openai?: string;
        anthropic?: string;
    };
    advanced?: {
        antiDetection: boolean;
        captchaHandling: boolean;
        proxyConfiguration?: {
            enabled: boolean;
            servers: string[];
            rotation: boolean;
        };
        monitoring: {
            enabled: boolean;
            metricsEndpoint?: string;
        };
    };
}
export declare class ConfigManager {
    private config;
    private configPath;
    loadConfig(configPath?: string): Promise<BrowserExplorerConfig>;
    getConfig(): BrowserExplorerConfig;
    saveConfig(config: BrowserExplorerConfig, filePath?: string): Promise<void>;
    updateConfig(updates: Partial<BrowserExplorerConfig>): void;
    private findConfigFile;
    private loadFromFile;
    private applyEnvironmentOverrides;
    private validateConfig;
    private getDefaultConfig;
    private deepMerge;
    private isObject;
    createSampleConfig(filePath?: string): Promise<void>;
}
//# sourceMappingURL=ConfigManager.d.ts.map