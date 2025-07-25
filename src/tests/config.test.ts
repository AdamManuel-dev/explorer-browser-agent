import { test, expect, describe, beforeEach, jest, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import { ConfigManager } from '../config/ConfigManager';
import { Config } from '../types/config';

jest.mock('../utils/logger');
jest.mock('fs/promises');

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let mockFs: typeof fs;

  beforeEach(() => {
    mockFs = fs as jest.Mocked<typeof fs>;
    configManager = new ConfigManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initialization', () => {
    test('should initialize with default config path', () => {
      expect(configManager).toBeDefined();
    });

    test('should initialize with custom config path', () => {
      const customManager = new ConfigManager('/custom/config.yaml');
      expect(customManager).toBeDefined();
    });
  });

  describe('configuration loading', () => {
    test('should load valid YAML configuration', async () => {
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

      (mockFs.readFile as jest.MockedFunction<typeof fs.readFile>).mockResolvedValue(
        Buffer.from(yamlConfig)
      );

      const config = await configManager.loadConfig();

      expect(config.crawler.maxDepth).toBe(3);
      expect(config.crawler.maxPages).toBe(100);
      expect(config.browser.headless).toBe(true);
      expect(config.generation.framework).toBe('playwright');
    });

    test('should load valid JSON configuration', async () => {
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

      (mockFs.readFile as jest.MockedFunction<typeof fs.readFile>).mockResolvedValue(
        Buffer.from(JSON.stringify(jsonConfig))
      );
      configManager = new ConfigManager('./config.json');

      const config = await configManager.loadConfig();

      expect(config.crawler.maxDepth).toBe(2);
      expect(config.generation.framework).toBe('cypress');
      expect(config.generation.language).toBe('javascript');
    });

    test('should handle missing configuration file', async () => {
      (mockFs.readFile as jest.MockedFunction<typeof fs.readFile>).mockRejectedValue(
        new Error('ENOENT: no such file or directory')
      );

      const config = await configManager.loadConfig();

      // Should return default configuration
      expect(config.crawler.maxDepth).toBe(3);
      expect(config.browser.headless).toBe(true);
      expect(config.generation.framework).toBe('playwright');
    });

    test('should handle invalid YAML syntax', async () => {
      const invalidYaml = `
crawler:
  maxDepth: 3
  maxPages: 100
browser:
headless: true  # Invalid indentation
      `;

      (mockFs.readFile as jest.MockedFunction<typeof fs.readFile>).mockResolvedValue(
        Buffer.from(invalidYaml)
      );

      await expect(configManager.loadConfig()).rejects.toThrow();
    });

    test('should handle invalid JSON syntax', async () => {
      const invalidJson = `{
        "crawler": {
          "maxDepth": 3,
          "maxPages": 100,
        }  // Invalid trailing comma
      }`;

      (mockFs.readFile as jest.MockedFunction<typeof fs.readFile>).mockResolvedValue(
        Buffer.from(invalidJson)
      );
      configManager = new ConfigManager('./config.json');

      await expect(configManager.loadConfig()).rejects.toThrow();
    });
  });

  describe('configuration validation', () => {
    test('should validate correct configuration', () => {
      const validConfig: Config = {
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
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid crawler configuration', () => {
      const invalidConfig: Config = {
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
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('maxDepth'))).toBe(true);
      expect(result.errors.some((e) => e.includes('maxPages'))).toBe(true);
      expect(result.errors.some((e) => e.includes('delay'))).toBe(true);
    });

    test('should detect invalid browser configuration', () => {
      const invalidConfig: Config = {
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
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('userAgent'))).toBe(true);
      expect(result.errors.some((e) => e.includes('timeout'))).toBe(true);
      expect(result.errors.some((e) => e.includes('viewport'))).toBe(true);
    });

    test('should detect invalid generation configuration', () => {
      const invalidConfig: Config = {
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
          framework: 'unsupported' as 'playwright' | 'cypress' | 'puppeteer', // Invalid
          language: 'python' as 'typescript' | 'javascript', // Invalid
          includePageObjects: true,
        },
      };

      const result = configManager.validateConfig(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('outputDir'))).toBe(true);
      expect(result.errors.some((e) => e.includes('framework'))).toBe(true);
      expect(result.errors.some((e) => e.includes('language'))).toBe(true);
    });
  });

  describe('configuration saving', () => {
    test('should save configuration as YAML', async () => {
      const config: Config = {
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

      (mockFs.writeFile as jest.MockedFunction<typeof fs.writeFile>).mockResolvedValue(undefined);

      await configManager.saveConfig(config);

      expect(mockFs.writeFile).toHaveBeenCalled();
      const [filePath, content] = (mockFs.writeFile as jest.MockedFunction<typeof fs.writeFile>)
        .mock.calls[0];
      expect(filePath).toContain('browser-explorer.yaml');
      expect(content).toContain('maxDepth: 5');
      expect(content).toContain('framework: cypress');
    });

    test('should save configuration as JSON', async () => {
      const config: Config = {
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

      configManager = new ConfigManager('./config.json');
      (mockFs.writeFile as jest.MockedFunction<typeof fs.writeFile>).mockResolvedValue(undefined);

      await configManager.saveConfig(config);

      expect(mockFs.writeFile).toHaveBeenCalled();
      const [filePath, content] = (mockFs.writeFile as jest.MockedFunction<typeof fs.writeFile>)
        .mock.calls[0];
      expect(filePath).toContain('config.json');

      const parsedContent = JSON.parse(content);
      expect(parsedContent.crawler.maxDepth).toBe(4);
      expect(parsedContent.generation.framework).toBe('playwright');
    });

    test('should handle file write errors', async () => {
      const config: Config = {
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

      (mockFs.writeFile as jest.MockedFunction<typeof fs.writeFile>).mockRejectedValue(
        new Error('EACCES: permission denied')
      );

      await expect(configManager.saveConfig(config)).rejects.toThrow('EACCES: permission denied');
    });
  });

  describe('environment variable overrides', () => {
    beforeEach(() => {
      // Clear environment variables
      delete process.env.BROWSER_EXPLORER_MAX_DEPTH;
      delete process.env.BROWSER_EXPLORER_MAX_PAGES;
      delete process.env.BROWSER_EXPLORER_HEADLESS;
      delete process.env.BROWSER_EXPLORER_OUTPUT_DIR;
      delete process.env.BROWSER_EXPLORER_FRAMEWORK;
    });

    test('should apply environment variable overrides', async () => {
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

      (mockFs.readFile as jest.MockedFunction<typeof fs.readFile>).mockResolvedValue(
        Buffer.from(yamlConfig)
      );

      const config = await configManager.loadConfig();

      expect(config.crawler.maxDepth).toBe(5);
      expect(config.crawler.maxPages).toBe(250);
      expect(config.browser.headless).toBe(false);
      expect(config.generation.outputDir).toBe('./env-tests');
      expect(config.generation.framework).toBe('cypress');
    });

    test('should handle invalid environment variable values', async () => {
      process.env.BROWSER_EXPLORER_MAX_DEPTH = 'invalid';
      process.env.BROWSER_EXPLORER_HEADLESS = 'maybe';

      const yamlConfig = `
crawler:
  maxDepth: 3

browser:
  headless: true
      `;

      (mockFs.readFile as jest.MockedFunction<typeof fs.readFile>).mockResolvedValue(
        Buffer.from(yamlConfig)
      );

      const config = await configManager.loadConfig();

      // Should fall back to config file values when env vars are invalid
      expect(config.crawler.maxDepth).toBe(3);
      expect(config.browser.headless).toBe(true);
    });
  });

  describe('configuration templates', () => {
    test('should generate default configuration', () => {
      const defaultConfig = configManager.getDefaultConfig();

      expect(defaultConfig.crawler.maxDepth).toBe(3);
      expect(defaultConfig.crawler.maxPages).toBe(100);
      expect(defaultConfig.browser.headless).toBe(true);
      expect(defaultConfig.generation.framework).toBe('playwright');
      expect(defaultConfig.generation.language).toBe('typescript');
    });

    test('should generate minimal configuration', () => {
      const minimalConfig = configManager.getMinimalConfig();

      expect(minimalConfig.crawler.maxDepth).toBe(2);
      expect(minimalConfig.crawler.maxPages).toBe(20);
      expect(minimalConfig.browser.headless).toBe(true);
      expect(minimalConfig.generation.includePageObjects).toBe(false);
    });

    test('should generate comprehensive configuration', () => {
      const comprehensiveConfig = configManager.getComprehensiveConfig();

      expect(comprehensiveConfig.crawler.maxDepth).toBe(5);
      expect(comprehensiveConfig.crawler.maxPages).toBe(500);
      expect(comprehensiveConfig.generation.includePageObjects).toBe(true);
      expect(comprehensiveConfig.detection).toBeDefined();
      expect(comprehensiveConfig.interaction).toBeDefined();
    });

    test('should create configuration file from template', async () => {
      (mockFs.writeFile as jest.MockedFunction<typeof fs.writeFile>).mockResolvedValue(undefined);

      await configManager.createConfigFile('default');

      expect(mockFs.writeFile).toHaveBeenCalled();
      const [filePath, content] = (mockFs.writeFile as jest.MockedFunction<typeof fs.writeFile>)
        .mock.calls[0];
      expect(filePath).toContain('browser-explorer.yaml');
      expect(content).toContain('maxDepth: 3');
    });
  });

  describe('configuration merging', () => {
    test('should merge partial configuration with defaults', () => {
      const partialConfig = {
        crawler: {
          maxDepth: 4,
        },
        generation: {
          framework: 'cypress' as const,
        },
      };

      const mergedConfig = configManager.mergeWithDefaults(partialConfig);

      expect(mergedConfig.crawler.maxDepth).toBe(4);
      expect(mergedConfig.crawler.maxPages).toBe(100); // From defaults
      expect(mergedConfig.generation.framework).toBe('cypress');
      expect(mergedConfig.generation.language).toBe('typescript'); // From defaults
      expect(mergedConfig.browser.headless).toBe(true); // From defaults
    });

    test('should handle nested partial configurations', () => {
      const partialConfig = {
        browser: {
          viewportWidth: 1366,
        },
      };

      const mergedConfig = configManager.mergeWithDefaults(partialConfig);

      expect(mergedConfig.browser.viewportWidth).toBe(1366);
      expect(mergedConfig.browser.viewportHeight).toBe(1080); // From defaults
      expect(mergedConfig.browser.headless).toBe(true); // From defaults
    });
  });

  describe('configuration schema validation', () => {
    test('should validate required fields', () => {
      const incompleteConfig = {
        crawler: {
          maxDepth: 3,
          // Missing required fields
        },
      } as Config;

      const result = configManager.validateConfig(incompleteConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate field types', () => {
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
      } as Config;

      const result = configManager.validateConfig(invalidTypeConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('configuration file detection', () => {
    test('should detect YAML configuration files', () => {
      expect(configManager.isYamlFile('./config.yaml')).toBe(true);
      expect(configManager.isYamlFile('./config.yml')).toBe(true);
      expect(configManager.isYamlFile('./config.json')).toBe(false);
    });

    test('should detect JSON configuration files', () => {
      expect(configManager.isJsonFile('./config.json')).toBe(true);
      expect(configManager.isJsonFile('./config.yaml')).toBe(false);
      expect(configManager.isJsonFile('./config.yml')).toBe(false);
    });
  });
});
