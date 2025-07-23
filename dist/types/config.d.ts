export interface Config {
    browser: {
        headless: boolean;
        width: number;
        height: number;
        userAgent?: string;
    };
    crawling: {
        startUrl: string;
        maxDepth: number;
        maxPages: number;
        respectRobotsTxt: boolean;
        delayBetweenRequests: number;
        followExternalLinks: boolean;
    };
    generation: {
        framework: 'playwright' | 'cypress' | 'puppeteer';
        language: 'typescript' | 'javascript';
        outputDirectory: string;
        includePageObjects: boolean;
        includeComments: boolean;
        formatting?: {
            indentSize: number;
            useSemicolons: boolean;
            singleQuotes: boolean;
        };
    };
    detection: {
        aiEnabled: boolean;
        selectorStrategies: string[];
        customSelectors: Record<string, string>;
    };
    monitoring: {
        enabled: boolean;
        metricsCollection: {
            enabled: boolean;
            flushInterval: number;
            maxMetrics: number;
            exportFormat: 'console' | 'file' | 'prometheus';
        };
        tracing: {
            enabled: boolean;
            samplingRate: number;
            maxSpans: number;
        };
        alerting: {
            enabled: boolean;
            thresholds: {
                errorRate: number;
                responseTime: number;
                memoryUsage: number;
                crawlFailureRate: number;
            };
        };
        reporting: {
            enabled: boolean;
            interval: number;
            includeSummary: boolean;
        };
    };
}
//# sourceMappingURL=config.d.ts.map