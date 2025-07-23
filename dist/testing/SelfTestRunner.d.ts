export interface SelfTestConfig {
    testTimeout: number;
    retryAttempts: number;
    skipBrowserTests: boolean;
    outputDirectory: string;
    testEndpoints: {
        enabled: boolean;
        urls: string[];
    };
    componentTests: {
        crawler: boolean;
        detector: boolean;
        executor: boolean;
        recorder: boolean;
        generator: boolean;
        monitoring: boolean;
        auth: boolean;
        stealth: boolean;
        captcha: boolean;
        config: boolean;
    };
    performanceThresholds: {
        maxCrawlTime: number;
        maxGenerationTime: number;
        maxMemoryUsage: number;
        minSuccessRate: number;
    };
}
export interface TestResult {
    name: string;
    success: boolean;
    duration: number;
    error?: string;
    details?: Record<string, any>;
    metrics?: Record<string, number>;
}
export interface SelfTestReport {
    timestamp: Date;
    environment: {
        nodeVersion: string;
        platform: string;
        architecture: string;
        memoryTotal: number;
        memoryUsed: number;
    };
    configuration: SelfTestConfig;
    results: TestResult[];
    summary: {
        totalTests: number;
        passedTests: number;
        failedTests: number;
        skippedTests: number;
        totalDuration: number;
        successRate: number;
        overallHealth: 'healthy' | 'degraded' | 'unhealthy';
    };
    recommendations: string[];
}
export declare class SelfTestRunner {
    private config;
    private browser?;
    private tempDir;
    private monitoring?;
    private testResults;
    constructor(config?: Partial<SelfTestConfig>);
    runAllTests(): Promise<SelfTestReport>;
    runComponentTests(): Promise<void>;
    runBrowserTests(): Promise<void>;
    runEndToEndTests(): Promise<void>;
    runPerformanceTests(): Promise<void>;
    private runSingleTest;
    private testConfigManager;
    private testMonitoringService;
    private testElementDetector;
    private testInteractionExecutor;
    private testAuthManager;
    private testSessionManager;
    private testStealthMode;
    private testCaptchaHandler;
    private testBasicCrawling;
    private testBrowserElementDetection;
    private testUserPathRecording;
    private testTestGeneration;
    private testCompleteWorkflow;
    private testAuthenticationWorkflow;
    private testErrorRecovery;
    private testMemoryUsage;
    private testCrawlPerformance;
    private testGenerationPerformance;
    private testConcurrentOperations;
    private initializeTestEnvironment;
    private cleanup;
    private startTestServer;
    private extractMetrics;
    private generateReport;
    private determineOverallHealth;
    private generateRecommendations;
    private saveReport;
    private ensureTempDirectory;
    private mergeWithDefaults;
}
//# sourceMappingURL=SelfTestRunner.d.ts.map