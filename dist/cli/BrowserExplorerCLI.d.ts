interface CrawlOptions {
    maxDepth: string;
    maxPages: string;
    output: string;
    config?: string;
    headless: boolean;
    delay: string;
    workers: string;
    framework: string;
    language: string;
    pageObjects: boolean;
    auth?: boolean;
    authUrl?: string;
    username?: string;
    password?: string;
    verbose?: boolean;
}
interface TestOptions {
    output: string;
    config?: string;
    headless: boolean;
    verbose?: boolean;
}
interface InitOptions {
    force?: boolean;
    configOnly?: boolean;
}
interface ConfigOptions {
    file?: string;
    force?: boolean;
    config?: string;
}
interface ServeOptions {
    port: string;
    config?: string;
    cors?: boolean;
}
interface DebugOptions {
    config?: string;
    output: string;
}
export declare class BrowserExplorerCLI {
    private configManager;
    constructor();
    crawl(url: string, options: CrawlOptions): Promise<void>;
    test(url: string, options: TestOptions): Promise<void>;
    init(options: InitOptions): Promise<void>;
    createConfig(options: ConfigOptions): Promise<void>;
    validateConfig(options: ConfigOptions): Promise<void>;
    serve(options: ServeOptions): Promise<void>;
    debug(component: string, url: string, options: DebugOptions): Promise<void>;
    private loadConfig;
    private setupLogging;
    private applyCliOptions;
    private setupAuthentication;
    private createSampleUserPath;
    private fileExists;
    private debugCrawler;
    private debugDetector;
    private debugGenerator;
}
export {};
//# sourceMappingURL=BrowserExplorerCLI.d.ts.map