import * as fs from 'fs/promises';
import { ConfigManager, BrowserExplorerConfig } from '../config';
import { CrawlerService } from '../crawler/CrawlerService';
import { CrawlResult } from '../crawler/BreadthFirstCrawler';
// import { AIElementDetector } from '../detectors';
// import { InteractionExecutor } from '../interactions/InteractionExecutor';
// import { UserPathRecorder } from '../recording';
import { TestGenerator, TestFileWriter, GenerationOptions } from '../generation';
import { TestFramework } from '../types/generation';
import { UserPath } from '../types/recording';
import { logger } from '../utils/logger';
import { BrowserExplorerServer } from '../server/BrowserExplorerServer';
import { MultiStrategyAuthManager, AuthConfig, AuthStrategy } from '../auth/MultiStrategyAuthManager';
import { SessionManager } from '../auth/SessionManager';

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
        await fs.mkdir(dir, { recursive: true });
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
        await fs.writeFile('.gitignore', gitignoreContent);
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
        await fs.writeFile('README.md', readmeContent);
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
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async debugCrawler(_url: string, _options: DebugOptions): Promise<void> {
    logger.info('🕷️  Running crawler debug...');
    // TODO: Implement crawler debugging
  }

  private async debugDetector(_url: string, _options: DebugOptions): Promise<void> {
    logger.info('🔍 Running detector debug...');
    // TODO: Implement detector debugging
  }

  private async debugGenerator(_url: string, _options: DebugOptions): Promise<void> {
    logger.info('⚙️  Running generator debug...');
    // TODO: Implement generator debugging
  }
}
