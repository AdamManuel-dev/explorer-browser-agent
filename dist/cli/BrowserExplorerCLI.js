"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserExplorerCLI = void 0;
const fs = __importStar(require("fs/promises"));
const config_1 = require("../config");
const CrawlerService_1 = require("../crawler/CrawlerService");
// import { AIElementDetector } from '../detectors';
// import { InteractionExecutor } from '../interactions/InteractionExecutor';
// import { UserPathRecorder } from '../recording';
const generation_1 = require("../generation");
const logger_1 = require("../utils/logger");
class BrowserExplorerCLI {
    configManager;
    constructor() {
        this.configManager = new config_1.ConfigManager();
    }
    async crawl(url, options) {
        try {
            this.setupLogging(options.verbose);
            logger_1.logger.info('Starting Browser Explorer crawl', { url, options });
            // Load configuration
            const config = await this.loadConfig(options.config);
            // Override config with CLI options
            this.applyCliOptions(config, options);
            config.crawling.startUrl = url;
            // Initialize crawler service
            const crawlerService = new CrawlerService_1.CrawlerService({
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
            logger_1.logger.info(`🚀 Starting crawl of ${url}`);
            logger_1.logger.info(`📊 Max depth: ${options.maxDepth}, Max pages: ${options.maxPages}`);
            logger_1.logger.info(`📁 Output directory: ${options.output}`);
            const crawlResult = await crawlerService.crawl();
            logger_1.logger.info(`✅ Crawl completed: ${crawlResult.pagesVisited} pages visited`);
            // Generate tests
            const generationOptions = {
                framework: options.framework,
                language: options.language,
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
            const generator = new generation_1.TestGenerator(generationOptions);
            const generationResult = await generator.generate(samplePath);
            // Write test files
            const writer = new generation_1.TestFileWriter(options.output);
            await writer.createProjectStructure();
            await writer.writeFiles(generationResult);
            logger_1.logger.info(`🎉 Test generation completed!`);
            logger_1.logger.info(`📝 Generated ${generationResult.summary.totalFiles} files`);
            logger_1.logger.info(`🧪 Created ${generationResult.summary.totalTests} tests`);
            logger_1.logger.info(`📂 Files saved to: ${options.output}`);
            await crawlerService.cleanup();
        }
        catch (error) {
            logger_1.logger.error('Crawl command failed', error);
            logger_1.logger.error('❌ Crawl failed:', error instanceof Error ? error.message : error);
            process.exit(1);
        }
    }
    async test(url, options) {
        try {
            this.setupLogging(options.verbose);
            logger_1.logger.info('Starting Browser Explorer test', { url, options });
            // Load configuration
            const config = await this.loadConfig(options.config);
            logger_1.logger.info(`🧪 Testing page: ${url}`);
            // Test basic functionality
            const crawlerService = new CrawlerService_1.CrawlerService({
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
            logger_1.logger.info(`✅ Test completed successfully`);
            logger_1.logger.info(`📊 Pages visited: ${result.pagesVisited}`);
            logger_1.logger.info(`⏱️  Duration: ${Math.round(result.duration / 1000)}s`);
            if (result.errors.length > 0) {
                logger_1.logger.warn(`⚠️  Errors encountered: ${result.errors.length}`);
                result.errors.forEach((error) => {
                    logger_1.logger.warn(`   - ${error.url}: ${error.error}`);
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Test command failed', error);
            logger_1.logger.error('❌ Test failed:', error instanceof Error ? error.message : error);
            process.exit(1);
        }
    }
    async init(options) {
        try {
            logger_1.logger.info('🚀 Initializing Browser Explorer project...');
            // Create directory structure
            const directories = ['config', 'generated-tests', 'screenshots', 'reports'];
            for (const dir of directories) {
                await fs.mkdir(dir, { recursive: true });
                logger_1.logger.info(`📁 Created directory: ${dir}`);
            }
            // Create configuration file
            const configPath = 'browser-explorer.config.yaml';
            const configExists = await this.fileExists(configPath);
            if (!configExists || options.force) {
                await this.configManager.createSampleConfig(configPath);
                logger_1.logger.info(`⚙️  Created configuration file: ${configPath}`);
            }
            else {
                logger_1.logger.warn(`⚠️  Configuration file already exists: ${configPath}`);
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
                logger_1.logger.info('📝 Created .gitignore');
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
                logger_1.logger.info('📚 Created README.md');
            }
            logger_1.logger.info('✅ Project initialized successfully!');
            logger_1.logger.info('');
            logger_1.logger.info('Next steps:');
            logger_1.logger.info('1. Edit browser-explorer.config.yaml to configure your settings');
            logger_1.logger.info('2. Run: browser-explorer crawl https://your-website.com');
        }
        catch (error) {
            logger_1.logger.error('Init command failed', error);
            logger_1.logger.error('❌ Initialization failed:', error instanceof Error ? error.message : error);
            process.exit(1);
        }
    }
    async createConfig(options) {
        try {
            const configPath = options.file || 'browser-explorer.config.yaml';
            const exists = await this.fileExists(configPath);
            if (exists && !options.force) {
                logger_1.logger.error(`❌ Configuration file already exists: ${configPath}`);
                logger_1.logger.info('Use --force to overwrite');
                process.exit(1);
            }
            await this.configManager.createSampleConfig(configPath);
            logger_1.logger.info(`✅ Sample configuration created: ${configPath}`);
        }
        catch (error) {
            logger_1.logger.error('Create config command failed', error);
            logger_1.logger.error('❌ Failed to create configuration:', error instanceof Error ? error.message : error);
            process.exit(1);
        }
    }
    async validateConfig(options) {
        try {
            const config = await this.loadConfig(options.config);
            logger_1.logger.info('✅ Configuration is valid');
            logger_1.logger.info(`📁 Start URL: ${config.crawling.startUrl || 'Not set'}`);
            logger_1.logger.info(`🔧 Framework: ${config.generation.framework}`);
            logger_1.logger.info(`💾 Output: ${config.generation.outputDirectory}`);
        }
        catch (error) {
            logger_1.logger.error('Validate config command failed', error);
            logger_1.logger.error('❌ Configuration validation failed:', error instanceof Error ? error.message : error);
            process.exit(1);
        }
    }
    async serve(options) {
        try {
            logger_1.logger.info(`🚀 Starting Browser Explorer server on port ${options.port}...`);
            logger_1.logger.info('❌ Server mode not yet implemented');
            logger_1.logger.info('This feature will provide a REST API for Browser Explorer functionality');
            // TODO: Implement server mode
            process.exit(1);
        }
        catch (error) {
            logger_1.logger.error('Serve command failed', error);
            logger_1.logger.error('❌ Server failed to start:', error instanceof Error ? error.message : error);
            process.exit(1);
        }
    }
    async debug(component, url, options) {
        try {
            this.setupLogging(true); // Always verbose in debug mode
            logger_1.logger.info(`🔍 Debugging ${component} with URL: ${url}`);
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
                    logger_1.logger.error(`❌ Unknown component: ${component}`);
                    logger_1.logger.info('Available components: crawler, detector, generator');
                    process.exit(1);
            }
        }
        catch (error) {
            logger_1.logger.error('Debug command failed', error);
            logger_1.logger.error('❌ Debug failed:', error instanceof Error ? error.message : error);
            process.exit(1);
        }
    }
    async loadConfig(configPath) {
        return this.configManager.loadConfig(configPath);
    }
    setupLogging(verbose) {
        if (verbose) {
            // Set debug level
            logger_1.logger.level = 'debug';
        }
    }
    applyCliOptions(config, options) {
        // Apply CLI overrides to config
        config.crawling.maxDepth = parseInt(options.maxDepth);
        config.crawling.maxPages = parseInt(options.maxPages);
        config.crawling.crawlDelay = parseInt(options.delay);
        config.crawling.parallelWorkers = parseInt(options.workers);
        config.browser.headless = options.headless;
        config.generation.framework = options.framework;
        config.generation.language = options.language;
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
    async setupAuthentication(_crawlerService, _auth) {
        // TODO: Implement authentication setup
        logger_1.logger.info('🔐 Authentication setup (not yet implemented)');
    }
    createSampleUserPath(url, _crawlResult) {
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
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    async debugCrawler(_url, _options) {
        logger_1.logger.info('🕷️  Running crawler debug...');
        // TODO: Implement crawler debugging
    }
    async debugDetector(_url, _options) {
        logger_1.logger.info('🔍 Running detector debug...');
        // TODO: Implement detector debugging
    }
    async debugGenerator(_url, _options) {
        logger_1.logger.info('⚙️  Running generator debug...');
        // TODO: Implement generator debugging
    }
}
exports.BrowserExplorerCLI = BrowserExplorerCLI;
//# sourceMappingURL=BrowserExplorerCLI.js.map