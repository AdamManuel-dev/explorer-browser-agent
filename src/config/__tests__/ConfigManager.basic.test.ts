import { test, expect, describe, beforeEach, jest } from '@jest/globals';
import { ConfigManager } from '../ConfigManager';
import { readFile, writeFile } from 'fs/promises';

jest.mock('fs/promises');
jest.mock('../../utils/logger');

describe('ConfigManager Basic Tests', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    configManager = new ConfigManager();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(configManager).toBeInstanceOf(ConfigManager);
    });
  });

  describe('loadConfig', () => {
    it('should load default config when no file exists', async () => {
      (readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      const config = await configManager.loadConfig();

      expect(config).toHaveProperty('app');
      expect(config).toHaveProperty('browser');
      expect(config).toHaveProperty('crawling');
      expect(config).toHaveProperty('detection');
    });
  });

  describe('getConfig', () => {
    it('should throw error if config not loaded', () => {
      expect(() => configManager.getConfig()).toThrow('Configuration not loaded');
    });

    it('should return config after loading', async () => {
      (readFile as jest.Mock).mockRejectedValue(new Error('File not found'));
      
      await configManager.loadConfig();
      const config = configManager.getConfig();

      expect(config).toHaveProperty('app');
    });
  });

  describe('updateConfig', () => {
    it('should update existing config', async () => {
      (readFile as jest.Mock).mockRejectedValue(new Error('File not found'));
      
      await configManager.loadConfig();
      
      configManager.updateConfig({
        browser: {
          headless: false,
          viewport: { width: 1920, height: 1080 },
          timeout: 60000,
        },
      });

      const config = configManager.getConfig();
      expect(config.browser.headless).toBe(false);
      expect(config.browser.viewport.width).toBe(1920);
    });
  });
});