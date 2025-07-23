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
exports.ConfigManager = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const yaml = __importStar(require("yaml"));
const logger_1 = require("../utils/logger");
class ConfigManager {
    config = null;
    configPath = null;
    async loadConfig(configPath) {
        if (configPath) {
            this.configPath = configPath;
        }
        else {
            // Look for config files in common locations
            this.configPath = await this.findConfigFile();
        }
        if (this.configPath) {
            this.config = await this.loadFromFile(this.configPath);
        }
        else {
            this.config = this.getDefaultConfig();
            logger_1.logger.warn('No config file found, using defaults');
        }
        // Override with environment variables
        this.config = this.applyEnvironmentOverrides(this.config);
        // Validate configuration
        this.validateConfig(this.config);
        logger_1.logger.info('Configuration loaded', {
            source: this.configPath || 'defaults',
            environment: this.config.app.environment,
        });
        return this.config;
    }
    getConfig() {
        if (!this.config) {
            throw new Error('Configuration not loaded. Call loadConfig() first.');
        }
        return this.config;
    }
    async saveConfig(config, filePath) {
        const savePath = filePath || this.configPath || 'browser-explorer.config.yaml';
        const configData = yaml.stringify(config, {
            indent: 2,
            lineWidth: 120,
            minContentWidth: 40,
        });
        await fs.writeFile(savePath, configData, 'utf8');
        logger_1.logger.info('Configuration saved', { path: savePath });
    }
    updateConfig(updates) {
        if (!this.config) {
            throw new Error('Configuration not loaded');
        }
        this.config = this.deepMerge(this.config, updates);
        this.validateConfig(this.config);
    }
    async findConfigFile() {
        const possiblePaths = [
            'browser-explorer.config.yaml',
            'browser-explorer.config.yml',
            'browser-explorer.config.json',
            '.browser-explorer.yaml',
            '.browser-explorer.yml',
            '.browser-explorer.json',
            'config/browser-explorer.yaml',
            'config/browser-explorer.yml',
            'config/browser-explorer.json',
        ];
        for (const configPath of possiblePaths) {
            try {
                await fs.access(configPath);
                return configPath;
            }
            catch {
                // File doesn't exist, continue
            }
        }
        return null;
    }
    async loadFromFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const extension = path.extname(filePath);
            let parsed;
            if (extension === '.json') {
                parsed = JSON.parse(content);
            }
            else if (extension === '.yaml' || extension === '.yml') {
                parsed = yaml.parse(content);
            }
            else {
                throw new Error(`Unsupported config file format: ${extension}`);
            }
            return this.deepMerge(this.getDefaultConfig(), parsed);
        }
        catch (error) {
            logger_1.logger.error('Failed to load config file', { filePath, error });
            throw new Error(`Failed to load config from ${filePath}: ${error}`);
        }
    }
    applyEnvironmentOverrides(config) {
        const overrides = {};
        // App settings
        if (process.env.NODE_ENV) {
            overrides.app = {
                ...config.app,
                environment: process.env.NODE_ENV,
            };
        }
        if (process.env.LOG_LEVEL) {
            overrides.app = {
                ...overrides.app,
                ...config.app,
                logLevel: process.env.LOG_LEVEL,
            };
        }
        // Crawling settings
        if (process.env.START_URL) {
            overrides.crawling = {
                ...config.crawling,
                startUrl: process.env.START_URL,
            };
        }
        if (process.env.MAX_DEPTH) {
            overrides.crawling = {
                ...overrides.crawling,
                ...config.crawling,
                maxDepth: parseInt(process.env.MAX_DEPTH),
            };
        }
        if (process.env.MAX_PAGES) {
            overrides.crawling = {
                ...overrides.crawling,
                ...config.crawling,
                maxPages: parseInt(process.env.MAX_PAGES),
            };
        }
        // Browser settings
        if (process.env.HEADLESS_MODE) {
            overrides.browser = {
                ...config.browser,
                headless: process.env.HEADLESS_MODE === 'true',
            };
        }
        // Database
        if (process.env.DATABASE_URL) {
            overrides.database = {
                ...config.database,
                url: process.env.DATABASE_URL,
            };
        }
        // Redis
        if (process.env.REDIS_URL) {
            overrides.redis = {
                ...config.redis,
                url: process.env.REDIS_URL,
            };
        }
        // API Keys
        if (process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY) {
            overrides.apiKeys = {
                ...config.apiKeys,
                openai: process.env.OPENAI_API_KEY,
                anthropic: process.env.ANTHROPIC_API_KEY,
            };
        }
        // Output directory
        if (process.env.OUTPUT_DIRECTORY) {
            overrides.generation = {
                ...config.generation,
                outputDirectory: process.env.OUTPUT_DIRECTORY,
            };
        }
        return this.deepMerge(config, overrides);
    }
    validateConfig(config) {
        const errors = [];
        // Validate required fields
        if (!config.crawling.startUrl && process.env.NODE_ENV !== 'test') {
            errors.push('crawling.startUrl is required');
        }
        if (config.crawling.maxDepth < 1) {
            errors.push('crawling.maxDepth must be at least 1');
        }
        if (config.crawling.maxPages < 1) {
            errors.push('crawling.maxPages must be at least 1');
        }
        if (config.browser.viewport.width < 100 || config.browser.viewport.height < 100) {
            errors.push('browser.viewport dimensions must be at least 100x100');
        }
        // Validate authentication
        if (config.authentication?.enabled) {
            if (!config.authentication.strategy) {
                errors.push('authentication.strategy is required when authentication is enabled');
            }
            if (config.authentication.strategy === 'basic' &&
                (!config.authentication.credentials?.username ||
                    !config.authentication.credentials?.password)) {
                errors.push('authentication.credentials.username and password are required for basic auth');
            }
        }
        // Validate AI detection
        if (config.detection.enableAI && !config.apiKeys?.openai && !config.apiKeys?.anthropic) {
            errors.push('API key required when AI detection is enabled');
        }
        if (errors.length > 0) {
            throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
        }
    }
    getDefaultConfig() {
        return {
            app: {
                name: 'Browser Explorer',
                version: '1.0.0',
                environment: 'development',
                logLevel: 'info',
            },
            crawling: {
                maxDepth: 3,
                maxPages: 100,
                crawlDelay: 1000,
                parallelWorkers: 5,
                allowedDomains: [],
                excludePatterns: [],
                respectRobotsTxt: true,
                userAgent: 'BrowserExplorer/1.0',
            },
            browser: {
                headless: true,
                viewport: {
                    width: 1920,
                    height: 1080,
                },
                timeout: 30000,
            },
            detection: {
                enableAI: true,
                enableTraditional: true,
                timeout: 30000,
                retryAttempts: 3,
            },
            generation: {
                framework: 'playwright',
                language: 'typescript',
                outputDirectory: './generated-tests',
                generatePageObjects: true,
                generateFixtures: false,
                generateHelpers: false,
                useAAAPattern: true,
                addComments: true,
                testNamingConvention: 'describe-it',
                formatting: {
                    indent: '  ',
                    quotes: 'single',
                    semicolons: true,
                    trailingComma: true,
                    lineWidth: 100,
                },
            },
            authentication: {
                enabled: false,
                strategy: 'basic',
                sessionPersistence: true,
            },
        };
    }
    deepMerge(target, source) {
        const result = { ...target };
        for (const key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                const sourceValue = source[key];
                const targetValue = result[key];
                if (sourceValue !== undefined) {
                    if (this.isObject(sourceValue) && this.isObject(targetValue)) {
                        result[key] = this.deepMerge(targetValue, sourceValue);
                    }
                    else {
                        result[key] = sourceValue;
                    }
                }
            }
        }
        return result;
    }
    isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }
    async createSampleConfig(filePath = 'browser-explorer.config.yaml') {
        const sampleConfig = this.getDefaultConfig();
        // Add sample values and comments
        sampleConfig.crawling.startUrl = 'https://example.com';
        sampleConfig.crawling.allowedDomains = ['example.com'];
        sampleConfig.authentication = {
            enabled: false,
            strategy: 'basic',
            loginUrl: 'https://example.com/login',
            credentials: {
                username: 'your-username',
                password: 'your-password',
            },
            sessionPersistence: true,
        };
        await this.saveConfig(sampleConfig, filePath);
        logger_1.logger.info('Sample configuration created', { path: filePath });
    }
}
exports.ConfigManager = ConfigManager;
//# sourceMappingURL=ConfigManager.js.map