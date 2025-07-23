import { ConfigManager, BrowserExplorerConfig } from '../ConfigManager';
import * as fs from 'fs/promises';

jest.mock('fs/promises');
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    configManager = new ConfigManager();
    jest.clearAllMocks();
  });

  describe('getDefaultConfig', () => {
    it('should return default configuration', () => {
      const defaultConfig = configManager.getDefaultConfig();

      expect(defaultConfig).toEqual({
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
          parallelWorkers: 3,
          allowedDomains: [],
          excludePatterns: ['*.pdf', '*.jpg', '*.jpeg', '*.png', '*.gif', '*.css', '*.js', '*.ico'],
          respectRobotsTxt: true,
          userAgent: 'BrowserExplorer/1.0.0 (+https://github.com/yourorg/browser-explorer)',
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
          enableAI: false,
          enableTraditional: true,
          timeout: 5000,
          retryAttempts: 3,
        },
        generation: {
          framework: 'playwright',
          language: 'typescript',
          outputDirectory: './generated-tests',
          testPatterns: {
            navigation: true,
            forms: true,
            interactions: true,
            validation: true,
          },
        },
        auth: {
          enabled: false,
          strategy: 'none',
          sessionPersistence: false,
        },
        monitoring: {
          enabled: true,
          metricsInterval: 30000,
          retentionDays: 7,
        },
        stealth: {
          enabled: false,
          userAgentRotation: false,
          headerRandomization: false,
          behaviorMimicking: false,
        },
        captcha: {
          enabled: false,
          provider: 'manual',
        },
      });
    });
  });

  describe('validateConfig', () => {
    it('should pass validation for valid config', () => {
      const validConfig = configManager.getDefaultConfig();
      validConfig.crawling.startUrl = 'https://example.com';

      expect(() => configManager.validateConfig(validConfig)).not.toThrow();
    });

    it('should fail validation for missing required fields', () => {
      const invalidConfig = configManager.getDefaultConfig();
      invalidConfig.crawling.startUrl = undefined;

      // Set NODE_ENV to non-test to trigger validation
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      expect(() => configManager.validateConfig(invalidConfig)).toThrow(
        'Configuration validation failed'
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should fail validation for invalid values', () => {
      const invalidConfig = configManager.getDefaultConfig();
      invalidConfig.crawling.maxDepth = -1;

      expect(() => configManager.validateConfig(invalidConfig)).toThrow(
        'Configuration validation failed'
      );
    });

    it('should fail validation for invalid browser timeout', () => {
      const invalidConfig = configManager.getDefaultConfig();
      invalidConfig.browser.timeout = 0;

      expect(() => configManager.validateConfig(invalidConfig)).toThrow(
        'Configuration validation failed'
      );
    });

    it('should fail validation for invalid detection timeout', () => {
      const invalidConfig = configManager.getDefaultConfig();
      invalidConfig.detection.timeout = -1;

      expect(() => configManager.validateConfig(invalidConfig)).toThrow(
        'Configuration validation failed'
      );
    });

    it('should fail validation for empty output directory', () => {
      const invalidConfig = configManager.getDefaultConfig();
      invalidConfig.generation.outputDirectory = '';

      expect(() => configManager.validateConfig(invalidConfig)).toThrow(
        'Configuration validation failed'
      );
    });
  });

  describe('loadConfig', () => {
    it('should load config from existing file', async () => {
      const mockConfig: Partial<BrowserExplorerConfig> = {
        app: { name: 'Custom App', version: '2.0.0', environment: 'production', logLevel: 'error' },
      };

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      const config = await configManager.loadConfig('test-config.json');

      expect(config.app.name).toBe('Custom App');
      expect(config.app.version).toBe('2.0.0');
      expect(config.app.environment).toBe('production');
      expect(config.crawling).toBeDefined(); // Should merge with defaults
    });

    it('should return default config when no file found', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      const config = await configManager.loadConfig();

      expect(config).toEqual(configManager.getDefaultConfig());
    });

    it('should handle invalid JSON files', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('invalid json');

      await expect(configManager.loadConfig('invalid.json')).rejects.toThrow(
        'Failed to load config'
      );
    });

    it('should handle YAML files', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('app:\n  name: YAML App');

      const config = await configManager.loadConfig('test-config.yaml');

      expect(config.app.name).toBe('YAML App');
    });
  });

  describe('getConfig', () => {
    it('should return current config', () => {
      const config = configManager.getConfig();

      expect(config).toEqual(configManager.getDefaultConfig());
    });
  });

  describe('saveConfig', () => {
    it('should save config to file', async () => {
      const config = configManager.getDefaultConfig();
      config.app.name = 'Saved App';

      mockFs.writeFile.mockResolvedValue(undefined);

      await configManager.saveConfig(config, 'output.json');

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        'output.json',
        expect.stringContaining('"name": "Saved App"'),
        'utf8'
      );
    });

    it('should handle save errors', async () => {
      const config = configManager.getDefaultConfig();
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));

      await expect(configManager.saveConfig(config, 'error.json')).rejects.toThrow(
        'Failed to save config'
      );
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const updates = {
        app: { name: 'Updated App' },
        crawling: { maxDepth: 5 },
      };

      configManager.updateConfig(updates);
      const updatedConfig = configManager.getConfig();

      expect(updatedConfig.app.name).toBe('Updated App');
      expect(updatedConfig.crawling.maxDepth).toBe(5);
      expect(updatedConfig.browser).toBeDefined(); // Should keep other properties
    });
  });

  describe('createSampleConfig', () => {
    it('should create sample config file', async () => {
      mockFs.writeFile.mockResolvedValue(undefined);

      await configManager.createSampleConfig('sample.yaml');

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        'sample.yaml',
        expect.stringContaining('# Browser Explorer Configuration'),
        'utf8'
      );
    });

    it('should handle creation errors', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Creation failed'));

      await expect(configManager.createSampleConfig('error.yaml')).rejects.toThrow(
        'Failed to create sample config'
      );
    });
  });
});
