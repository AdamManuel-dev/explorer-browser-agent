// Main exports for programmatic usage
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

// Type exports
export type { 
  CrawlConfiguration, 
  CrawlResult, 
  CrawlNode 
} from './crawler';

export type { 
  InteractiveElement, 
  ElementType, 
  ElementDetectionResult 
} from './detectors';

export type { 
  InteractionStrategy, 
  InteractionResult, 
  InteractionContext 
} from './types/interactions';

export type { 
  UserPath, 
  InteractionStep, 
  RecordingOptions 
} from './recording';

export type { 
  TestFile, 
  GenerationOptions, 
  GenerationResult 
} from './generation';

export type { 
  BrowserExplorerConfig 
} from './config';

export type {
  RedisConfig,
  DistributedCrawlConfig,
  WorkerStatus,
  CrawlJob,
  DistributedCrawlResult,
} from './crawler';

export type {
  AuthStrategy,
  AuthenticationConfig,
  AuthSession,
  AuthResult,
} from './auth';

export type {
  StealthConfig,
  StealthMetrics,
} from './stealth';

export type {
  CaptchaType,
  CaptchaConfig,
  CaptchaDetectionResult,
  CaptchaSolutionResult,
} from './captcha';

export type {
  MetricValue,
  CounterMetric,
  GaugeMetric,
  HistogramMetric,
  TimerMetric,
  Metric,
  TraceSpan,
  MonitoringConfig,
  SystemMetrics,
  CrawlMetrics,
  MonitoringReport,
} from './monitoring';

export type {
  SelfTestConfig,
  TestResult,
  SelfTestReport,
} from './testing';

// Main integration class for easy usage
export class BrowserExplorer {
  private configManager: ConfigManager;
  private crawlerService: CrawlerService | null = null;
  private config: any = null;

  constructor(configPath?: string) {
    this.configManager = new ConfigManager();
  }

  async initialize(configPath?: string): Promise<void> {
    this.config = await this.configManager.loadConfig(configPath);
  }

  async explore(url?: string): Promise<any> {
    if (!this.config) {
      throw new Error('BrowserExplorer not initialized. Call initialize() first.');
    }

    const startUrl = url || this.config.crawling.startUrl;
    if (!startUrl) {
      throw new Error('No URL provided. Set startUrl in config or pass as parameter.');
    }

    // Initialize crawler
    this.crawlerService = new CrawlerService({
      startUrl,
      maxDepth: this.config.crawling.maxDepth,
      maxPages: this.config.crawling.maxPages,
      crawlDelay: this.config.crawling.crawlDelay,
      parallelWorkers: this.config.crawling.parallelWorkers,
      allowedDomains: this.config.crawling.allowedDomains,
      respectRobotsTxt: this.config.crawling.respectRobotsTxt,
      userAgent: this.config.crawling.userAgent,
    });

    // Execute exploration
    await this.crawlerService.initialize();
    const crawlResult = await this.crawlerService.crawl();

    // Generate tests
    const generator = new TestGenerator({
      framework: this.config.generation.framework,
      language: this.config.generation.language,
      outputDirectory: this.config.generation.outputDirectory,
      generatePageObjects: this.config.generation.generatePageObjects,
      generateFixtures: this.config.generation.generateFixtures,
      generateHelpers: this.config.generation.generateHelpers,
      useAAAPattern: this.config.generation.useAAAPattern,
      addComments: this.config.generation.addComments,
      groupRelatedTests: true,
      testNamingConvention: this.config.generation.testNamingConvention,
      formatting: this.config.generation.formatting,
    });

    // Create sample path for now
    const samplePath = {
      id: 'exploration-path',
      name: 'Website Exploration',
      startUrl,
      steps: [],
      assertions: [],
      duration: crawlResult.duration,
      metadata: {
        browser: 'chromium',
        viewport: this.config.browser.viewport,
        userAgent: this.config.crawling.userAgent,
      },
      createdAt: new Date(),
    };

    const generationResult = await generator.generate(samplePath);

    // Write files
    const writer = new TestFileWriter(this.config.generation.outputDirectory);
    await writer.createProjectStructure();
    await writer.writeFiles(generationResult);

    return {
      crawlResult,
      generationResult,
      testsGenerated: generationResult.summary.totalTests,
      filesCreated: generationResult.summary.totalFiles,
    };
  }

  async cleanup(): Promise<void> {
    if (this.crawlerService) {
      await this.crawlerService.cleanup();
    }
  }

  getConfig(): any {
    return this.config;
  }
}