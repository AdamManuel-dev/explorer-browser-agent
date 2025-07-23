export { BrowserAgent } from './agents/BrowserAgent';
export { BreadthFirstCrawler, CrawlerService, DistributedCrawler } from './crawler';
export { AIElementDetector } from './detectors';
export { InteractionExecutor } from './interactions/InteractionExecutor';
export { TestDataGenerator } from './interactions/TestDataGenerator';
export { UserPathRecorder, PathOptimizer } from './recording';
export { TestGenerator, PageObjectGenerator, TestFileWriter } from './generation';
export { ConfigManager } from './config';
export { MultiStrategyAuthManager } from './auth';
export { SessionManager } from './auth/SessionManager';
export { StealthMode } from './stealth';
export { CaptchaHandler } from './captcha';
export { MonitoringService } from './monitoring';
export { SelfTestRunner } from './testing';
export type { CrawlConfiguration, CrawlResult, CrawlNode } from './crawler';
export type { InteractiveElement, ElementType, ElementDetectionResult } from './detectors';
export type { InteractionStrategy, InteractionResult, InteractionContext, } from './types/interactions';
export type { UserPath, InteractionStep, RecordingOptions } from './recording';
export type { TestFile, GenerationOptions, GenerationResult } from './generation';
export type { BrowserExplorerConfig } from './config';
export type { RedisConfig, DistributedCrawlConfig, WorkerStatus, CrawlJob, DistributedCrawlResult, } from './crawler';
export type { AuthStrategy, AuthConfig, AuthSession, AuthResult } from './auth';
export type { StealthConfig, StealthMetrics } from './stealth';
export type { CaptchaType, CaptchaConfig, CaptchaDetectionResult, CaptchaSolutionResult, } from './captcha';
export type { MetricValue, CounterMetric, GaugeMetric, HistogramMetric, TimerMetric, Metric, TraceSpan, MonitoringConfig, SystemMetrics, CrawlMetrics, MonitoringReport, } from './monitoring';
export type { SelfTestConfig, TestResult, SelfTestReport } from './testing';
export declare class BrowserExplorer {
    private configManager;
    private crawlerService;
    private config;
    constructor(_configPath?: string);
    initialize(configPath?: string): Promise<void>;
    explore(url?: string): Promise<any>;
    cleanup(): Promise<void>;
    getConfig(): any;
}
//# sourceMappingURL=index.d.ts.map