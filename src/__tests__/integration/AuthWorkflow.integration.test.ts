import { chromium, Browser, Page } from 'playwright';
import { MultiStrategyAuthManager } from '../../auth/MultiStrategyAuthManager';
import { SessionManager } from '../../auth/SessionManager';
import { StealthMode } from '../../stealth/StealthMode';
import { CaptchaHandler } from '../../captcha/CaptchaHandler';
import { MonitoringService } from '../../monitoring/MonitoringService';
import { BreadthFirstCrawler } from '../../crawler/BreadthFirstCrawler';

describe('Authentication and Security Workflow Integration Tests', () => {
  let browser: Browser;
  let testPort: number;
  let testServer: any;
  let sessions: Map<string, any> = new Map();

  beforeAll(async () => {
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'] 
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
    app.get('/', (req: any, res: any) => {
      const isLoggedIn = sessions.has(req.cookies?.sessionId);
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Auth Test Site</title></head>
        <body>
          <h1>Authentication Test Site</h1>
          <nav>
            ${isLoggedIn ? 
              '<a href="/dashboard" data-testid="dashboard-link">Dashboard</a> | <a href="/logout" data-testid="logout-link">Logout</a>' :
              '<a href="/login" data-testid="login-link">Login</a> | <a href="/register" data-testid="register-link">Register</a>'
            }
          </nav>
          <main>
            <p>Welcome to our secure test site!</p>
            ${isLoggedIn ? 
              '<p data-testid="welcome-message">You are logged in!</p>' :
              '<p data-testid="guest-message">Please log in to access protected content.</p>'
            }
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
    app.get('/login', (req: any, res: any) => {
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
    app.post('/auth/basic', (req: any, res: any) => {
      const { username, password, redirectUrl } = req.body;
      
      // Simple credential check
      const validCredentials = {
        'admin': 'password',
        'user': 'secret',
        'testuser': 'testpass'
      };

      if (validCredentials[username] && validCredentials[username] === password) {
        const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36);
        sessions.set(sessionId, {
          username,
          loginTime: new Date(),
          method: 'basic',
          permissions: username === 'admin' ? ['read', 'write', 'admin'] : ['read']
        });

        res.cookie('sessionId', sessionId, { httpOnly: true, maxAge: 3600000 });
        res.redirect(redirectUrl || '/dashboard');
      } else {
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
    app.get('/auth/oauth/:provider', (req: any, res: any) => {
      const provider = req.params.provider;
      
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

    app.post('/auth/oauth/callback', (req: any, res: any) => {
      const { provider, code, action } = req.body;
      
      if (action === 'allow' && code === 'mock-auth-code-123') {
        const sessionId = 'oauth_session_' + Date.now() + '_' + Math.random().toString(36);
        sessions.set(sessionId, {
          username: `${provider}_user`,
          loginTime: new Date(),
          method: 'oauth',
          provider,
          permissions: ['read']
        });

        res.cookie('sessionId', sessionId, { httpOnly: true, maxAge: 3600000 });
        res.redirect('/dashboard');
      } else {
        res.redirect('/login?error=oauth_denied');
      }
    });

    // API Key authentication
    app.post('/auth/api', (req: any, res: any) => {
      const { apiKey } = req.body;
      
      if (apiKey === 'test-api-key-123') {
        const sessionId = 'api_session_' + Date.now() + '_' + Math.random().toString(36);
        sessions.set(sessionId, {
          username: 'api_user',
          loginTime: new Date(),
          method: 'api_key',
          permissions: ['read', 'write']
        });

        res.cookie('sessionId', sessionId, { httpOnly: true, maxAge: 3600000 });
        res.redirect('/dashboard');
      } else {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head><title>API Authentication Failed</title></head>
          <body>
            <h1>Authentication Failed</h1>
            <p data-testid="api-error-message">Invalid API key.</p>
            <a href="/login" data-testid="back-to-login">Back to Login</a>
          </body>
          </html>
        `);
      }
    });

    // Protected dashboard
    app.get('/dashboard', (req: any, res: any) => {
      const sessionId = req.cookies?.sessionId;
      const session = sessionId ? sessions.get(sessionId) : null;

      if (!session) {
        res.redirect('/login');
        return;
      }

      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Dashboard - Auth Test</title></head>
        <body>
          <h1>Protected Dashboard</h1>
          <nav>
            <a href="/" data-testid="home-link">Home</a> |
            <a href="/profile" data-testid="profile-link">Profile</a> |
            ${session.permissions.includes('admin') ? '<a href="/admin" data-testid="admin-link">Admin</a> |' : ''}
            <a href="/logout" data-testid="logout-link">Logout</a>
          </nav>
          <div class="user-info" data-testid="user-info">
            <h2>Welcome, ${session.username}!</h2>
            <p>Login method: ${session.method}</p>
            <p>Login time: ${session.loginTime.toISOString()}</p>
            <p>Permissions: ${session.permissions.join(', ')}</p>
          </div>
          <div class="dashboard-content">
            <h3>Protected Content</h3>
            <p>This content is only visible to authenticated users.</p>
            <div class="actions">
              <button onclick="loadData()" data-testid="load-data-btn">Load Data</button>
              ${session.permissions.includes('write') ? '<button onclick="saveData()" data-testid="save-data-btn">Save Data</button>' : ''}
            </div>
            <div id="data-container" data-testid="data-container"></div>
          </div>
          <script>
            function loadData() {
              fetch('/api/data')
                .then(response => response.json())
                .then(data => {
                  document.getElementById('data-container').innerHTML = 
                    '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
                });
            }
            function saveData() {
              fetch('/api/data', { method: 'POST', body: JSON.stringify({test: 'data'}) })
                .then(response => response.json())
                .then(result => alert('Data saved: ' + result.message));
            }
          </script>
        </body>
        </html>
      `);
    });

    // Profile page
    app.get('/profile', (req: any, res: any) => {
      const sessionId = req.cookies?.sessionId;
      const session = sessionId ? sessions.get(sessionId) : null;

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
          <nav>
            <a href="/dashboard" data-testid="dashboard-link">Dashboard</a> |
            <a href="/logout" data-testid="logout-link">Logout</a>
          </nav>
          <div class="profile-form">
            <form action="/api/profile" method="post" data-testid="profile-form">
              <label>Username: <input type="text" name="username" value="${session.username}" readonly data-testid="profile-username"></label>
              <label>Email: <input type="email" name="email" placeholder="user@example.com" data-testid="profile-email"></label>
              <label>Full Name: <input type="text" name="fullName" placeholder="Full Name" data-testid="profile-fullname"></label>
              <button type="submit" data-testid="update-profile-btn">Update Profile</button>
            </form>
          </div>
        </body>
        </html>
      `);
    });

    // Logout
    app.get('/logout', (req: any, res: any) => {
      const sessionId = req.cookies?.sessionId;
      if (sessionId) {
        sessions.delete(sessionId);
      }
      res.clearCookie('sessionId');
      res.redirect('/?message=logged_out');
    });

    // API endpoints
    app.get('/api/data', (req: any, res: any) => {
      const sessionId = req.cookies?.sessionId;
      const session = sessionId ? sessions.get(sessionId) : null;

      if (!session) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      res.json({
        message: 'Protected data',
        user: session.username,
        timestamp: new Date().toISOString(),
        data: ['item1', 'item2', 'item3']
      });
    });

    app.post('/api/data', (req: any, res: any) => {
      const sessionId = req.cookies?.sessionId;
      const session = sessionId ? sessions.get(sessionId) : null;

      if (!session || !session.permissions.includes('write')) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      res.json({ message: 'Data saved successfully' });
    });

    testServer = app.listen(testPort);
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(() => {
    if (testServer) {
      testServer.close();
      testServer = null;
    }
  });

  describe('Multi-Strategy Authentication', () => {
    it('should perform basic authentication workflow', async () => {
      const authManager = new MultiStrategyAuthManager({
        strategies: {
          basic: {
            enabled: true,
            loginUrl: `http://localhost:${testPort}/login`,
            usernameSelector: '[data-testid="username-input"]',
            passwordSelector: '[data-testid="password-input"]',
            submitSelector: '[data-testid="login-submit"]',
            successIndicator: '[data-testid="user-info"]',
          },
        },
        sessionConfig: {
          persistSessions: true,
          sessionTimeout: 3600000,
        },
      });

      const monitoring = new MonitoringService({
        enabled: true,
        reporting: { enabled: false },
      });
      await monitoring.initialize();

      try {
        const page = await browser.newPage();
        
        const result = await authManager.authenticate(page, 'basic', {
          username: 'admin',
          password: 'password',
        });

        expect(result.success).toBe(true);
        expect(result.strategy).toBe('basic');
        expect(result.session).toBeDefined();

        // Verify authentication worked
        const userInfo = await page.locator('[data-testid="user-info"]').textContent();
        expect(userInfo).toContain('admin');

        // Track authentication in monitoring
        monitoring.trackAuthenticationAttempt('basic', true);

        await page.close();

      } finally {
        await monitoring.shutdown();
      }
    }, 15000);

    it('should handle OAuth-style authentication', async () => {
      const authManager = new MultiStrategyAuthManager({
        strategies: {
          oauth: {
            enabled: true,
            loginUrl: `http://localhost:${testPort}/login`,
            oauthConfig: {
              provider: 'google',
              clientId: 'test-client-id',
              redirectUri: `http://localhost:${testPort}/auth/oauth/callback`,
            },
          },
        },
      });

      const page = await browser.newPage();

      try {
        await page.goto(`http://localhost:${testPort}/login`);
        
        // Click OAuth login button
        await page.click('[data-testid="google-login"]');
        await page.waitForLoadState('networkidle');

        // Should be on OAuth consent page
        expect(await page.title()).toContain('Google OAuth');

        // Allow OAuth access
        await page.click('[data-testid="oauth-allow"]');
        await page.waitForLoadState('networkidle');

        // Should be redirected to dashboard
        expect(await page.url()).toContain('/dashboard');
        
        const userInfo = await page.locator('[data-testid="user-info"]').textContent();
        expect(userInfo).toContain('google_user');

      } finally {
        await page.close();
      }
    }, 15000);

    it('should handle API key authentication', async () => {
      const authManager = new MultiStrategyAuthManager({
        strategies: {
          apiKey: {
            enabled: true,
            headerName: 'X-API-Key',
            paramName: 'apiKey',
          },
        },
      });

      const page = await browser.newPage();

      try {
        await page.goto(`http://localhost:${testPort}/login`);
        
        // Use API key login
        await page.fill('[data-testid="api-key-input"]', 'test-api-key-123');
        await page.click('[data-testid="api-login-submit"]');
        await page.waitForLoadState('networkidle');

        // Should be on dashboard
        expect(await page.url()).toContain('/dashboard');
        
        const userInfo = await page.locator('[data-testid="user-info"]').textContent();
        expect(userInfo).toContain('api_user');

      } finally {
        await page.close();
      }
    }, 10000);
  });

  describe('Session Management Integration', () => {
    it('should persist and restore authentication sessions', async () => {
      const sessionManager = new SessionManager({
        storage: { type: 'memory' },
        encryption: { enabled: false },
      });

      const authManager = new MultiStrategyAuthManager({
        strategies: {
          basic: {
            enabled: true,
            loginUrl: `http://localhost:${testPort}/login`,
            usernameSelector: '[data-testid="username-input"]',
            passwordSelector: '[data-testid="password-input"]',
            submitSelector: '[data-testid="login-submit"]',
            successIndicator: '[data-testid="user-info"]',
          },
        },
        sessionConfig: {
          persistSessions: true,
          sessionTimeout: 3600000,
        },
      });

      const page1 = await browser.newPage();
      const page2 = await browser.newPage();

      try {
        // Authenticate on first page
        const authResult = await authManager.authenticate(page1, 'basic', {
          username: 'user',
          password: 'secret',
        });

        expect(authResult.success).toBe(true);

        // Capture session
        const sessionId = 'test-session-restore';
        await sessionManager.captureSession(page1, sessionId, 'localhost');

        // Restore session on second page
        const restoreSuccess = await sessionManager.restoreSessionToPage(page2, sessionId, 'localhost');
        expect(restoreSuccess).toBe(true);

        // Navigate to protected page with restored session
        await page2.goto(`http://localhost:${testPort}/dashboard`);
        
        const userInfo = await page2.locator('[data-testid="user-info"]').textContent();
        expect(userInfo).toContain('user');

      } finally {
        await page1.close();
        await page2.close();
      }
    }, 15000);

    it('should handle session cleanup and expiration', async () => {
      const sessionManager = new SessionManager({
        storage: { type: 'memory' },
        cleanup: {
          maxAge: 1000, // 1 second for testing
          interval: 500, // Check every 0.5 seconds
        },
      });

      const page = await browser.newPage();

      try {
        await page.goto(`http://localhost:${testPort}/login`);
        
        // Create a session
        const sessionId = 'expiring-session';
        await sessionManager.captureSession(page, sessionId, 'localhost');

        // Verify session exists
        let session = await sessionManager.loadSession(sessionId, 'localhost');
        expect(session).toBeDefined();

        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Trigger cleanup
        await sessionManager.cleanup();

        // Session should be expired/cleaned up
        session = await sessionManager.loadSession(sessionId, 'localhost');
        expect(session).toBeNull();

      } finally {
        await page.close();
      }
    }, 5000);
  });

  describe('Stealth Mode with Authentication', () => {
    it('should authenticate while maintaining stealth', async () => {
      const stealth = new StealthMode({
        enabled: true,
        fingerprintSpoofing: {
          canvas: true,
          webgl: true,
          audio: true,
          fonts: true,
        },
        behaviorSimulation: {
          humanLikeDelays: true,
          randomizedTiming: true,
          mouseMovements: true,
        },
      });

      const page = await browser.newPage();

      try {
        await stealth.setupPage(page);
        await stealth.navigateStealthily(page, `http://localhost:${testPort}/login`);

        // Perform stealthy authentication
        await stealth.typeStealthily(page, '[data-testid="username-input"]', 'admin');
        await stealth.typeStealthily(page, '[data-testid="password-input"]', 'password');
        
        await stealth.clickStealthily(page, '[data-testid="login-submit"]');
        await page.waitForLoadState('networkidle');

        // Should be authenticated
        expect(await page.url()).toContain('/dashboard');
        
        const userInfo = await page.locator('[data-testid="user-info"]').textContent();
        expect(userInfo).toContain('admin');

      } finally {
        await page.close();
      }
    }, 15000);
  });

  describe('Authentication Error Handling', () => {
    it('should handle invalid credentials gracefully', async () => {
      const authManager = new MultiStrategyAuthManager({
        strategies: {
          basic: {
            enabled: true,
            loginUrl: `http://localhost:${testPort}/login`,
            usernameSelector: '[data-testid="username-input"]',
            passwordSelector: '[data-testid="password-input"]',
            submitSelector: '[data-testid="login-submit"]',
            errorSelector: '[data-testid="error-message"]',
          },
        },
      });

      const page = await browser.newPage();

      try {
        const result = await authManager.authenticate(page, 'basic', {
          username: 'invalid',
          password: 'wrong',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();

        // Should show error message
        const errorMessage = await page.locator('[data-testid="error-message"]').textContent();
        expect(errorMessage).toContain('Invalid username or password');

      } finally {
        await page.close();
      }
    }, 10000);

    it('should handle authentication timeouts', async () => {
      const authManager = new MultiStrategyAuthManager({
        strategies: {
          basic: {
            enabled: true,
            loginUrl: `http://localhost:9999/login`, // Non-existent server
            timeout: 2000, // Short timeout
          },
        },
      });

      const page = await browser.newPage();

      try {
        const result = await authManager.authenticate(page, 'basic', {
          username: 'admin',
          password: 'password',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('timeout');

      } finally {
        await page.close();
      }
    }, 10000);
  });

  describe('Authenticated Crawling Workflow', () => {
    it('should crawl protected content after authentication', async () => {
      const authManager = new MultiStrategyAuthManager({
        strategies: {
          basic: {
            enabled: true,
            loginUrl: `http://localhost:${testPort}/login`,
            usernameSelector: '[data-testid="username-input"]',
            passwordSelector: '[data-testid="password-input"]',
            submitSelector: '[data-testid="login-submit"]',
            successIndicator: '[data-testid="user-info"]',
          },
        },
      });

      const crawler = new BreadthFirstCrawler(browser);
      const monitoring = new MonitoringService({
        enabled: true,
        reporting: { enabled: false },
      });

      await monitoring.initialize();

      try {
        // First authenticate
        const page = await browser.newPage();
        const authResult = await authManager.authenticate(page, 'basic', {
          username: 'admin',
          password: 'password',
        });

        expect(authResult.success).toBe(true);

        // Now crawl with authenticated session
        const crawlResult = await crawler.crawl({
          startUrl: `http://localhost:${testPort}/dashboard`,
          maxDepth: 2,
          maxPages: 5,
          crawlDelay: 100,
          parallelWorkers: 1,
          allowedDomains: ['localhost'],
          preAuthenticatedPage: page, // Use authenticated page
          monitoring,
        });

        expect(crawlResult.crawledUrls.length).toBeGreaterThan(0);
        
        // Should have crawled protected content
        const dashboardUrl = crawlResult.crawledUrls.find(u => u.url.includes('/dashboard'));
        expect(dashboardUrl).toBeDefined();
        expect(dashboardUrl?.success).toBe(true);

        // Should have detected authenticated elements
        expect(dashboardUrl?.interactiveElements.length).toBeGreaterThan(0);

        await page.close();

      } finally {
        await monitoring.shutdown();
      }
    }, 20000);
  });
});