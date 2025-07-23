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
const globals_1 = require("@jest/globals");
const fs = __importStar(require("fs/promises"));
const ConfigManager_1 = require("../config/ConfigManager");
globals_1.jest.mock('../utils/logger');
globals_1.jest.mock('fs/promises');
(0, globals_1.describe)('ConfigManager', () => {
    let configManager;
    let mockFs;
    (0, globals_1.beforeEach)(() => {
        mockFs = fs;
        configManager = new ConfigManager_1.ConfigManager();
        globals_1.jest.clearAllMocks();
    });
    (0, globals_1.afterEach)(() => {
        globals_1.jest.restoreAllMocks();
    });
    (0, globals_1.describe)('initialization', () => {
        (0, globals_1.test)('should initialize with default config path', () => {
            (0, globals_1.expect)(configManager).toBeDefined();
        });
        (0, globals_1.test)('should initialize with custom config path', () => {
            const customManager = new ConfigManager_1.ConfigManager('/custom/config.yaml');
            (0, globals_1.expect)(customManager).toBeDefined();
        });
    });
    (0, globals_1.describe)('configuration loading', () => {
        (0, globals_1.test)('should load valid YAML configuration', async () => {
            const yamlConfig = `
crawler:
  maxDepth: 3
  maxPages: 100
  delay: 1000
  respectRobots: true
  sameDomain: true

browser:
  headless: true
  userAgent: "BrowserExplorer/1.0"
  timeout: 30000
  viewportWidth: 1920
  viewportHeight: 1080

generation:
  outputDir: "./tests"
  framework: "playwright"
  language: "typescript"
  includePageObjects: true
      `;
            mockFs.readFile.mockResolvedValue(yamlConfig);
            const config = await configManager.loadConfig();
            (0, globals_1.expect)(config.crawler.maxDepth).toBe(3);
            (0, globals_1.expect)(config.crawler.maxPages).toBe(100);
            (0, globals_1.expect)(config.browser.headless).toBe(true);
            (0, globals_1.expect)(config.generation.framework).toBe('playwright');
        });
        (0, globals_1.test)('should load valid JSON configuration', async () => {
            const jsonConfig = {
                crawler: {
                    maxDepth: 2,
                    maxPages: 50,
                    delay: 500,
                    respectRobots: false,
                    sameDomain: true,
                },
                browser: {
                    headless: false,
                    userAgent: 'Custom Agent',
                    timeout: 20000,
                    viewportWidth: 1366,
                    viewportHeight: 768,
                },
                generation: {
                    outputDir: './e2e-tests',
                    framework: 'cypress',
                    language: 'javascript',
                    includePageObjects: false,
                },
            };
            mockFs.readFile.mockResolvedValue(JSON.stringify(jsonConfig));
            configManager = new ConfigManager_1.ConfigManager('./config.json');
            const config = await configManager.loadConfig();
            (0, globals_1.expect)(config.crawler.maxDepth).toBe(2);
            (0, globals_1.expect)(config.generation.framework).toBe('cypress');
            (0, globals_1.expect)(config.generation.language).toBe('javascript');
        });
        (0, globals_1.test)('should handle missing configuration file', async () => {
            mockFs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));
            const config = await configManager.loadConfig();
            // Should return default configuration
            (0, globals_1.expect)(config.crawler.maxDepth).toBe(3);
            (0, globals_1.expect)(config.browser.headless).toBe(true);
            (0, globals_1.expect)(config.generation.framework).toBe('playwright');
        });
        (0, globals_1.test)('should handle invalid YAML syntax', async () => {
            const invalidYaml = `
crawler:
  maxDepth: 3
  maxPages: 100
browser:
headless: true  # Invalid indentation
      `;
            mockFs.readFile.mockResolvedValue(invalidYaml);
            await (0, globals_1.expect)(configManager.loadConfig()).rejects.toThrow();
        });
        (0, globals_1.test)('should handle invalid JSON syntax', async () => {
            const invalidJson = `{
        "crawler": {
          "maxDepth": 3,
          "maxPages": 100,
        }  // Invalid trailing comma
      }`;
            mockFs.readFile.mockResolvedValue(invalidJson);
            configManager = new ConfigManager_1.ConfigManager('./config.json');
            await (0, globals_1.expect)(configManager.loadConfig()).rejects.toThrow();
        });
    });
    (0, globals_1.describe)('configuration validation', () => {
        (0, globals_1.test)('should validate correct configuration', () => {
            const validConfig = {
                crawler: {
                    maxDepth: 3,
                    maxPages: 100,
                    delay: 1000,
                    respectRobots: true,
                    sameDomain: true,
                },
                browser: {
                    headless: true,
                    userAgent: 'BrowserExplorer/1.0',
                    timeout: 30000,
                    viewportWidth: 1920,
                    viewportHeight: 1080,
                },
                generation: {
                    outputDir: './tests',
                    framework: 'playwright',
                    language: 'typescript',
                    includePageObjects: true,
                },
            };
            const result = configManager.validateConfig(validConfig);
            (0, globals_1.expect)(result.isValid).toBe(true);
            (0, globals_1.expect)(result.errors).toHaveLength(0);
        });
        (0, globals_1.test)('should detect invalid crawler configuration', () => {
            const invalidConfig = {
                crawler: {
                    maxDepth: -1, // Invalid
                    maxPages: 0, // Invalid
                    delay: -500, // Invalid
                    respectRobots: true,
                    sameDomain: true,
                },
                browser: {
                    headless: true,
                    userAgent: 'BrowserExplorer/1.0',
                    timeout: 30000,
                    viewportWidth: 1920,
                    viewportHeight: 1080,
                },
                generation: {
                    outputDir: './tests',
                    framework: 'playwright',
                    language: 'typescript',
                    includePageObjects: true,
                },
            };
            const result = configManager.validateConfig(invalidConfig);
            (0, globals_1.expect)(result.isValid).toBe(false);
            (0, globals_1.expect)(result.errors.length).toBeGreaterThan(0);
            (0, globals_1.expect)(result.errors.some((e) => e.includes('maxDepth'))).toBe(true);
            (0, globals_1.expect)(result.errors.some((e) => e.includes('maxPages'))).toBe(true);
            (0, globals_1.expect)(result.errors.some((e) => e.includes('delay'))).toBe(true);
        });
        (0, globals_1.test)('should detect invalid browser configuration', () => {
            const invalidConfig = {
                crawler: {
                    maxDepth: 3,
                    maxPages: 100,
                    delay: 1000,
                    respectRobots: true,
                    sameDomain: true,
                },
                browser: {
                    headless: true,
                    userAgent: '', // Invalid
                    timeout: -1000, // Invalid
                    viewportWidth: 0, // Invalid
                    viewportHeight: -100, // Invalid
                },
                generation: {
                    outputDir: './tests',
                    framework: 'playwright',
                    language: 'typescript',
                    includePageObjects: true,
                },
            };
            const result = configManager.validateConfig(invalidConfig);
            (0, globals_1.expect)(result.isValid).toBe(false);
            (0, globals_1.expect)(result.errors.some((e) => e.includes('userAgent'))).toBe(true);
            (0, globals_1.expect)(result.errors.some((e) => e.includes('timeout'))).toBe(true);
            (0, globals_1.expect)(result.errors.some((e) => e.includes('viewport'))).toBe(true);
        });
        (0, globals_1.test)('should detect invalid generation configuration', () => {
            const invalidConfig = {
                crawler: {
                    maxDepth: 3,
                    maxPages: 100,
                    delay: 1000,
                    respectRobots: true,
                    sameDomain: true,
                },
                browser: {
                    headless: true,
                    userAgent: 'BrowserExplorer/1.0',
                    timeout: 30000,
                    viewportWidth: 1920,
                    viewportHeight: 1080,
                },
                generation: {
                    outputDir: '', // Invalid
                    framework: 'unsupported', // Invalid
                    language: 'python', // Invalid
                    includePageObjects: true,
                },
            };
            const result = configManager.validateConfig(invalidConfig);
            (0, globals_1.expect)(result.isValid).toBe(false);
            (0, globals_1.expect)(result.errors.some((e) => e.includes('outputDir'))).toBe(true);
            (0, globals_1.expect)(result.errors.some((e) => e.includes('framework'))).toBe(true);
            (0, globals_1.expect)(result.errors.some((e) => e.includes('language'))).toBe(true);
        });
    });
    (0, globals_1.describe)('configuration saving', () => {
        (0, globals_1.test)('should save configuration as YAML', async () => {
            const config = {
                crawler: {
                    maxDepth: 5,
                    maxPages: 200,
                    delay: 2000,
                    respectRobots: false,
                    sameDomain: false,
                },
                browser: {
                    headless: false,
                    userAgent: 'CustomAgent/2.0',
                    timeout: 45000,
                    viewportWidth: 1366,
                    viewportHeight: 768,
                },
                generation: {
                    outputDir: './custom-tests',
                    framework: 'cypress',
                    language: 'javascript',
                    includePageObjects: false,
                },
            };
            mockFs.writeFile.mockResolvedValue(undefined);
            await configManager.saveConfig(config);
            (0, globals_1.expect)(mockFs.writeFile).toHaveBeenCalled();
            const [filePath, content] = mockFs.writeFile.mock.calls[0];
            (0, globals_1.expect)(filePath).toContain('browser-explorer.yaml');
            (0, globals_1.expect)(content).toContain('maxDepth: 5');
            (0, globals_1.expect)(content).toContain('framework: cypress');
        });
        (0, globals_1.test)('should save configuration as JSON', async () => {
            const config = {
                crawler: {
                    maxDepth: 4,
                    maxPages: 150,
                    delay: 1500,
                    respectRobots: true,
                    sameDomain: true,
                },
                browser: {
                    headless: true,
                    userAgent: 'TestAgent/1.0',
                    timeout: 25000,
                    viewportWidth: 1440,
                    viewportHeight: 900,
                },
                generation: {
                    outputDir: './json-tests',
                    framework: 'playwright',
                    language: 'typescript',
                    includePageObjects: true,
                },
            };
            configManager = new ConfigManager_1.ConfigManager('./config.json');
            mockFs.writeFile.mockResolvedValue(undefined);
            await configManager.saveConfig(config);
            (0, globals_1.expect)(mockFs.writeFile).toHaveBeenCalled();
            const [filePath, content] = mockFs.writeFile.mock.calls[0];
            (0, globals_1.expect)(filePath).toContain('config.json');
            const parsedContent = JSON.parse(content);
            (0, globals_1.expect)(parsedContent.crawler.maxDepth).toBe(4);
            (0, globals_1.expect)(parsedContent.generation.framework).toBe('playwright');
        });
        (0, globals_1.test)('should handle file write errors', async () => {
            const config = {
                crawler: {
                    maxDepth: 3,
                    maxPages: 100,
                    delay: 1000,
                    respectRobots: true,
                    sameDomain: true,
                },
                browser: {
                    headless: true,
                    userAgent: 'BrowserExplorer/1.0',
                    timeout: 30000,
                    viewportWidth: 1920,
                    viewportHeight: 1080,
                },
                generation: {
                    outputDir: './tests',
                    framework: 'playwright',
                    language: 'typescript',
                    includePageObjects: true,
                },
            };
            mockFs.writeFile.mockRejectedValue(new Error('EACCES: permission denied'));
            await (0, globals_1.expect)(configManager.saveConfig(config)).rejects.toThrow('EACCES: permission denied');
        });
    });
    (0, globals_1.describe)('environment variable overrides', () => {
        (0, globals_1.beforeEach)(() => {
            // Clear environment variables
            delete process.env.BROWSER_EXPLORER_MAX_DEPTH;
            delete process.env.BROWSER_EXPLORER_MAX_PAGES;
            delete process.env.BROWSER_EXPLORER_HEADLESS;
            delete process.env.BROWSER_EXPLORER_OUTPUT_DIR;
            delete process.env.BROWSER_EXPLORER_FRAMEWORK;
        });
        (0, globals_1.test)('should apply environment variable overrides', async () => {
            process.env.BROWSER_EXPLORER_MAX_DEPTH = '5';
            process.env.BROWSER_EXPLORER_MAX_PAGES = '250';
            process.env.BROWSER_EXPLORER_HEADLESS = 'false';
            process.env.BROWSER_EXPLORER_OUTPUT_DIR = './env-tests';
            process.env.BROWSER_EXPLORER_FRAMEWORK = 'cypress';
            const yamlConfig = `
crawler:
  maxDepth: 3
  maxPages: 100

browser:
  headless: true

generation:
  outputDir: "./tests"
  framework: "playwright"
      `;
            mockFs.readFile.mockResolvedValue(yamlConfig);
            const config = await configManager.loadConfig();
            (0, globals_1.expect)(config.crawler.maxDepth).toBe(5);
            (0, globals_1.expect)(config.crawler.maxPages).toBe(250);
            (0, globals_1.expect)(config.browser.headless).toBe(false);
            (0, globals_1.expect)(config.generation.outputDir).toBe('./env-tests');
            (0, globals_1.expect)(config.generation.framework).toBe('cypress');
        });
        (0, globals_1.test)('should handle invalid environment variable values', async () => {
            process.env.BROWSER_EXPLORER_MAX_DEPTH = 'invalid';
            process.env.BROWSER_EXPLORER_HEADLESS = 'maybe';
            const yamlConfig = `
crawler:
  maxDepth: 3

browser:
  headless: true
      `;
            mockFs.readFile.mockResolvedValue(yamlConfig);
            const config = await configManager.loadConfig();
            // Should fall back to config file values when env vars are invalid
            (0, globals_1.expect)(config.crawler.maxDepth).toBe(3);
            (0, globals_1.expect)(config.browser.headless).toBe(true);
        });
    });
    (0, globals_1.describe)('configuration templates', () => {
        (0, globals_1.test)('should generate default configuration', () => {
            const defaultConfig = configManager.getDefaultConfig();
            (0, globals_1.expect)(defaultConfig.crawler.maxDepth).toBe(3);
            (0, globals_1.expect)(defaultConfig.crawler.maxPages).toBe(100);
            (0, globals_1.expect)(defaultConfig.browser.headless).toBe(true);
            (0, globals_1.expect)(defaultConfig.generation.framework).toBe('playwright');
            (0, globals_1.expect)(defaultConfig.generation.language).toBe('typescript');
        });
        (0, globals_1.test)('should generate minimal configuration', () => {
            const minimalConfig = configManager.getMinimalConfig();
            (0, globals_1.expect)(minimalConfig.crawler.maxDepth).toBe(2);
            (0, globals_1.expect)(minimalConfig.crawler.maxPages).toBe(20);
            (0, globals_1.expect)(minimalConfig.browser.headless).toBe(true);
            (0, globals_1.expect)(minimalConfig.generation.includePageObjects).toBe(false);
        });
        (0, globals_1.test)('should generate comprehensive configuration', () => {
            const comprehensiveConfig = configManager.getComprehensiveConfig();
            (0, globals_1.expect)(comprehensiveConfig.crawler.maxDepth).toBe(5);
            (0, globals_1.expect)(comprehensiveConfig.crawler.maxPages).toBe(500);
            (0, globals_1.expect)(comprehensiveConfig.generation.includePageObjects).toBe(true);
            (0, globals_1.expect)(comprehensiveConfig.detection).toBeDefined();
            (0, globals_1.expect)(comprehensiveConfig.interaction).toBeDefined();
        });
        (0, globals_1.test)('should create configuration file from template', async () => {
            mockFs.writeFile.mockResolvedValue(undefined);
            await configManager.createConfigFile('default');
            (0, globals_1.expect)(mockFs.writeFile).toHaveBeenCalled();
            const [filePath, content] = mockFs.writeFile.mock.calls[0];
            (0, globals_1.expect)(filePath).toContain('browser-explorer.yaml');
            (0, globals_1.expect)(content).toContain('maxDepth: 3');
        });
    });
    (0, globals_1.describe)('configuration merging', () => {
        (0, globals_1.test)('should merge partial configuration with defaults', () => {
            const partialConfig = {
                crawler: {
                    maxDepth: 4,
                },
                generation: {
                    framework: 'cypress',
                },
            };
            const mergedConfig = configManager.mergeWithDefaults(partialConfig);
            (0, globals_1.expect)(mergedConfig.crawler.maxDepth).toBe(4);
            (0, globals_1.expect)(mergedConfig.crawler.maxPages).toBe(100); // From defaults
            (0, globals_1.expect)(mergedConfig.generation.framework).toBe('cypress');
            (0, globals_1.expect)(mergedConfig.generation.language).toBe('typescript'); // From defaults
            (0, globals_1.expect)(mergedConfig.browser.headless).toBe(true); // From defaults
        });
        (0, globals_1.test)('should handle nested partial configurations', () => {
            const partialConfig = {
                browser: {
                    viewportWidth: 1366,
                },
            };
            const mergedConfig = configManager.mergeWithDefaults(partialConfig);
            (0, globals_1.expect)(mergedConfig.browser.viewportWidth).toBe(1366);
            (0, globals_1.expect)(mergedConfig.browser.viewportHeight).toBe(1080); // From defaults
            (0, globals_1.expect)(mergedConfig.browser.headless).toBe(true); // From defaults
        });
    });
    (0, globals_1.describe)('configuration schema validation', () => {
        (0, globals_1.test)('should validate required fields', () => {
            const incompleteConfig = {
                crawler: {
                    maxDepth: 3,
                    // Missing required fields
                },
            };
            const result = configManager.validateConfig(incompleteConfig);
            (0, globals_1.expect)(result.isValid).toBe(false);
            (0, globals_1.expect)(result.errors.length).toBeGreaterThan(0);
        });
        (0, globals_1.test)('should validate field types', () => {
            const invalidTypeConfig = {
                crawler: {
                    maxDepth: '3', // Should be number
                    maxPages: 100,
                    delay: 1000,
                    respectRobots: 'yes', // Should be boolean
                    sameDomain: true,
                },
                browser: {
                    headless: true,
                    userAgent: 123, // Should be string
                    timeout: '30000', // Should be number
                    viewportWidth: 1920,
                    viewportHeight: 1080,
                },
                generation: {
                    outputDir: './tests',
                    framework: 'playwright',
                    language: 'typescript',
                    includePageObjects: true,
                },
            };
            const result = configManager.validateConfig(invalidTypeConfig);
            (0, globals_1.expect)(result.isValid).toBe(false);
            (0, globals_1.expect)(result.errors.length).toBeGreaterThan(0);
        });
    });
    (0, globals_1.describe)('configuration file detection', () => {
        (0, globals_1.test)('should detect YAML configuration files', () => {
            (0, globals_1.expect)(configManager.isYamlFile('./config.yaml')).toBe(true);
            (0, globals_1.expect)(configManager.isYamlFile('./config.yml')).toBe(true);
            (0, globals_1.expect)(configManager.isYamlFile('./config.json')).toBe(false);
        });
        (0, globals_1.test)('should detect JSON configuration files', () => {
            (0, globals_1.expect)(configManager.isJsonFile('./config.json')).toBe(true);
            (0, globals_1.expect)(configManager.isJsonFile('./config.yaml')).toBe(false);
            (0, globals_1.expect)(configManager.isJsonFile('./config.yml')).toBe(false);
        });
    });
    (0, globals_1.describe)('configuration watching', () => {
        (0, globals_1.test)('should set up file watcher for configuration changes', async () => {
            const mockWatcher = {
                on: globals_1.jest.fn(),
                close: globals_1.jest.fn(),
            };
            // Mock fs.watch
            const originalWatch = fs.watch;
            fs.watch = globals_1.jest.fn().mockReturnValue(mockWatcher);
            const changeHandler = globals_1.jest.fn();
            await configManager.watchConfig(changeHandler);
            (0, globals_1.expect)(mockWatcher.on).toHaveBeenCalledWith('change', globals_1.expect.any(Function));
            // Restore original
            fs.watch = originalWatch;
        });
    });
});
//# sourceMappingURL=config.test.js.map