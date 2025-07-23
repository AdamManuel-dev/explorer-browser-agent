"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserExplorer = exports.ConfigManager = exports.TestFileWriter = exports.PageObjectGenerator = exports.TestGenerator = exports.PathOptimizer = exports.UserPathRecorder = exports.TestDataGenerator = exports.InteractionExecutor = exports.AIElementDetector = exports.CrawlerService = exports.BreadthFirstCrawler = exports.BrowserAgent = void 0;
// Main exports for programmatic usage
var BrowserAgent_1 = require("./agents/BrowserAgent");
Object.defineProperty(exports, "BrowserAgent", { enumerable: true, get: function () { return BrowserAgent_1.BrowserAgent; } });
var crawler_1 = require("./crawler");
Object.defineProperty(exports, "BreadthFirstCrawler", { enumerable: true, get: function () { return crawler_1.BreadthFirstCrawler; } });
Object.defineProperty(exports, "CrawlerService", { enumerable: true, get: function () { return crawler_1.CrawlerService; } });
var detectors_1 = require("./detectors");
Object.defineProperty(exports, "AIElementDetector", { enumerable: true, get: function () { return detectors_1.AIElementDetector; } });
var InteractionExecutor_1 = require("./interactions/InteractionExecutor");
Object.defineProperty(exports, "InteractionExecutor", { enumerable: true, get: function () { return InteractionExecutor_1.InteractionExecutor; } });
var TestDataGenerator_1 = require("./interactions/TestDataGenerator");
Object.defineProperty(exports, "TestDataGenerator", { enumerable: true, get: function () { return TestDataGenerator_1.TestDataGenerator; } });
var recording_1 = require("./recording");
Object.defineProperty(exports, "UserPathRecorder", { enumerable: true, get: function () { return recording_1.UserPathRecorder; } });
Object.defineProperty(exports, "PathOptimizer", { enumerable: true, get: function () { return recording_1.PathOptimizer; } });
var generation_1 = require("./generation");
Object.defineProperty(exports, "TestGenerator", { enumerable: true, get: function () { return generation_1.TestGenerator; } });
Object.defineProperty(exports, "PageObjectGenerator", { enumerable: true, get: function () { return generation_1.PageObjectGenerator; } });
Object.defineProperty(exports, "TestFileWriter", { enumerable: true, get: function () { return generation_1.TestFileWriter; } });
var config_1 = require("./config");
Object.defineProperty(exports, "ConfigManager", { enumerable: true, get: function () { return config_1.ConfigManager; } });
// Main integration class for easy usage
class BrowserExplorer {
    configManager;
    crawlerService = null;
    config = null;
    constructor(configPath) {
        this.configManager = new ConfigManager();
    }
    async initialize(configPath) {
        this.config = await this.configManager.loadConfig(configPath);
    }
    async explore(url) {
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
    async cleanup() {
        if (this.crawlerService) {
            await this.crawlerService.cleanup();
        }
    }
    getConfig() {
        return this.config;
    }
}
exports.BrowserExplorer = BrowserExplorer;
//# sourceMappingURL=index.js.map