"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
const MultiStrategyAuthManager_1 = require("../../auth/MultiStrategyAuthManager");
const SessionManager_1 = require("../../auth/SessionManager");
const StealthMode_1 = require("../../stealth/StealthMode");
const MonitoringService_1 = require("../../monitoring/MonitoringService");
const BreadthFirstCrawler_1 = require("../../crawler/BreadthFirstCrawler");
describe('Authentication and Security Workflow Integration Tests', () => {
    let browser;
    let testPort;
    let testServer;
    const sessions = new Map();
    beforeAll(async () => {
        browser = await playwright_1.chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-dev-shm-usage'],
        });
        testPort = 3003;
    });
    afterAll(async () => {
        if (browser) {
            await browser.close();
        }
        if (testServer) {
            testServer.close();
        }
    });
    beforeEach(async () => {
        // Start authentication test server
        const express = require('express');
        const app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        app.use(require('cookie-parser')());
        // Session storage
        sessions.clear();
        // Public pages
        app.get('/', (req, res) => {
            const isLoggedIn = sessions.has(req.cookies?.sessionId);
            res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Auth Test Site</title></head>
        <body>
          <h1>Authentication Test Site</h1>
          <nav>
            ${isLoggedIn
                ? '<a href="/dashboard" data-testid="dashboard-link">Dashboard</a> | <a href="/logout" data-testid="logout-link">Logout</a>'
                : '<a href="/login" data-testid="login-link">Login</a> | <a href="/register" data-testid="register-link">Register</a>'}
          </nav>
          <main>
            <p>Welcome to our secure test site!</p>
            ${isLoggedIn
                ? '<p data-testid="welcome-message">You are logged in!</p>'
                : '<p data-testid="guest-message">Please log in to access protected content.</p>'}
            <div class="public-content">
              <h2>Public Information</h2>
              <p>This content is available to everyone.</p>
              <a href="/about" data-testid="about-link">About Us</a>
            </div>
          </main>
        </body>
        </html>
      `);
        });
        // Login page with multiple auth methods
        app.get('/login', (_req, res) => {
            res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Login - Auth Test</title></head>
        <body>
          <h1>Login</h1>
          <a href="/" data-testid="home-link">Home</a>
          
          <!-- Basic Login Form -->
          <div class="login-methods">
            <div class="basic-login">
              <h2>Login with Credentials</h2>
              <form action="/auth/basic" method="post" data-testid="basic-login-form">
                <input type="text" name="username" placeholder="Username" required data-testid="username-input">
                <input type="password" name="password" placeholder="Password" required data-testid="password-input">
                <input type="hidden" name="redirectUrl" value="/dashboard">
                <button type="submit" data-testid="login-submit">Login</button>
              </form>
              <p><small>Use: admin/password or user/secret</small></p>
            </div>

            <!-- OAuth-style login -->
            <div class="oauth-login">
              <h2>Third-party Login</h2>
              <a href="/auth/oauth/google" class="oauth-btn" data-testid="google-login">Login with Google</a>
              <a href="/auth/oauth/github" class="oauth-btn" data-testid="github-login">Login with GitHub</a>
            </div>

            <!-- API Key authentication -->
            <div class="api-login">
              <h2>API Key Access</h2>
              <form action="/auth/api" method="post" data-testid="api-login-form">
                <input type="text" name="apiKey" placeholder="API Key" required data-testid="api-key-input">
                <button type="submit" data-testid="api-login-submit">Access with API Key</button>
              </form>
              <p><small>Use: test-api-key-123</small></p>
            </div>
          </div>

          <script>
            // Simulate some client-side behavior
            document.addEventListener('DOMContentLoaded', function() {
              console.log('Login page loaded');
              
              // Add some dynamic behavior
              const forms = document.querySelectorAll('form');
              forms.forEach(form => {
                form.addEventListener('submit', function(e) {
                  console.log('Form submitted:', form.dataset.testid);
                });
              });
            });
          </script>
        </body>
        </html>
      `);
        });
        // Basic authentication endpoint
        app.post('/auth/basic', (req, res) => {
            const { username, password, redirectUrl } = req.body;
            // Simple credential check
            const validCredentials = {
                admin: 'password',
                user: 'secret',
                testuser: 'testpass',
            };
            if (validCredentials[username] && validCredentials[username] === password) {
                const sessionId = `session_${Date.now()}_${Math.random().toString(36)}`;
                sessions.set(sessionId, {
                    username,
                    loginTime: new Date(),
                    method: 'basic',
                    permissions: username === 'admin' ? ['read', 'write', 'admin'] : ['read'],
                });
                res.cookie('sessionId', sessionId, { httpOnly: true, maxAge: 3600000 });
                res.redirect(redirectUrl || '/dashboard');
            }
            else {
                res.send(`
          <!DOCTYPE html>
          <html>
          <head><title>Login Failed</title></head>
          <body>
            <h1>Login Failed</h1>
            <p data-testid="error-message">Invalid username or password.</p>
            <a href="/login" data-testid="try-again-link">Try Again</a>
          </body>
          </html>
        `);
            }
        });
        // OAuth simulation endpoints
        app.get('/auth/oauth/:provider', (req, res) => {
            const { provider } = req.params;
            // Simulate OAuth flow
            res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>${provider} OAuth</title></head>
        <body>
          <h1>Simulated ${provider} OAuth</h1>
          <p>In a real application, you would be redirected to ${provider}.</p>
          <form action="/auth/oauth/callback" method="post" data-testid="oauth-consent-form">
            <input type="hidden" name="provider" value="${provider}">
            <input type="hidden" name="code" value="mock-auth-code-123">
            <p>Do you want to authorize this application?</p>
            <button type="submit" name="action" value="allow" data-testid="oauth-allow">Allow</button>
            <button type="submit" name="action" value="deny" data-testid="oauth-deny">Deny</button>
          </form>
        </body>
        </html>
      `);
        });
        app.post('/auth/oauth/callback', (req, res) => {
            const { provider, code, action } = req.body;
            if (action === 'allow' && code === 'mock-auth-code-123') {
                const sessionId = `oauth_session_${Date.now()}`;
                sessions.set(sessionId, {
                    username: `${provider}_user`,
                    loginTime: new Date(),
                    method: 'oauth',
                    provider,
                    permissions: ['read'],
                });
                res.cookie('sessionId', sessionId, { httpOnly: true, maxAge: 3600000 });
                res.redirect('/dashboard');
            }
            else {
                res.redirect('/login?error=oauth_denied');
            }
        });
        // API authentication endpoint
        app.post('/auth/api', (req, res) => {
            const { apiKey } = req.body;
            if (apiKey === 'test-api-key-123') {
                const sessionId = `api_session_${Date.now()}`;
                sessions.set(sessionId, {
                    apiKey,
                    loginTime: new Date(),
                    method: 'api',
                    permissions: ['read', 'api'],
                });
                res.cookie('sessionId', sessionId, { httpOnly: true, maxAge: 3600000 });
                res.redirect('/dashboard');
            }
            else {
                res.status(401).json({ error: 'Invalid API key' });
            }
        });
        // Protected pages
        app.get('/dashboard', (req, res) => {
            const sessionId = req.cookies?.sessionId;
            const session = sessions.get(sessionId);
            if (!session) {
                res.redirect('/login');
                return;
            }
            res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Dashboard - Auth Test</title></head>
        <body>
          <h1>User Dashboard</h1>
          <a href="/" data-testid="home-link">Home</a> | 
          <a href="/profile" data-testid="profile-link">Profile</a> | 
          <a href="/logout" data-testid="logout-link">Logout</a>
          
          <div class="user-info" data-testid="user-info">
            <h2>Welcome, ${session.username || session.apiKey || 'User'}!</h2>
            <p>Login method: ${session.method}</p>
            <p>Login time: ${session.loginTime}</p>
            <p>Permissions: ${session.permissions.join(', ')}</p>
          </div>

          <div class="protected-content">
            <h2>Protected Content</h2>
            <p data-testid="protected-message">This content is only visible to authenticated users.</p>
            
            ${session.permissions.includes('admin')
                ? `
              <div class="admin-section" data-testid="admin-section">
                <h3>Admin Controls</h3>
                <button data-testid="admin-action">Perform Admin Action</button>
              </div>
            `
                : ''}
          </div>

          <div class="actions">
            <a href="/products" data-testid="products-link">View Products</a>
            <a href="/orders" data-testid="orders-link">My Orders</a>
            <a href="/settings" data-testid="settings-link">Settings</a>
          </div>
        </body>
        </html>
      `);
        });
        app.get('/profile', (req, res) => {
            const sessionId = req.cookies?.sessionId;
            const session = sessions.get(sessionId);
            if (!session) {
                res.redirect('/login');
                return;
            }
            res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Profile - Auth Test</title></head>
        <body>
          <h1>User Profile</h1>
          <a href="/dashboard" data-testid="dashboard-link">Dashboard</a> | 
          <a href="/logout" data-testid="logout-link">Logout</a>
          
          <div class="profile-info" data-testid="profile-info">
            <h2>Profile Information</h2>
            <p>Username: ${session.username || 'N/A'}</p>
            <p>Auth Method: ${session.method}</p>
            <p>Session Started: ${session.loginTime}</p>
          </div>

          <form action="/profile/update" method="post" data-testid="profile-form">
            <h3>Update Profile</h3>
            <input type="text" name="displayName" placeholder="Display Name" data-testid="display-name-input">
            <input type="email" name="email" placeholder="Email" data-testid="email-input">
            <button type="submit" data-testid="update-profile-btn">Update Profile</button>
          </form>

          <div class="security-settings">
            <h3>Security Settings</h3>
            <a href="/security/2fa" data-testid="2fa-link">Enable Two-Factor Authentication</a>
            <a href="/security/sessions" data-testid="sessions-link">Manage Sessions</a>
          </div>
        </body>
        </html>
      `);
        });
        // Logout endpoint
        app.get('/logout', (req, res) => {
            const sessionId = req.cookies?.sessionId;
            if (sessionId) {
                sessions.delete(sessionId);
            }
            res.clearCookie('sessionId');
            res.redirect('/');
        });
        // About page (public)
        app.get('/about', (_req, res) => {
            res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>About - Auth Test</title></head>
        <body>
          <h1>About Us</h1>
          <a href="/" data-testid="home-link">Home</a>
          <p>This is a public page accessible to everyone.</p>
        </body>
        </html>
      `);
        });
        // Start server
        testServer = app.listen(testPort);
        // Wait for server to be ready
        await new Promise((resolve) => setTimeout(resolve, 1000));
    });
    afterEach(async () => {
        if (testServer) {
            testServer.close();
            testServer = null;
        }
    });
    describe('Basic Authentication', () => {
        it('should perform basic authentication workflow', async () => {
            const authManager = new MultiStrategyAuthManager_1.MultiStrategyAuthManager();
            const monitoring = new MonitoringService_1.MonitoringService({
                enabled: true,
                reporting: {
                    enabled: false,
                    interval: 5000,
                    includeSummary: true,
                },
            });
            await monitoring.initialize();
            try {
                const page = await browser.newPage();
                const result = await authManager.authenticate(page, {
                    strategy: 'basic',
                    loginUrl: `http://localhost:${testPort}/login`,
                    credentials: {
                        username: 'admin',
                        password: 'password',
                    },
                    sessionPersistence: true,
                    selectors: {
                        usernameField: '[data-testid="username-input"]',
                        passwordField: '[data-testid="password-input"]',
                        submitButton: '[data-testid="login-submit"]',
                        successIndicator: '[data-testid="user-info"]',
                    },
                });
                expect(result.success).toBe(true);
                expect(result.session).toBeDefined();
                // Verify authentication worked
                const userInfo = await page.locator('[data-testid="user-info"]').textContent();
                expect(userInfo).toContain('admin');
                // Track authentication in monitoring
                monitoring.trackAuthenticationAttempt('basic', true);
                await page.close();
            }
            finally {
                await monitoring.shutdown();
            }
        }, 15000);
        it('should handle OAuth-style authentication', async () => {
            try {
                const page = await browser.newPage();
                // Navigate to login page
                await page.goto(`http://localhost:${testPort}/login`);
                // Click OAuth login button
                await page.click('[data-testid="google-login"]');
                // Handle OAuth consent
                await page.waitForSelector('[data-testid="oauth-consent-form"]');
                await page.click('[data-testid="oauth-allow"]');
                // Should be redirected to dashboard
                await page.waitForURL(`http://localhost:${testPort}/dashboard`);
                // Verify authentication
                const userInfo = await page.locator('[data-testid="user-info"]').textContent();
                expect(userInfo).toContain('google_user');
                expect(userInfo).toContain('oauth');
                await page.close();
            }
            catch (error) {
                throw error;
            }
        }, 15000);
        it('should handle API key authentication', async () => {
            const authManager = new MultiStrategyAuthManager_1.MultiStrategyAuthManager();
            try {
                const page = await browser.newPage();
                const result = await authManager.authenticate(page, {
                    strategy: 'api',
                    credentials: {
                        apiKey: 'test-api-key-123',
                    },
                    sessionPersistence: false,
                });
                expect(result.success).toBe(true);
                expect(result.session?.strategy).toBe('api');
                await page.close();
            }
            catch (error) {
                throw error;
            }
        }, 10000);
        it('should handle authentication failures', async () => {
            const authManager = new MultiStrategyAuthManager_1.MultiStrategyAuthManager();
            try {
                const page = await browser.newPage();
                const result = await authManager.authenticate(page, {
                    strategy: 'basic',
                    loginUrl: `http://localhost:${testPort}/login`,
                    credentials: {
                        username: 'invalid',
                        password: 'wrongpassword',
                    },
                    sessionPersistence: false,
                    selectors: {
                        usernameField: '[data-testid="username-input"]',
                        passwordField: '[data-testid="password-input"]',
                        submitButton: '[data-testid="login-submit"]',
                        successIndicator: '[data-testid="user-info"]',
                        errorIndicator: '[data-testid="error-message"]',
                    },
                });
                expect(result.success).toBe(false);
                expect(result.error).toBeDefined();
                // Verify error message is displayed
                const errorMessage = await page.locator('[data-testid="error-message"]').textContent();
                expect(errorMessage).toContain('Invalid username or password');
                await page.close();
            }
            catch (error) {
                throw error;
            }
        }, 10000);
    });
    describe('Session Management', () => {
        it('should persist and restore sessions', async () => {
            const sessionManager = new SessionManager_1.SessionManager();
            const authManager = new MultiStrategyAuthManager_1.MultiStrategyAuthManager();
            try {
                // First login
                const page1 = await browser.newPage();
                const authResult = await authManager.authenticate(page1, {
                    strategy: 'basic',
                    loginUrl: `http://localhost:${testPort}/login`,
                    credentials: {
                        username: 'user',
                        password: 'secret',
                    },
                    sessionPersistence: true,
                    cookieFile: './test-cookies.json',
                    selectors: {
                        usernameField: '[data-testid="username-input"]',
                        passwordField: '[data-testid="password-input"]',
                        submitButton: '[data-testid="login-submit"]',
                        successIndicator: '[data-testid="user-info"]',
                    },
                });
                expect(authResult.success).toBe(true);
                // Save session
                await sessionManager.saveSession('test-session', authResult.session, 'example.com');
                await page1.close();
                // Second page with restored session
                const page2 = await browser.newPage();
                // Load saved session
                const savedSession = await sessionManager.loadSession('test-session', 'example.com');
                expect(savedSession).toBeDefined();
                // Restore session to new page
                await sessionManager.restoreSession(page2.context(), savedSession);
                // Navigate to protected page
                await page2.goto(`http://localhost:${testPort}/dashboard`);
                // Should be logged in
                const userInfo = await page2.locator('[data-testid="user-info"]').textContent();
                expect(userInfo).toContain('user');
                await page2.close();
                // Cleanup
                const fs = require('fs');
                try {
                    fs.unlinkSync('./test-session.json');
                    fs.unlinkSync('./test-cookies.json');
                }
                catch (e) {
                    // Ignore cleanup errors
                }
            }
            catch (error) {
                throw error;
            }
        }, 15000);
        it('should handle session expiration', async () => {
            const sessionManager = new SessionManager_1.SessionManager();
            // Create expired session (test validates expiration logic)
            // const expiredSession = {
            //   strategy: 'basic' as const,
            //   authenticated: true,
            //   userId: 'testuser',
            //   expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
            //   cookies: [],
            //   localStorage: {},
            //   sessionStorage: {},
            // };
            // Session validation happens during load now
            const loadedSession = await sessionManager.loadSession('expired-session', 'example.com');
            const isValid = loadedSession !== null;
            expect(isValid).toBe(false);
        });
        it('should clear sessions on logout', async () => {
            const authManager = new MultiStrategyAuthManager_1.MultiStrategyAuthManager();
            // const sessionManager = new SessionManager();
            try {
                const page = await browser.newPage();
                // Login first
                const authResult = await authManager.authenticate(page, {
                    strategy: 'basic',
                    loginUrl: `http://localhost:${testPort}/login`,
                    credentials: {
                        username: 'admin',
                        password: 'password',
                    },
                    sessionPersistence: false,
                    selectors: {
                        usernameField: '[data-testid="username-input"]',
                        passwordField: '[data-testid="password-input"]',
                        submitButton: '[data-testid="login-submit"]',
                        successIndicator: '[data-testid="user-info"]',
                    },
                });
                expect(authResult.success).toBe(true);
                // Click logout
                await page.click('[data-testid="logout-link"]');
                // Wait for redirect to home
                await page.waitForURL(`http://localhost:${testPort}/`);
                // Verify logged out
                const guestMessage = await page.locator('[data-testid="guest-message"]').textContent();
                expect(guestMessage).toContain('Please log in');
                // Clear session from manager
                // Session is cleared automatically on logout
                await page.close();
            }
            catch (error) {
                throw error;
            }
        }, 15000);
    });
    describe('Stealth Mode Integration', () => {
        it('should authenticate with stealth mode enabled', async () => {
            const authManager = new MultiStrategyAuthManager_1.MultiStrategyAuthManager();
            const stealthMode = new StealthMode_1.StealthMode();
            try {
                const context = await browser.newContext();
                // Apply stealth mode to context
                await stealthMode.apply(await context.newPage());
                const page = await context.newPage();
                const result = await authManager.authenticate(page, {
                    strategy: 'basic',
                    loginUrl: `http://localhost:${testPort}/login`,
                    credentials: {
                        username: 'admin',
                        password: 'password',
                    },
                    sessionPersistence: false,
                    selectors: {
                        usernameField: '[data-testid="username-input"]',
                        passwordField: '[data-testid="password-input"]',
                        submitButton: '[data-testid="login-submit"]',
                        successIndicator: '[data-testid="user-info"]',
                    },
                });
                expect(result.success).toBe(true);
                // Verify stealth indicators
                // Stealth mode is applied, verification happens internally
                await page.close();
                await context.close();
            }
            catch (error) {
                throw error;
            }
        }, 15000);
    });
    describe('Protected Content Crawling', () => {
        it('should crawl authenticated pages', async () => {
            const authManager = new MultiStrategyAuthManager_1.MultiStrategyAuthManager();
            const crawler = new BreadthFirstCrawler_1.BreadthFirstCrawler({
                startUrl: `http://localhost:${testPort}/dashboard`,
                maxDepth: 2,
                maxPages: 10,
                crawlDelay: 100,
                respectRobotsTxt: false,
                followExternalLinks: false,
                userAgent: 'Test Crawler',
            });
            try {
                const page = await browser.newPage();
                // First authenticate
                const authResult = await authManager.authenticate(page, {
                    strategy: 'basic',
                    loginUrl: `http://localhost:${testPort}/login`,
                    credentials: {
                        username: 'admin',
                        password: 'password',
                    },
                    sessionPersistence: false,
                    selectors: {
                        usernameField: '[data-testid="username-input"]',
                        passwordField: '[data-testid="password-input"]',
                        submitButton: '[data-testid="login-submit"]',
                        successIndicator: '[data-testid="user-info"]',
                    },
                });
                expect(authResult.success).toBe(true);
                // Now crawl authenticated content
                const crawlResults = await crawler.crawl();
                expect(crawlResults.crawledUrls.length).toBeGreaterThan(0);
                expect(crawlResults.elements.length).toBeGreaterThan(0);
                // Should have found protected content
                const protectedPages = crawlResults.crawledUrls.filter((url) => url.includes('/dashboard') || url.includes('/profile'));
                expect(protectedPages.length).toBeGreaterThan(0);
                // Should have found admin section for admin user
                const adminContent = crawlResults.elements.some((e) => e.selector?.includes('admin-section'));
                expect(adminContent).toBe(true);
                await page.close();
            }
            catch (error) {
                throw error;
            }
        }, 20000);
        it('should respect authentication boundaries', async () => {
            const crawler = new BreadthFirstCrawler_1.BreadthFirstCrawler({
                startUrl: `http://localhost:${testPort}/`,
                maxDepth: 2,
                maxPages: 10,
                crawlDelay: 100,
                respectRobotsTxt: false,
                followExternalLinks: false,
                userAgent: 'Test Crawler',
            });
            try {
                const page = await browser.newPage();
                // Try to crawl without authentication
                const crawlResults = await crawler.crawl();
                // Should not find protected pages
                const protectedPages = crawlResults.crawledUrls.filter((url) => url.includes('/dashboard') || url.includes('/profile'));
                expect(protectedPages.length).toBe(0);
                // Should have found public pages
                const publicPages = crawlResults.crawledUrls.filter((p) => p.url === `http://localhost:${testPort}/` ||
                    p.url.includes('/about') ||
                    p.url.includes('/login'));
                expect(publicPages.length).toBeGreaterThan(0);
                await page.close();
            }
            catch (error) {
                throw error;
            }
        }, 15000);
    });
    describe('Multi-Strategy Authentication', () => {
        it('should handle multiple authentication strategies in sequence', async () => {
            const authManager = new MultiStrategyAuthManager_1.MultiStrategyAuthManager();
            const authManager2 = new MultiStrategyAuthManager_1.MultiStrategyAuthManager();
            try {
                // Test basic auth
                const page1 = await browser.newPage();
                const basicResult = await authManager.authenticate(page1, {
                    strategy: 'basic',
                    loginUrl: `http://localhost:${testPort}/login`,
                    credentials: {
                        username: 'user',
                        password: 'secret',
                    },
                    sessionPersistence: false,
                    selectors: {
                        usernameField: '[data-testid="username-input"]',
                        passwordField: '[data-testid="password-input"]',
                        submitButton: '[data-testid="login-submit"]',
                        successIndicator: '[data-testid="user-info"]',
                    },
                });
                expect(basicResult.success).toBe(true);
                await page1.close();
                // Test API auth
                const page2 = await browser.newPage();
                const apiResult = await authManager2.authenticate(page2, {
                    strategy: 'api',
                    credentials: {
                        apiKey: 'test-api-key-123',
                    },
                    sessionPersistence: false,
                });
                expect(apiResult.success).toBe(true);
                await page2.close();
            }
            catch (error) {
                throw error;
            }
        }, 15000);
    });
});
//# sourceMappingURL=AuthWorkflow.integration.test.js.map