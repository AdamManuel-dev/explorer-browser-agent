import { test, expect, describe, beforeEach, jest } from '@jest/globals';
import { MultiStrategyAuthManager } from '../MultiStrategyAuthManager';
import { Page } from 'playwright';

jest.mock('../../utils/logger');

describe('MultiStrategyAuthManager', () => {
  let authManager: MultiStrategyAuthManager;
  let mockPage: Partial<Page>;

  beforeEach(() => {
    authManager = new MultiStrategyAuthManager();
    
    mockPage = {
      goto: jest.fn(() => Promise.resolve(null)) as any,
      fill: jest.fn(() => Promise.resolve()) as any,
      click: jest.fn(() => Promise.resolve()) as any,
      waitForSelector: jest.fn(() => Promise.resolve(null)) as any,
      url: jest.fn(() => 'https://example.com/dashboard') as any,
      context: jest.fn(() => ({
        cookies: jest.fn(() => Promise.resolve([])),
        addCookies: jest.fn(() => Promise.resolve()),
      })) as any,
    };
  });

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(authManager).toBeInstanceOf(MultiStrategyAuthManager);
    });
  });

  describe('authenticate', () => {
    it('should handle basic authentication', async () => {
      const config = {
        strategy: 'basic' as const,
        loginUrl: 'https://example.com/login',
        credentials: {
          username: 'testuser',
          password: 'password123',
        },
        sessionPersistence: false,
      };

      const result = await authManager.authenticate(mockPage as Page, config);

      expect(result).toHaveProperty('success');
      expect(mockPage.goto).toHaveBeenCalledWith(config.loginUrl);
    });

    it('should handle invalid strategy', async () => {
      const config = {
        strategy: 'invalid' as any,
        credentials: {},
        sessionPersistence: false,
      };

      const result = await authManager.authenticate(mockPage as Page, config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported authentication strategy');
    });
  });

  describe('session management', () => {
    it('should save session when persistence is enabled', async () => {
      const config = {
        strategy: 'basic' as const,
        loginUrl: 'https://example.com/login',
        credentials: {
          username: 'testuser',
          password: 'password123',
        },
        sessionPersistence: true,
        cookieFile: 'test-cookies.json',
      };

      await authManager.authenticate(mockPage as Page, config);

      expect(mockPage.context).toHaveBeenCalled();
    });
  });
});