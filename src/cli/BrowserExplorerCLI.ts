import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigManager, BrowserExplorerConfig } from '../config';
import { CrawlerService } from '../crawler/CrawlerService';
import { AIElementDetector } from '../detectors';
import { InteractionExecutor } from '../interactions/InteractionExecutor';
import { UserPathRecorder } from '../recording';
import { TestGenerator, TestFileWriter, GenerationOptions } from '../generation';
import { logger } from '../utils/logger';

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
      const detector = new AIElementDetector();
      const executor = new InteractionExecutor();
      const recorder = new UserPathRecorder({
        captureScreenshots: true,
        captureNetwork: true,
        generateAssertions: true,
        assertionTypes: ['url', 'visible', 'text', 'value'],
      });

      // Setup authentication if needed
      if (options.auth && options.username && options.password) {
        await this.setupAuthentication(crawlerService, {
          username: options.username,
          password: options.password,
          loginUrl: options.authUrl,
        });
      }

      // Start crawling
      await crawlerService.initialize();
      
      console.log(`🚀 Starting crawl of ${url}`);
      console.log(`📊 Max depth: ${options.maxDepth}, Max pages: ${options.maxPages}`);
      console.log(`📁 Output directory: ${options.output}`);
      
      const crawlResult = await crawlerService.crawl();
      
      console.log(`✅ Crawl completed: ${crawlResult.pagesVisited} pages visited`);

      // Generate tests
      const generationOptions: GenerationOptions = {
        framework: options.framework as any,
        language: options.language as any,
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

      console.log(`🎉 Test generation completed!`);
      console.log(`📝 Generated ${generationResult.summary.totalFiles} files`);
      console.log(`🧪 Created ${generationResult.summary.totalTests} tests`);
      console.log(`📂 Files saved to: ${options.output}`);

      await crawlerService.cleanup();
      
    } catch (error) {
      logger.error('Crawl command failed', error);
      console.error('❌ Crawl failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  async test(url: string, options: TestOptions): Promise<void> {
    try {
      this.setupLogging(options.verbose);
      
      logger.info('Starting Browser Explorer test', { url, options });

      // Load configuration
      const config = await this.loadConfig(options.config);

      console.log(`🧪 Testing page: ${url}`);
      
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

      console.log(`✅ Test completed successfully`);
      console.log(`📊 Pages visited: ${result.pagesVisited}`);
      console.log(`⏱️  Duration: ${Math.round(result.duration / 1000)}s`);
      
      if (result.errors.length > 0) {
        console.log(`⚠️  Errors encountered: ${result.errors.length}`);
        result.errors.forEach(error => {
          console.log(`   - ${error.url}: ${error.error}`);
        });
      }

    } catch (error) {
      logger.error('Test command failed', error);
      console.error('❌ Test failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  async init(options: InitOptions): Promise<void> {
    try {
      console.log('🚀 Initializing Browser Explorer project...');

      // Create directory structure
      const directories = [
        'config',
        'generated-tests',
        'screenshots',
        'reports',
      ];

      for (const dir of directories) {
        await fs.mkdir(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }

      // Create configuration file
      const configPath = 'browser-explorer.config.yaml';
      const configExists = await this.fileExists(configPath);
      
      if (!configExists || options.force) {
        await this.configManager.createSampleConfig(configPath);
        console.log(`⚙️  Created configuration file: ${configPath}`);
      } else {
        console.log(`⚠️  Configuration file already exists: ${configPath}`);
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
        console.log('📝 Created .gitignore');

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
        console.log('📚 Created README.md');
      }

      console.log('✅ Project initialized successfully!');
      console.log('');
      console.log('Next steps:');
      console.log('1. Edit browser-explorer.config.yaml to configure your settings');
      console.log('2. Run: browser-explorer crawl https://your-website.com');

    } catch (error) {
      logger.error('Init command failed', error);
      console.error('❌ Initialization failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  async createConfig(options: ConfigOptions): Promise<void> {
    try {
      const configPath = options.file || 'browser-explorer.config.yaml';
      const exists = await this.fileExists(configPath);

      if (exists && !options.force) {
        console.error(`❌ Configuration file already exists: ${configPath}`);
        console.log('Use --force to overwrite');
        process.exit(1);
      }

      await this.configManager.createSampleConfig(configPath);
      console.log(`✅ Sample configuration created: ${configPath}`);

    } catch (error) {
      logger.error('Create config command failed', error);
      console.error('❌ Failed to create configuration:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  async validateConfig(options: ConfigOptions): Promise<void> {
    try {
      const config = await this.loadConfig(options.config);
      console.log('✅ Configuration is valid');
      console.log(`📁 Start URL: ${config.crawling.startUrl || 'Not set'}`);
      console.log(`🔧 Framework: ${config.generation.framework}`);
      console.log(`💾 Output: ${config.generation.outputDirectory}`);

    } catch (error) {
      logger.error('Validate config command failed', error);
      console.error('❌ Configuration validation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  async serve(options: ServeOptions): Promise<void> {
    try {
      console.log(`🚀 Starting Browser Explorer server on port ${options.port}...`);
      console.log('❌ Server mode not yet implemented');
      console.log('This feature will provide a REST API for Browser Explorer functionality');
      
      // TODO: Implement server mode
      process.exit(1);

    } catch (error) {
      logger.error('Serve command failed', error);
      console.error('❌ Server failed to start:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  async debug(component: string, url: string, options: DebugOptions): Promise<void> {
    try {
      this.setupLogging(true); // Always verbose in debug mode
      
      console.log(`🔍 Debugging ${component} with URL: ${url}`);

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
          console.error(`❌ Unknown component: ${component}`);
          console.log('Available components: crawler, detector, generator');
          process.exit(1);
      }

    } catch (error) {
      logger.error('Debug command failed', error);
      console.error('❌ Debug failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  private async loadConfig(configPath?: string): Promise<BrowserExplorerConfig> {
    return await this.configManager.loadConfig(configPath);
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
    
    config.generation.framework = options.framework as any;
    config.generation.language = options.language as any;
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

  private async setupAuthentication(crawlerService: any, auth: any): Promise<void> {
    // TODO: Implement authentication setup
    console.log('🔐 Authentication setup (not yet implemented)');
  }

  private createSampleUserPath(url: string, crawlResult: any): any {
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
        }
      ],
      assertions: [
        {
          id: 'assertion-1',
          type: 'url',
          target: 'page',
          expected: url,
          operator: 'equals',
        }
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

  private async debugCrawler(url: string, options: DebugOptions): Promise<void> {
    console.log('🕷️  Running crawler debug...');
    // TODO: Implement crawler debugging
  }

  private async debugDetector(url: string, options: DebugOptions): Promise<void> {
    console.log('🔍 Running detector debug...');
    // TODO: Implement detector debugging
  }

  private async debugGenerator(url: string, options: DebugOptions): Promise<void> {
    console.log('⚙️  Running generator debug...');
    // TODO: Implement generator debugging
  }
}