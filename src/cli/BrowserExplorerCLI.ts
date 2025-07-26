import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager, BrowserExplorerConfig } from '../config';
import { CrawlerService } from '../crawler/CrawlerService';
import { CrawlResult, BreadthFirstCrawler } from '../crawler/BreadthFirstCrawler';
import { AIElementDetector } from '../detectors';
// import { InteractionExecutor } from '../interactions/InteractionExecutor';
// import { UserPathRecorder } from '../recording';
import { TestGenerator, TestFileWriter, GenerationOptions, NaturalLanguageTestSpec } from '../generation';
import { TestFramework } from '../types/generation';
import { UserPath, StepType } from '../types/recording';
import { logger } from '../utils/logger';
import { BrowserExplorerServer } from '../server/BrowserExplorerServer';
import { MultiStrategyAuthManager, AuthConfig, AuthStrategy } from '../auth/MultiStrategyAuthManager';
import { SessionManager } from '../auth/SessionManager';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

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

export class BrowserExplorerCLI {
  private configManager: ConfigManager;

  constructor() {
    this.configManager = new ConfigManager();
  }

  async crawl(url: string, options: CrawlOptions): Promise<void> {
    try {
      this.setupLogging(options.verbose);

      logger.info('Starting Browser Explorer crawl', { url, options });

      // Load configuration
      const config = await this.loadConfig(options.config);

      // Override config with CLI options
      this.applyCliOptions(config, options);
      config.crawling.startUrl = url;

      // Initialize crawler service
      const crawlerService = new CrawlerService({
        startUrl: url,
        maxDepth: parseInt(options.maxDepth),
        maxPages: parseInt(options.maxPages),
        crawlDelay: parseInt(options.delay),
        parallelWorkers: parseInt(options.workers),
        allowedDomains: config.crawling.allowedDomains,
        respectRobotsTxt: config.crawling.respectRobotsTxt,
        userAgent: config.crawling.userAgent,
      });

      // Initialize detector and executor
      // const detector = new AIElementDetector();
      // const executor = new InteractionExecutor();
      // const recorder = new UserPathRecorder({
      //   captureScreenshots: true,
      //   captureNetwork: true,
      //   generateAssertions: true,
      //   assertionTypes: ['url', 'visible', 'text', 'value'],
      // });

      // Setup authentication if needed
      if (options.auth && options.username && options.password) {
        await this.setupAuthentication(crawlerService, {
          enabled: true,
          strategy: 'basic',
          loginUrl: options.authUrl,
          credentials: {
            username: options.username,
            password: options.password,
          },
          sessionPersistence: false,
        });
      }

      // Start crawling
      await crawlerService.initialize();

      logger.info(`🚀 Starting crawl of ${url}`);
      logger.info(`📊 Max depth: ${options.maxDepth}, Max pages: ${options.maxPages}`);
      logger.info(`📁 Output directory: ${options.output}`);

      const crawlResult = await crawlerService.crawl();

      logger.info(`✅ Crawl completed: ${crawlResult.pagesVisited} pages visited`);

      // Generate tests
      const generationOptions: GenerationOptions = {
        framework: options.framework as TestFramework,
        language: options.language as 'typescript' | 'javascript',
        outputDirectory: options.output,
        generatePageObjects: options.pageObjects,
        generateFixtures: false,
        generateHelpers: false,
        useAAAPattern: true,
        addComments: true,
        groupRelatedTests: true,
        testNamingConvention: 'describe-it',
      };

      // For now, create a sample user path
      // In a full implementation, this would come from the actual crawling process
      const samplePath = this.createSampleUserPath(url, crawlResult);

      const generator = new TestGenerator(generationOptions);
      const generationResult = await generator.generate(samplePath);

      // Write test files
      const writer = new TestFileWriter(options.output);
      await writer.createProjectStructure();
      await writer.writeFiles(generationResult);

      logger.info(`🎉 Test generation completed!`);
      logger.info(`📝 Generated ${generationResult.summary.totalFiles} files`);
      logger.info(`🧪 Created ${generationResult.summary.totalTests} tests`);
      logger.info(`📂 Files saved to: ${options.output}`);

      await crawlerService.cleanup();
    } catch (error) {
      logger.error('Crawl command failed', error);
      logger.error('❌ Crawl failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  async test(url: string, options: TestOptions): Promise<void> {
    try {
      this.setupLogging(options.verbose);

      logger.info('Starting Browser Explorer test', { url, options });

      // Load configuration
      const config = await this.loadConfig(options.config);

      logger.info(`🧪 Testing page: ${url}`);

      // Test basic functionality
      const crawlerService = new CrawlerService({
        startUrl: url,
        maxDepth: 1,
        maxPages: 1,
        crawlDelay: 1000,
        parallelWorkers: 1,
        allowedDomains: [],
        respectRobotsTxt: false,
        userAgent: config.crawling.userAgent,
      });

      await crawlerService.initialize();
      const result = await crawlerService.crawl();
      await crawlerService.cleanup();

      logger.info(`✅ Test completed successfully`);
      logger.info(`📊 Pages visited: ${result.pagesVisited}`);
      logger.info(`⏱️  Duration: ${Math.round(result.duration / 1000)}s`);

      if (result.errors.length > 0) {
        logger.warn(`⚠️  Errors encountered: ${result.errors.length}`);
        result.errors.forEach((error) => {
          logger.warn(`   - ${error.url}: ${error.error}`);
        });
      }
    } catch (error) {
      logger.error('Test command failed', error);
      logger.error('❌ Test failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  async init(options: InitOptions): Promise<void> {
    try {
      logger.info('🚀 Initializing Browser Explorer project...');

      // Create directory structure
      const directories = ['config', 'generated-tests', 'screenshots', 'reports'];

      for (const dir of directories) {
        await fs.promises.mkdir(dir, { recursive: true });
        logger.info(`📁 Created directory: ${dir}`);
      }

      // Create configuration file
      const configPath = 'browser-explorer.config.yaml';
      const configExists = await this.fileExists(configPath);

      if (!configExists || options.force) {
        await this.configManager.createSampleConfig(configPath);
        logger.info(`⚙️  Created configuration file: ${configPath}`);
      } else {
        logger.warn(`⚠️  Configuration file already exists: ${configPath}`);
      }

      if (!options.configOnly) {
        // Create .gitignore
        const gitignoreContent = `node_modules/
generated-tests/
screenshots/
reports/
*.log
.env
browser-explorer.config.local.*
`;
        await fs.promises.writeFile('.gitignore', gitignoreContent);
        logger.info('📝 Created .gitignore');

        // Create README
        const readmeContent = `# Browser Explorer Project

This project was initialized with Browser Explorer.

## Getting Started

1. Configure your settings in \`browser-explorer.config.yaml\`
2. Run a crawl: \`browser-explorer crawl https://your-website.com\`
3. View generated tests in the \`generated-tests\` directory

## Configuration

Edit \`browser-explorer.config.yaml\` to customize:
- Crawling behavior
- Test generation options
- Authentication settings
- Browser configuration

## Running Tests

\`\`\`bash
# Install dependencies (if generated tests use npm)
cd generated-tests && npm install

# Run tests
npm test
\`\`\`
`;
        await fs.promises.writeFile('README.md', readmeContent);
        logger.info('📚 Created README.md');
      }

      logger.info('✅ Project initialized successfully!');
      logger.info('');
      logger.info('Next steps:');
      logger.info('1. Edit browser-explorer.config.yaml to configure your settings');
      logger.info('2. Run: browser-explorer crawl https://your-website.com');
    } catch (error) {
      logger.error('Init command failed', error);
      logger.error('❌ Initialization failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  async createConfig(options: ConfigOptions): Promise<void> {
    try {
      const configPath = options.file || 'browser-explorer.config.yaml';
      const exists = await this.fileExists(configPath);

      if (exists && !options.force) {
        logger.error(`❌ Configuration file already exists: ${configPath}`);
        logger.info('Use --force to overwrite');
        process.exit(1);
      }

      await this.configManager.createSampleConfig(configPath);
      logger.info(`✅ Sample configuration created: ${configPath}`);
    } catch (error) {
      logger.error('Create config command failed', error);
      logger.error(
        '❌ Failed to create configuration:',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  }

  async validateConfig(options: ConfigOptions): Promise<void> {
    try {
      const config = await this.loadConfig(options.config);
      logger.info('✅ Configuration is valid');
      logger.info(`📁 Start URL: ${config.crawling.startUrl || 'Not set'}`);
      logger.info(`🔧 Framework: ${config.generation.framework}`);
      logger.info(`💾 Output: ${config.generation.outputDirectory}`);
    } catch (error) {
      logger.error('Validate config command failed', error);
      logger.error(
        '❌ Configuration validation failed:',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  }

  async serve(options: ServeOptions): Promise<void> {
    try {
      const serverOptions = {
        port: parseInt(options.port, 10),
        config: options.config,
        cors: options.cors
      };

      const server = new BrowserExplorerServer(serverOptions);
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        logger.info('🛑 Shutting down server...');
        try {
          await server.stop();
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      process.on('SIGTERM', async () => {
        logger.info('🛑 Shutting down server...');
        try {
          await server.stop();
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      await server.start();
    } catch (error) {
      logger.error('Serve command failed', error);
      logger.error('❌ Server failed to start:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  async debug(component: string, url: string, options: DebugOptions): Promise<void> {
    try {
      this.setupLogging(true); // Always verbose in debug mode

      logger.info(`🔍 Debugging ${component} with URL: ${url}`);

      switch (component) {
        case 'crawler':
          await this.debugCrawler(url, options);
          break;
        case 'detector':
          await this.debugDetector(url, options);
          break;
        case 'generator':
          await this.debugGenerator(url, options);
          break;
        default:
          logger.error(`❌ Unknown component: ${component}`);
          logger.info('Available components: crawler, detector, generator');
          process.exit(1);
      }
    } catch (error) {
      logger.error('Debug command failed', error);
      logger.error('❌ Debug failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  private async loadConfig(configPath?: string): Promise<BrowserExplorerConfig> {
    return this.configManager.loadConfig(configPath);
  }

  private setupLogging(verbose?: boolean): void {
    if (verbose) {
      // Set debug level
      logger.level = 'debug';
    }
  }

  private applyCliOptions(config: BrowserExplorerConfig, options: CrawlOptions): void {
    // Apply CLI overrides to config
    config.crawling.maxDepth = parseInt(options.maxDepth);
    config.crawling.maxPages = parseInt(options.maxPages);
    config.crawling.crawlDelay = parseInt(options.delay);
    config.crawling.parallelWorkers = parseInt(options.workers);

    config.browser.headless = options.headless;

    config.generation.framework = options.framework as TestFramework;
    config.generation.language = options.language as 'typescript' | 'javascript';
    config.generation.outputDirectory = options.output;
    config.generation.generatePageObjects = options.pageObjects;

    if (options.auth) {
      config.authentication = {
        enabled: true,
        strategy: 'basic',
        loginUrl: options.authUrl,
        credentials: {
          username: options.username,
          password: options.password,
        },
        sessionPersistence: true,
      };
    }
  }

  private async setupAuthentication(
    crawlerService: CrawlerService,
    auth: BrowserExplorerConfig['authentication']
  ): Promise<void> {
    if (!auth?.enabled) {
      logger.debug('Authentication disabled, skipping setup');
      return;
    }

    logger.info('🔐 Setting up authentication', { 
      strategy: auth.strategy,
      loginUrl: auth.loginUrl 
    });

    try {
      // Initialize authentication manager
      const authManager = new MultiStrategyAuthManager();
      
      // Initialize session manager if persistence is enabled
      const sessionManager = auth.sessionPersistence 
        ? new SessionManager({
            storage: { type: 'file', options: { filePath: './sessions' } },
            encryption: { enabled: false },
            cleanup: { enabled: true, interval: 3600000, maxAge: 86400000 }
          })
        : null;

      // Create authentication configuration
      const authConfig: AuthConfig = {
        strategy: auth.strategy as AuthStrategy,
        loginUrl: auth.loginUrl,
        credentials: {
          username: auth.credentials?.username,
          password: auth.credentials?.password,
          apiKey: auth.credentials?.apiKey,
        },
        sessionPersistence: auth.sessionPersistence,
        cookieFile: auth.cookieFile,
        timeout: 30000,
        selectors: {
          usernameField: 'input[name="username"], input[name="email"], input[type="email"]',
          passwordField: 'input[name="password"], input[type="password"]',
          submitButton: 'button[type="submit"], input[type="submit"]',
          successIndicator: '.dashboard, .welcome, [data-testid="dashboard"]',
          errorIndicator: '.error, .alert-danger, .invalid-feedback',
        },
      };

      // Attach authentication to crawler service
      await this.attachAuthenticationToCrawler(crawlerService, authManager, authConfig, sessionManager);

      logger.info('✅ Authentication setup completed', { 
        strategy: auth.strategy,
        sessionPersistence: auth.sessionPersistence 
      });

    } catch (error) {
      logger.error('❌ Authentication setup failed', error);
      throw new Error(`Authentication setup failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async attachAuthenticationToCrawler(
    crawlerService: CrawlerService,
    authManager: MultiStrategyAuthManager,
    authConfig: AuthConfig,
    sessionManager?: SessionManager | null
  ): Promise<void> {
    logger.debug('Attaching authentication to crawler service');
    
    // Store auth components for use during crawling
    // This extends the crawler service with authentication capabilities
    (crawlerService as any)._authManager = authManager;
    (crawlerService as any)._authConfig = authConfig;
    (crawlerService as any)._sessionManager = sessionManager;

    logger.debug('Authentication components attached to crawler service', {
      hasAuthManager: !!authManager,
      hasSessionManager: !!sessionManager,
      strategy: authConfig.strategy
    });
  }

  private createSampleUserPath(url: string, _crawlResult: CrawlResult): UserPath {
    // Create a basic user path for demonstration
    return {
      id: 'sample-path-1',
      name: 'Sample Navigation Path',
      startUrl: url,
      steps: [
        {
          id: 'step-1',
          type: 'navigation',
          action: `Navigate to ${url}`,
          value: url,
          timestamp: Date.now(),
          duration: 1000,
          networkActivity: [],
          stateChanges: [],
        },
      ],
      assertions: [
        {
          id: 'assertion-1',
          type: 'url',
          target: 'page',
          expected: url,
          operator: 'equals',
        },
      ],
      duration: 1000,
      metadata: {
        browser: 'chromium',
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Browser Explorer',
      },
      createdAt: new Date(),
    };
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async debugCrawler(url: string, options: DebugOptions): Promise<void> {
    logger.info('🕷️  Running crawler debug...');
    
    try {
      // Create browser instance using Playwright directly
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();

      logger.info('Starting crawl from:', url);

      // Track crawl progress
      const visitedUrls: string[] = [];
      const discoveredUrls: string[] = [];

      // Navigate to initial page
      await page.goto(url);
      visitedUrls.push(url);

      // Extract links from the page
      const links = await page.evaluate(() => {
        const anchors = document.querySelectorAll('a[href]');
        return Array.from(anchors).map(a => ({
          href: (a as HTMLAnchorElement).href,
          text: (a as HTMLAnchorElement).textContent?.trim() || '',
        }));
      });

      logger.info(`Found ${links.length} links on ${url}`);
      links.forEach(link => {
        logger.debug(`  - ${link.text || 'No text'}: ${link.href}`);
        discoveredUrls.push(link.href);
      });

      // Generate debug report
      const report = {
        startUrl: url,
        visitedUrls,
        discoveredUrls: discoveredUrls.slice(0, 20), // Limit output
        stats: {
          pagesVisited: visitedUrls.length,
          linksDiscovered: discoveredUrls.length,
          timestamp: new Date().toISOString(),
        },
      };

      // Write debug output
      const outputPath = path.resolve(options.output, 'crawler-debug.json');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

      logger.info(`Crawler debug complete! Report saved to: ${outputPath}`);
      logger.info('Summary:', report.stats);

      await browser.close();
    } catch (error) {
      logger.error('Crawler debug failed:', error);
      throw error;
    }
  }

  private async debugDetector(url: string, options: DebugOptions): Promise<void> {
    logger.info('🔍 Running detector debug...');
    
    try {
      // Create browser instance
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();

      // Navigate to the URL
      logger.info(`Navigating to: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle' });

      // Initialize AI detector
      const aiDetector = new AIElementDetector();
      await aiDetector.initialize(page);

      logger.info('Running AI element detection...');
      const detectionResult = await aiDetector.detectInteractiveElements(page);

      // Convert result to array format
      const elements = Array.isArray(detectionResult) ? detectionResult : [detectionResult];

      // Generate comprehensive report
      const report = {
        url,
        timestamp: new Date().toISOString(),
        pageTitle: await page.title(),
        detection: {
          elementsFound: elements.length,
          elements: elements.slice(0, 10).map(elem => ({
            type: elem.type,
            selector: elem.selector,
            text: elem.text,
            confidence: elem.confidence,
            attributes: elem.attributes,
          })),
        },
        summary: {
          totalElements: elements.length,
          elementTypes: this.countElementTypes(elements),
          highConfidenceElements: elements.filter(e => e.confidence > 0.8).length,
        },
      };

      // Write debug output
      const outputPath = path.resolve(options.output, 'detector-debug.json');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

      // Save screenshot
      const screenshotPath = path.resolve(options.output, 'detector-debug.png');
      await page.screenshot({ fullPage: true, path: screenshotPath });

      logger.info(`Detector debug complete! Report saved to: ${outputPath}`);
      logger.info('Summary:', report.summary);
      logger.info(`Screenshot saved to: ${screenshotPath}`);

      await browser.close();
    } catch (error) {
      logger.error('Detector debug failed:', error);
      throw error;
    }
  }

  private countElementTypes(elements: any[]): Record<string, number> {
    const counts: Record<string, number> = {};
    elements.forEach(elem => {
      counts[elem.type] = (counts[elem.type] || 0) + 1;
    });
    return counts;
  }

  private async debugGenerator(url: string, options: DebugOptions): Promise<void> {
    logger.info('⚙️  Running generator debug...');
    
    try {
      // Create browser instance
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();

      // Navigate to the URL
      logger.info(`Navigating to: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle' });

      // Initialize AI detector to find elements
      const detector = new AIElementDetector();
      await detector.initialize(page);
      const detectionResult = await detector.detectInteractiveElements(page);
      
      const elements = Array.isArray(detectionResult) ? detectionResult : [detectionResult];
      logger.info(`Found ${elements.length} interactive elements`);

      // Test natural language generation with AI assertions
      logger.info('Testing natural language generation with AI-enhanced assertions...');
      const nlSpec: NaturalLanguageTestSpec = {
        description: 'Sample test for debugging with AI assertions',
        actions: [
          `Navigate to ${url}`,
          'Click on the first button',
          'Type "test" into the first input field',
        ],
        assertions: [
          'Page should load successfully',
          'Title should be visible',
        ],
        tags: ['debug', 'ai-assertions'],
        priority: 'medium',
      };

      // Create a basic generator configuration
      const generator = new TestGenerator({
        framework: 'playwright',
        outputDirectory: options.output,
        language: 'typescript',
        generatePageObjects: false,
        generateFixtures: false,
        generateHelpers: false,
        useAAAPattern: true,
        addComments: true,
        groupRelatedTests: false,
        testNamingConvention: 'describe-it',
        formatting: {
          indent: '  ',
          quotes: 'single',
          semicolons: true,
          trailingComma: true,
          lineWidth: 120,
        },
      });

      let generationResult = null;
      try {
        generationResult = await generator.generateFromNaturalLanguage([nlSpec]);
        logger.info('Natural language generation successful');
      } catch (error) {
        logger.error('Natural language generation failed:', error);
      }

      // Generate comprehensive report
      const report = {
        url,
        timestamp: new Date().toISOString(),
        pageInfo: {
          title: await page.title(),
          elementsFound: elements.length,
          elementTypes: this.countElementTypes(elements),
        },
        generationResults: {
          naturalLanguage: generationResult ? {
            success: true,
            filesGenerated: generationResult.files.length,
            summary: generationResult.summary,
          } : {
            success: false,
            error: 'Generation failed',
          },
        },
      };

      // Write debug report
      const reportPath = path.resolve(options.output, 'generator-debug.json');
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

      // Write any generated test files
      if (generationResult) {
        for (const file of generationResult.files) {
          const filePath = path.resolve(options.output, 'generated-tests', file.filename);
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, file.content);
        }
      }

      logger.info(`Generator debug complete! Report saved to: ${reportPath}`);
      logger.info('Test files saved to:', path.resolve(options.output, 'generated-tests'));

      await browser.close();
    } catch (error) {
      logger.error('Generator debug failed:', error);
      throw error;
    }
  }
}
