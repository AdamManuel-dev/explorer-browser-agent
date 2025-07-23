"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const promises_1 = require("fs/promises");
const MultiStrategyAuthManager_1 = require("../auth/MultiStrategyAuthManager");
globals_1.jest.mock('../utils/logger');
(0, globals_1.describe)('MultiStrategyAuthManager', () => {
    let authManager;
    let mockPage;
    let mockContext;
    (0, globals_1.beforeEach)(() => {
        authManager = new MultiStrategyAuthManager_1.MultiStrategyAuthManager();
        mockContext = {
            cookies: globals_1.jest.fn(() => Promise.resolve([])),
            addCookies: globals_1.jest.fn(() => Promise.resolve()),
            clearCookies: globals_1.jest.fn(() => Promise.resolve()),
        };
        mockPage = {
            goto: globals_1.jest.fn(() => Promise.resolve(null)),
            fill: globals_1.jest.fn(() => Promise.resolve()),
            click: globals_1.jest.fn(() => Promise.resolve()),
            waitForSelector: globals_1.jest.fn(() => Promise.resolve(null)),
            waitForNavigation: globals_1.jest.fn(() => Promise.resolve(null)),
            waitForURL: globals_1.jest.fn(() => Promise.resolve()),
            url: globals_1.jest.fn(() => 'https://example.com/dashboard'),
            locator: globals_1.jest.fn(() => ({
                isVisible: globals_1.jest.fn(() => Promise.resolve(false)),
                textContent: globals_1.jest.fn(() => Promise.resolve('')),
                click: globals_1.jest.fn(() => Promise.resolve()),
            })),
            context: globals_1.jest.fn(() => mockContext),
            evaluate: globals_1.jest.fn(() => Promise.resolve({})),
            setExtraHTTPHeaders: globals_1.jest.fn(() => Promise.resolve()),
            reload: globals_1.jest.fn(() => Promise.resolve(null)),
            waitForTimeout: globals_1.jest.fn(() => Promise.resolve()),
        };
    });
    (0, globals_1.describe)('basic authentication', () => {
        (0, globals_1.test)('should successfully authenticate with valid credentials', async () => {
            const config = {
                strategy: 'basic',
                loginUrl: 'https://example.com/login',
                credentials: {
                    username: 'testuser',
                    password: 'password123',
                },
                sessionPersistence: false,
            };
            mockPage.waitForSelector.mockResolvedValue(null);
            mockPage.url.mockReturnValue('https://example.com/dashboard');
            const result = await authManager.authenticate(mockPage, config);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.session).toBeDefined();
            (0, globals_1.expect)(result.session?.strategy).toBe('basic');
            (0, globals_1.expect)(mockPage.goto).toHaveBeenCalledWith('https://example.com/login', { timeout: 30000 });
            (0, globals_1.expect)(mockPage.fill).toHaveBeenCalledWith(globals_1.expect.stringContaining('username'), 'testuser');
            (0, globals_1.expect)(mockPage.fill).toHaveBeenCalledWith(globals_1.expect.stringContaining('password'), 'password123');
        });
        (0, globals_1.test)('should fail with missing credentials', async () => {
            const config = {
                strategy: 'basic',
                loginUrl: 'https://example.com/login',
                credentials: {},
                sessionPersistence: false,
            };
            const result = await authManager.authenticate(mockPage, config);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.error).toContain('Username and password required');
        });
        (0, globals_1.test)('should fail with missing login URL', async () => {
            const config = {
                strategy: 'basic',
                credentials: {
                    username: 'testuser',
                    password: 'password123',
                },
                sessionPersistence: false,
            };
            const result = await authManager.authenticate(mockPage, config);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.error).toContain('Login URL required');
        });
    });
    (0, globals_1.describe)('OAuth authentication', () => {
        (0, globals_1.test)('should handle OAuth flow with authorization code', async () => {
            const config = {
                strategy: 'oauth',
                loginUrl: 'https://oauth.example.com/authorize',
                credentials: {
                    clientId: 'test-client-id',
                },
                sessionPersistence: false,
            };
            mockPage.url.mockReturnValue('https://example.com/callback?code=auth-code-123');
            const result = await authManager.authenticate(mockPage, config);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.session?.strategy).toBe('oauth');
            (0, globals_1.expect)(mockPage.goto).toHaveBeenCalledWith('https://oauth.example.com/authorize', {
                timeout: 60000,
            });
            (0, globals_1.expect)(mockPage.waitForURL).toHaveBeenCalledWith(/callback|redirect/, { timeout: 60000 });
        });
        (0, globals_1.test)('should fail without client ID', async () => {
            const config = {
                strategy: 'oauth',
                loginUrl: 'https://oauth.example.com/authorize',
                credentials: {},
                sessionPersistence: false,
            };
            const result = await authManager.authenticate(mockPage, config);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.error).toContain('Client ID and login URL required');
        });
    });
    (0, globals_1.describe)('API authentication', () => {
        (0, globals_1.test)('should set API key headers', async () => {
            const config = {
                strategy: 'api',
                credentials: {
                    apiKey: 'test-api-key-123',
                },
                sessionPersistence: false,
            };
            const result = await authManager.authenticate(mockPage, config);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.session?.strategy).toBe('api');
            (0, globals_1.expect)(result.session?.sessionToken).toBe('test-api-key-123');
            (0, globals_1.expect)(mockPage.setExtraHTTPHeaders).toHaveBeenCalledWith({
                Authorization: 'Bearer test-api-key-123',
                'X-API-Key': 'test-api-key-123',
            });
        });
        (0, globals_1.test)('should fail without API key', async () => {
            const config = {
                strategy: 'api',
                credentials: {},
                sessionPersistence: false,
            };
            const result = await authManager.authenticate(mockPage, config);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.error).toContain('API key required');
        });
    });
    (0, globals_1.describe)('MFA authentication', () => {
        (0, globals_1.test)('should handle MFA after basic auth', async () => {
            const config = {
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
            mockPage.url
                .mockReturnValueOnce('https://example.com/login')
                .mockReturnValueOnce('https://example.com/mfa')
                .mockReturnValueOnce('https://example.com/dashboard');
            // Mock MFA field visibility
            const mockLocator = {
                isVisible: globals_1.jest.fn(() => Promise.resolve(true)),
            };
            mockPage.locator.mockReturnValue(mockLocator);
            const result = await authManager.authenticate(mockPage, config);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.session?.strategy).toBe('mfa');
        });
        (0, globals_1.test)('should indicate MFA required when code missing', async () => {
            const config = {
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
                isVisible: globals_1.jest.fn(() => Promise.resolve(true)),
            };
            mockPage.locator.mockReturnValue(mockLocator);
            const result = await authManager.authenticate(mockPage, config);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.requiresMFA).toBe(true);
            (0, globals_1.expect)(result.error).toContain('MFA code required');
        });
    });
    (0, globals_1.describe)('custom authentication', () => {
        (0, globals_1.test)('should execute custom flow', async () => {
            const customFlow = globals_1.jest.fn(() => Promise.resolve(true));
            const config = {
                strategy: 'custom',
                credentials: { username: 'testuser' },
                sessionPersistence: false,
                customFlow,
            };
            const result = await authManager.authenticate(mockPage, config);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.session?.strategy).toBe('custom');
            (0, globals_1.expect)(customFlow).toHaveBeenCalledWith(mockPage, config.credentials);
        });
        (0, globals_1.test)('should fail without custom flow function', async () => {
            const config = {
                strategy: 'custom',
                credentials: {},
                sessionPersistence: false,
            };
            const result = await authManager.authenticate(mockPage, config);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.error).toContain('Custom authentication flow function required');
        });
    });
    (0, globals_1.describe)('session management', () => {
        (0, globals_1.test)('should save and load session when persistence enabled', async () => {
            const config = {
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
            const result1 = await authManager.authenticate(mockPage, config);
            (0, globals_1.expect)(result1.success).toBe(true);
            // Mock existing session file
            const mockReadFile = promises_1.readFile;
            const mockWriteFile = promises_1.writeFile;
            mockReadFile.mockResolvedValue(JSON.stringify({
                strategy: 'basic',
                authenticated: true,
                cookies: [],
                localStorage: {},
                sessionStorage: {},
                metadata: {},
            }));
            mockWriteFile.mockResolvedValue(undefined);
            // Second authentication should load existing session
            const authManager2 = new MultiStrategyAuthManager_1.MultiStrategyAuthManager();
            await authManager2.authenticate(mockPage, config);
            (0, globals_1.expect)(mockContext.addCookies).toHaveBeenCalled();
        });
        (0, globals_1.test)('should validate session correctly', async () => {
            const session = {
                strategy: 'basic',
                authenticated: true,
                userId: 'testuser',
                cookies: [],
                localStorage: {},
                sessionStorage: {},
                metadata: {},
            };
            mockPage.url.mockReturnValue('https://example.com/dashboard');
            const isValid = await authManager.validateSession(mockPage, session);
            (0, globals_1.expect)(isValid).toBe(true);
        });
        (0, globals_1.test)('should detect expired session', async () => {
            const session = {
                strategy: 'basic',
                authenticated: true,
                userId: 'testuser',
                cookies: [],
                localStorage: {},
                sessionStorage: {},
                metadata: {},
                expiresAt: new Date(Date.now() - 10000), // Expired 10 seconds ago
            };
            const isValid = await authManager.validateSession(mockPage, session);
            (0, globals_1.expect)(isValid).toBe(false);
        });
    });
    (0, globals_1.describe)('logout', () => {
        (0, globals_1.test)('should successfully logout', async () => {
            // First authenticate to set current session
            const config = {
                strategy: 'basic',
                loginUrl: 'https://example.com/login',
                credentials: {
                    username: 'testuser',
                    password: 'password123',
                },
                sessionPersistence: false,
            };
            await authManager.authenticate(mockPage, config);
            // Mock logout button
            const mockLogoutElement = {
                isVisible: globals_1.jest.fn(() => Promise.resolve(true)),
                click: globals_1.jest.fn(() => Promise.resolve()),
            };
            mockPage.locator.mockReturnValue(mockLogoutElement);
            const result = await authManager.logout(mockPage);
            (0, globals_1.expect)(result).toBe(true);
            (0, globals_1.expect)(mockContext.clearCookies).toHaveBeenCalled();
            (0, globals_1.expect)(authManager.isAuthenticated()).toBe(false);
        });
        (0, globals_1.test)('should handle logout when not authenticated', async () => {
            const result = await authManager.logout(mockPage);
            (0, globals_1.expect)(result).toBe(true);
        });
    });
    (0, globals_1.describe)('utility methods', () => {
        (0, globals_1.test)('should return current session', () => {
            (0, globals_1.expect)(authManager.getCurrentSession()).toBeNull();
            (0, globals_1.expect)(authManager.isAuthenticated()).toBe(false);
        });
        (0, globals_1.test)('should handle unsupported strategy', async () => {
            const config = {
                strategy: 'unsupported',
                credentials: {},
                sessionPersistence: false,
            };
            const result = await authManager.authenticate(mockPage, config);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.error).toContain('Unsupported authentication strategy');
        });
    });
});
//# sourceMappingURL=auth.test.js.map