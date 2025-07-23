export { BrowserAgent } from './agents/BrowserAgent';
export { BreadthFirstCrawler, CrawlerService } from './crawler';
export { AIElementDetector } from './detectors';
export { InteractionExecutor } from './interactions/InteractionExecutor';
export { TestDataGenerator } from './interactions/TestDataGenerator';
export { UserPathRecorder, PathOptimizer } from './recording';
export { TestGenerator, PageObjectGenerator, TestFileWriter } from './generation';
export { ConfigManager } from './config';
export type { CrawlConfiguration, CrawlResult, CrawlNode } from './crawler';
export type { InteractiveElement, ElementType, ElementDetectionResult } from './detectors';
export type { InteractionStrategy, InteractionResult, InteractionContext } from './types/interactions';
export type { UserPath, InteractionStep, RecordingOptions } from './recording';
export type { TestFile, GenerationOptions, GenerationResult } from './generation';
export type { BrowserExplorerConfig } from './config';
export declare class BrowserExplorer {
    private configManager;
    private crawlerService;
    private config;
    constructor(configPath?: string);
    initialize(configPath?: string): Promise<void>;
    explore(url?: string): Promise<any>;
    cleanup(): Promise<void>;
    getConfig(): any;
}
//# sourceMappingURL=index.d.ts.map