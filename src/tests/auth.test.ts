import { test, expect, describe, beforeEach, vi, MockedFunction } from '@jest/globals';
import { Page, BrowserContext } from 'playwright';
import { MultiStrategyAuthManager, AuthConfig, AuthCredentials } from '../auth/MultiStrategyAuthManager';
import { logger } from '../utils/logger';

vi.mock('../utils/logger');

describe('MultiStrategyAuthManager', () => {
  let authManager: MultiStrategyAuthManager;
  let mockPage: Partial<Page>;
  let mockContext: Partial<BrowserContext>;

  beforeEach(() => {
    authManager = new MultiStrategyAuthManager();
    
    mockContext = {
      cookies: vi.fn().mockResolvedValue([]),
      addCookies: vi.fn().mockResolvedValue(undefined),
      clearCookies: vi.fn().mockResolvedValue(undefined),
    };

    mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      fill: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      waitForNavigation: vi.fn().mockResolvedValue(undefined),
      waitForURL: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue('https://example.com/dashboard'),
      locator: vi.fn().mockReturnValue({
        isVisible: vi.fn().mockResolvedValue(false),
        textContent: vi.fn().mockResolvedValue(''),
        click: vi.fn().mockResolvedValue(undefined),
      }),
      context: vi.fn().mockReturnValue(mockContext),
      evaluate: vi.fn().mockResolvedValue({}),
      setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
      reload: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
    };
  });

  describe('basic authentication', () => {
    test('should successfully authenticate with valid credentials', async () => {
      const config: AuthConfig = {
        strategy: 'basic',
        loginUrl: 'https://example.com/login',
        credentials: {
          username: 'testuser',
          password: 'password123',
        },
        sessionPersistence: false,
      };

      (mockPage.waitForSelector as MockedFunction<any>).mockResolvedValue(undefined);
      (mockPage.url as MockedFunction<any>).mockReturnValue('https://example.com/dashboard');

      const result = await authManager.authenticate(mockPage as Page, config);

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session?.strategy).toBe('basic');
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com/login', { timeout: 30000 });
      expect(mockPage.fill).toHaveBeenCalledWith(expect.stringContaining('username'), 'testuser');
      expect(mockPage.fill).toHaveBeenCalledWith(expect.stringContaining('password'), 'password123');
    });

    test('should fail with missing credentials', async () => {
      const config: AuthConfig = {
        strategy: 'basic',
        loginUrl: 'https://example.com/login',
        credentials: {},
        sessionPersistence: false,
      };

      const result = await authManager.authenticate(mockPage as Page, config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Username and password required');
    });

    test('should fail with missing login URL', async () => {
      const config: AuthConfig = {
        strategy: 'basic',
        credentials: {
          username: 'testuser',
          password: 'password123',
        },
        sessionPersistence: false,
      };

      const result = await authManager.authenticate(mockPage as Page, config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Login URL required');
    });
  });

  describe('OAuth authentication', () => {
    test('should handle OAuth flow with authorization code', async () => {
      const config: AuthConfig = {
        strategy: 'oauth',
        loginUrl: 'https://oauth.example.com/authorize',
        credentials: {
          clientId: 'test-client-id',
        },
        sessionPersistence: false,
      };

      (mockPage.url as MockedFunction<any>).mockReturnValue('https://example.com/callback?code=auth-code-123');

      const result = await authManager.authenticate(mockPage as Page, config);

      expect(result.success).toBe(true);
      expect(result.session?.strategy).toBe('oauth');
      expect(mockPage.goto).toHaveBeenCalledWith('https://oauth.example.com/authorize', { timeout: 60000 });
      expect(mockPage.waitForURL).toHaveBeenCalledWith(/callback|redirect/, { timeout: 60000 });
    });

    test('should fail without client ID', async () => {
      const config: AuthConfig = {
        strategy: 'oauth',
        loginUrl: 'https://oauth.example.com/authorize',
        credentials: {},
        sessionPersistence: false,
      };

      const result = await authManager.authenticate(mockPage as Page, config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Client ID and login URL required');
    });
  });

  describe('API authentication', () => {
    test('should set API key headers', async () => {
      const config: AuthConfig = {
        strategy: 'api',
        credentials: {
          apiKey: 'test-api-key-123',
        },
        sessionPersistence: false,
      };

      const result = await authManager.authenticate(mockPage as Page, config);

      expect(result.success).toBe(true);
      expect(result.session?.strategy).toBe('api');
      expect(result.session?.sessionToken).toBe('test-api-key-123');
      expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalledWith({
        'Authorization': 'Bearer test-api-key-123',
        'X-API-Key': 'test-api-key-123',
      });
    });

    test('should fail without API key', async () => {
      const config: AuthConfig = {
        strategy: 'api',
        credentials: {},
        sessionPersistence: false,
      };

      const result = await authManager.authenticate(mockPage as Page, config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('API key required');
    });
  });

  describe('MFA authentication', () => {
    test('should handle MFA after basic auth', async () => {
      const config: AuthConfig = {
        strategy: 'mfa',
        loginUrl: 'https://example.com/login',
        credentials: {
          username: 'testuser',
          password: 'password123',
          mfaCode: '123456',
        },
        sessionPersistence: false,
      };

      // Mock basic auth success
      (mockPage.url as MockedFunction<any>)
        .mockReturnValueOnce('https://example.com/login')
        .mockReturnValueOnce('https://example.com/mfa')
        .mockReturnValueOnce('https://example.com/dashboard');

      // Mock MFA field visibility
      const mockLocator = {
        isVisible: vi.fn().mockResolvedValue(true),
      };
      (mockPage.locator as MockedFunction<any>).mockReturnValue(mockLocator);

      const result = await authManager.authenticate(mockPage as Page, config);

      expect(result.success).toBe(true);
      expect(result.session?.strategy).toBe('mfa');
    });

    test('should indicate MFA required when code missing', async () => {
      const config: AuthConfig = {
        strategy: 'mfa',
        loginUrl: 'https://example.com/login',
        credentials: {
          username: 'testuser',
          password: 'password123',
        },
        sessionPersistence: false,
      };

      // Mock MFA field visibility
      const mockLocator = {
        isVisible: vi.fn().mockResolvedValue(true),
      };
      (mockPage.locator as MockedFunction<any>).mockReturnValue(mockLocator);

      const result = await authManager.authenticate(mockPage as Page, config);

      expect(result.success).toBe(false);
      expect(result.requiresMFA).toBe(true);
      expect(result.error).toContain('MFA code required');
    });
  });

  describe('custom authentication', () => {
    test('should execute custom flow', async () => {
      const customFlow = vi.fn().mockResolvedValue(true);
      const config: AuthConfig = {
        strategy: 'custom',
        credentials: { username: 'testuser' },
        sessionPersistence: false,
        customFlow,
      };

      const result = await authManager.authenticate(mockPage as Page, config);

      expect(result.success).toBe(true);
      expect(result.session?.strategy).toBe('custom');
      expect(customFlow).toHaveBeenCalledWith(mockPage, config.credentials);
    });

    test('should fail without custom flow function', async () => {
      const config: AuthConfig = {
        strategy: 'custom',
        credentials: {},
        sessionPersistence: false,
      };

      const result = await authManager.authenticate(mockPage as Page, config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Custom authentication flow function required');
    });
  });

  describe('session management', () => {
    test('should save and load session when persistence enabled', async () => {
      const config: AuthConfig = {
        strategy: 'basic',
        loginUrl: 'https://example.com/login',
        credentials: {
          username: 'testuser',
          password: 'password123',
        },
        sessionPersistence: true,
        cookieFile: 'test-session.json',
      };

      // First authentication
      const result1 = await authManager.authenticate(mockPage as Page, config);
      expect(result1.success).toBe(true);

      // Mock existing session file
      vi.doMock('fs/promises', () => ({
        readFile: vi.fn().mockResolvedValue(JSON.stringify({
          strategy: 'basic',
          authenticated: true,
          cookies: [],
          localStorage: {},
          sessionStorage: {},
          metadata: {},
        })),
        writeFile: vi.fn().mockResolvedValue(undefined),
      }));

      // Second authentication should load existing session
      const authManager2 = new MultiStrategyAuthManager();
      const result2 = await authManager2.authenticate(mockPage as Page, config);
      
      expect(mockContext.addCookies).toHaveBeenCalled();
    });

    test('should validate session correctly', async () => {
      const session = {
        strategy: 'basic' as const,
        authenticated: true,
        userId: 'testuser',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        metadata: {},
      };

      (mockPage.url as MockedFunction<any>).mockReturnValue('https://example.com/dashboard');

      const isValid = await authManager.validateSession(mockPage as Page, session);
      expect(isValid).toBe(true);
    });

    test('should detect expired session', async () => {
      const session = {
        strategy: 'basic' as const,
        authenticated: true,
        userId: 'testuser',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        metadata: {},
        expiresAt: new Date(Date.now() - 10000), // Expired 10 seconds ago
      };

      const isValid = await authManager.validateSession(mockPage as Page, session);
      expect(isValid).toBe(false);
    });
  });

  describe('logout', () => {
    test('should successfully logout', async () => {
      // First authenticate to set current session
      const config: AuthConfig = {
        strategy: 'basic',
        loginUrl: 'https://example.com/login',
        credentials: {
          username: 'testuser',
          password: 'password123',
        },
        sessionPersistence: false,
      };

      await authManager.authenticate(mockPage as Page, config);

      // Mock logout button
      const mockLogoutElement = {
        isVisible: vi.fn().mockResolvedValue(true),
        click: vi.fn().mockResolvedValue(undefined),
      };
      (mockPage.locator as MockedFunction<any>).mockReturnValue(mockLogoutElement);

      const result = await authManager.logout(mockPage as Page);

      expect(result).toBe(true);
      expect(mockContext.clearCookies).toHaveBeenCalled();
      expect(authManager.isAuthenticated()).toBe(false);
    });

    test('should handle logout when not authenticated', async () => {
      const result = await authManager.logout(mockPage as Page);
      expect(result).toBe(true);
    });
  });

  describe('utility methods', () => {
    test('should return current session', () => {
      expect(authManager.getCurrentSession()).toBeNull();
      expect(authManager.isAuthenticated()).toBe(false);
    });

    test('should handle unsupported strategy', async () => {
      const config = {
        strategy: 'unsupported' as any,
        credentials: {},
        sessionPersistence: false,
      };

      const result = await authManager.authenticate(mockPage as Page, config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported authentication strategy');
    });
  });
});