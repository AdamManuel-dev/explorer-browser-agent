import { Page, Cookie } from 'playwright';
import * as fs from 'fs/promises';
import { logger } from '../utils/logger';

export type AuthStrategy = 'basic' | 'oauth' | 'mfa' | 'api' | 'custom';

export interface AuthCredentials {
  username?: string;
  password?: string;
  email?: string;
  apiKey?: string;
  token?: string;
  clientId?: string;
  clientSecret?: string;
  mfaCode?: string;
  customFields?: Record<string, string>;
}

export interface AuthConfig {
  strategy: AuthStrategy;
  loginUrl?: string;
  credentials: AuthCredentials;
  sessionPersistence: boolean;
  cookieFile?: string;
  timeout?: number;
  selectors?: AuthSelectors;
  customFlow?: (page: Page, credentials: AuthCredentials) => Promise<boolean>;
}

export interface AuthSelectors {
  usernameField?: string;
  passwordField?: string;
  emailField?: string;
  submitButton?: string;
  mfaField?: string;
  mfaSubmitButton?: string;
  successIndicator?: string;
  errorIndicator?: string;
  logoutButton?: string;
}

export interface AuthSession {
  strategy: AuthStrategy;
  authenticated: boolean;
  userId?: string;
  sessionToken?: string;
  expiresAt?: Date;
  cookies: Cookie[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  metadata: Record<string, string | number | boolean>;
}

export interface AuthResult {
  success: boolean;
  session?: AuthSession;
  error?: string;
  requiresMFA?: boolean;
  redirectUrl?: string;
}

export class MultiStrategyAuthManager {
  private currentSession: AuthSession | null = null;

  private defaultSelectors: Record<AuthStrategy, AuthSelectors>;

  constructor() {
    this.defaultSelectors = this.initializeDefaultSelectors();
  }

  async authenticate(page: Page, config: AuthConfig): Promise<AuthResult> {
    logger.info('Starting authentication', {
      strategy: config.strategy,
      loginUrl: config.loginUrl,
    });

    try {
      // Load existing session if enabled
      if (config.sessionPersistence) {
        const existingSession = await this.loadSession(config);
        if (existingSession && (await this.validateSession(page, existingSession))) {
          await this.restoreSession(page, existingSession);
          this.currentSession = existingSession;
          return { success: true, session: existingSession };
        }
      }

      // Perform authentication based on strategy
      const result = await this.performAuthentication(page, config);

      // Save session if successful and persistence is enabled
      if (result.success && result.session && config.sessionPersistence) {
        await this.saveSession(result.session, config);
      }

      this.currentSession = result.session || null;
      return result;
    } catch (error) {
      logger.error('Authentication failed', { strategy: config.strategy, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async performAuthentication(page: Page, config: AuthConfig): Promise<AuthResult> {
    switch (config.strategy) {
      case 'basic':
        return this.basicAuth(page, config);
      case 'oauth':
        return this.oauthAuth(page, config);
      case 'mfa':
        return this.mfaAuth(page, config);
      case 'api':
        return this.apiAuth(page, config);
      case 'custom':
        return this.customAuth(page, config);
      default:
        throw new Error(`Unsupported authentication strategy: ${config.strategy}`);
    }
  }

  private async basicAuth(page: Page, config: AuthConfig): Promise<AuthResult> {
    const { credentials, loginUrl, timeout = 30000 } = config;
    const selectors = { ...this.defaultSelectors.basic, ...config.selectors };

    if (!credentials.username || !credentials.password) {
      throw new Error('Username and password required for basic authentication');
    }

    if (!loginUrl) {
      throw new Error('Login URL required for basic authentication');
    }

    // Navigate to login page
    await page.goto(loginUrl, { timeout });

    // Wait for login form
    await page.waitForSelector(selectors.usernameField!, { timeout });

    // Fill credentials
    await page.fill(selectors.usernameField!, credentials.username);
    await page.fill(selectors.passwordField!, credentials.password);

    // Submit form
    const navigationPromise = page.waitForNavigation({ timeout }).catch(() => null);
    await page.click(selectors.submitButton!);
    await navigationPromise;

    // Check for success
    const isSuccess = await this.checkAuthSuccess(page, selectors, timeout);

    if (isSuccess) {
      const session = await this.createSession(page, 'basic', credentials);
      return { success: true, session };
    }
    const errorMessage = await this.getErrorMessage(page, selectors);
    return { success: false, error: errorMessage || 'Login failed' };
  }

  private async oauthAuth(page: Page, config: AuthConfig): Promise<AuthResult> {
    const { credentials, loginUrl, timeout = 60000 } = config;

    if (!credentials.clientId || !loginUrl) {
      throw new Error('Client ID and login URL required for OAuth authentication');
    }

    // Navigate to OAuth provider
    await page.goto(loginUrl, { timeout });

    // Handle OAuth flow (this is a simplified version)
    if (credentials.username && credentials.password) {
      // Some OAuth providers allow direct credential entry
      await this.fillOAuthCredentials(page, credentials);
    }

    // Wait for OAuth callback
    await page.waitForURL(/callback|redirect/, { timeout });

    // Extract authorization code or token from URL
    const url = page.url();
    const urlParams = new URLSearchParams(url.split('?')[1]);
    const code = urlParams.get('code');
    const token = urlParams.get('access_token');

    if (code || token) {
      const session = await this.createSession(page, 'oauth', {
        ...credentials,
        token: token || code || undefined,
      });
      return { success: true, session };
    }
    return { success: false, error: 'OAuth flow failed - no authorization code received' };
  }

  private async mfaAuth(page: Page, config: AuthConfig): Promise<AuthResult> {
    // First perform basic auth
    const basicResult = await this.basicAuth(page, config);

    if (!basicResult.success) {
      return basicResult;
    }

    // Check if MFA is required
    const selectors = { ...this.defaultSelectors.mfa, ...config.selectors };
    const mfaRequired = await page
      .locator(selectors.mfaField!)
      .isVisible()
      .catch(() => false);

    if (!mfaRequired) {
      return basicResult; // No MFA required
    }

    if (!config.credentials.mfaCode) {
      return {
        success: false,
        requiresMFA: true,
        error: 'MFA code required but not provided',
      };
    }

    // Enter MFA code
    await page.fill(selectors.mfaField!, config.credentials.mfaCode);
    await page.click(selectors.mfaSubmitButton!);

    // Wait for navigation or success indicator
    await page.waitForTimeout(2000);

    const isSuccess = await this.checkAuthSuccess(page, selectors, config.timeout || 30000);

    if (isSuccess) {
      const session = await this.createSession(page, 'mfa', config.credentials);
      return { success: true, session };
    }
    return { success: false, error: 'MFA verification failed' };
  }

  private async apiAuth(page: Page, config: AuthConfig): Promise<AuthResult> {
    const { credentials } = config;

    if (!credentials.apiKey) {
      throw new Error('API key required for API authentication');
    }

    // Set API key in headers for subsequent requests
    await page.setExtraHTTPHeaders({
      Authorization: `Bearer ${credentials.apiKey}`,
      'X-API-Key': credentials.apiKey,
    });

    // Create session without navigation
    const session: AuthSession = {
      strategy: 'api',
      authenticated: true,
      sessionToken: credentials.apiKey,
      cookies: [],
      localStorage: {},
      sessionStorage: {},
      metadata: { apiKeySet: true },
    };

    return { success: true, session };
  }

  private async customAuth(page: Page, config: AuthConfig): Promise<AuthResult> {
    if (!config.customFlow) {
      throw new Error('Custom authentication flow function required');
    }

    const success = await config.customFlow(page, config.credentials);

    if (success) {
      const session = await this.createSession(page, 'custom', config.credentials);
      return { success: true, session };
    }
    return { success: false, error: 'Custom authentication flow failed' };
  }

  private async createSession(
    page: Page,
    strategy: AuthStrategy,
    credentials: AuthCredentials
  ): Promise<AuthSession> {
    const cookies = await page.context().cookies();
    const localStorage = await page.evaluate(() => {
      const items: Record<string, string> = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) {
          items[key] = window.localStorage.getItem(key) || '';
        }
      }
      return items;
    });

    const sessionStorage = await page.evaluate(() => {
      const items: Record<string, string> = {};
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key) {
          items[key] = window.sessionStorage.getItem(key) || '';
        }
      }
      return items;
    });

    return {
      strategy,
      authenticated: true,
      userId: credentials.username || credentials.email,
      sessionToken: this.extractSessionToken(localStorage, sessionStorage, cookies),
      cookies,
      localStorage,
      sessionStorage,
      metadata: {
        loginTime: new Date().toISOString(),
        userAgent: await page.evaluate(() => navigator.userAgent),
      },
    };
  }

  async logout(page: Page): Promise<boolean> {
    if (!this.currentSession) {
      return true; // Already logged out
    }

    try {
      // Try to find and click logout button
      const logoutSelectors = [
        'button:has-text("Logout")',
        'button:has-text("Sign Out")',
        'a:has-text("Logout")',
        'a:has-text("Sign Out")',
        '[data-testid="logout"]',
        '.logout',
        '#logout',
      ];

      for (const selector of logoutSelectors) {
        try {
          const element = await page.locator(selector).first();
          if (await element.isVisible()) {
            await element.click();
            await page.waitForTimeout(1000);
            break;
          }
        } catch {
          // Continue to next selector
        }
      }

      // Clear session data
      await page.context().clearCookies();
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      this.currentSession = null;
      logger.info('Logout completed successfully');
      return true;
    } catch (error) {
      logger.error('Logout failed', error);
      return false;
    }
  }

  async validateSession(page: Page, session: AuthSession): Promise<boolean> {
    try {
      // Check if session is expired
      if (session.expiresAt && session.expiresAt < new Date()) {
        return false;
      }

      // Try to restore session and check if it's still valid
      await this.restoreSession(page, session);

      // Navigate to a protected page to test authentication
      await page.reload();

      // If we're redirected to login page, session is invalid
      if (page.url().includes('login') || page.url().includes('signin')) {
        return false;
      }

      return true;
    } catch (error) {
      logger.debug('Session validation failed', error);
      return false;
    }
  }

  async restoreSession(page: Page, session: AuthSession): Promise<void> {
    try {
      // Restore cookies
      await page.context().addCookies(session.cookies);

      // Restore localStorage and sessionStorage
      await page.evaluate(
        (data) => {
          Object.entries(data.localStorage).forEach(([key, value]) => {
            localStorage.setItem(key, value);
          });
          Object.entries(data.sessionStorage).forEach(([key, value]) => {
            sessionStorage.setItem(key, value);
          });
        },
        { localStorage: session.localStorage, sessionStorage: session.sessionStorage }
      );

      logger.debug('Session restored successfully');
    } catch (error) {
      logger.error('Failed to restore session', error);
      throw error;
    }
  }

  private async saveSession(session: AuthSession, config: AuthConfig): Promise<void> {
    try {
      const sessionFile = config.cookieFile || 'browser-explorer-session.json';
      const sessionData = {
        ...session,
        savedAt: new Date().toISOString(),
      };

      await fs.writeFile(sessionFile, JSON.stringify(sessionData, null, 2));
      logger.debug('Session saved to file', { file: sessionFile });
    } catch (error) {
      logger.error('Failed to save session', error);
    }
  }

  private async loadSession(config: AuthConfig): Promise<AuthSession | null> {
    try {
      const sessionFile = config.cookieFile || 'browser-explorer-session.json';
      const content = await fs.readFile(sessionFile, 'utf8');
      const sessionData = JSON.parse(content);

      // Convert date strings back to Date objects
      if (sessionData.expiresAt) {
        sessionData.expiresAt = new Date(sessionData.expiresAt);
      }

      logger.debug('Session loaded from file', { file: sessionFile });
      return sessionData;
    } catch (error) {
      logger.debug('No existing session found', error);
      return null;
    }
  }

  private async checkAuthSuccess(
    page: Page,
    selectors: AuthSelectors,
    _timeout: number
  ): Promise<boolean> {
    try {
      // Check for success indicator
      if (selectors.successIndicator) {
        await page.waitForSelector(selectors.successIndicator, { timeout: 5000 });
        return true;
      }

      // Check for error indicator (absence means success)
      if (selectors.errorIndicator) {
        const hasError = await page.locator(selectors.errorIndicator).isVisible();
        return !hasError;
      }

      // Check if we're no longer on login page
      const currentUrl = page.url();
      return !currentUrl.includes('login') && !currentUrl.includes('signin');
    } catch {
      return false;
    }
  }

  private async getErrorMessage(page: Page, selectors: AuthSelectors): Promise<string | null> {
    try {
      if (selectors.errorIndicator) {
        const errorElement = page.locator(selectors.errorIndicator);
        if (await errorElement.isVisible()) {
          return await errorElement.textContent();
        }
      }

      // Look for common error message selectors
      const errorSelectors = [
        '.error',
        '.alert-error',
        '.danger',
        '.invalid-feedback',
        '[role="alert"]',
      ];

      for (const selector of errorSelectors) {
        try {
          const element = page.locator(selector);
          if (await element.isVisible()) {
            return await element.textContent();
          }
        } catch {
          // Continue to next selector
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private async fillOAuthCredentials(page: Page, credentials: AuthCredentials): Promise<void> {
    // This is a simplified OAuth credential filling
    // In practice, each OAuth provider has different selectors
    try {
      await page.fill('input[type="email"]', credentials.email || credentials.username || '');
      await page.fill('input[type="password"]', credentials.password || '');
      await page.click('button[type="submit"]');
    } catch (error) {
      logger.debug('Failed to fill OAuth credentials', error);
    }
  }

  private extractSessionToken(
    localStorage: Record<string, string>,
    sessionStorage: Record<string, string>,
    cookies: Cookie[]
  ): string | undefined {
    // Look for common token patterns
    const tokenKeys = ['token', 'accessToken', 'authToken', 'sessionToken', 'jwt'];

    // Check localStorage
    for (const key of tokenKeys) {
      if (localStorage[key]) return localStorage[key];
    }

    // Check sessionStorage
    for (const key of tokenKeys) {
      if (sessionStorage[key]) return sessionStorage[key];
    }

    // Check cookies
    const tokenCookie = cookies.find((cookie) =>
      tokenKeys.some((key) => cookie.name.toLowerCase().includes(key))
    );

    return tokenCookie?.value;
  }

  private initializeDefaultSelectors(): Record<AuthStrategy, AuthSelectors> {
    return {
      basic: {
        usernameField:
          'input[name="username"], input[name="email"], input[type="email"], #username, #email',
        passwordField: 'input[name="password"], input[type="password"], #password',
        submitButton:
          'button[type="submit"], input[type="submit"], .login-button, #login, button:has-text("Login")',
        successIndicator: '.dashboard, .welcome, [data-testid="home"]',
        errorIndicator: '.error, .alert-danger, .invalid-feedback',
      },
      oauth: {
        submitButton: 'button[type="submit"], .oauth-button, button:has-text("Continue")',
        successIndicator: 'body:has(text("callback")), body:has(text("redirect"))',
      },
      mfa: {
        mfaField: 'input[name="mfa"], input[name="code"], input[name="token"], #mfa-code',
        mfaSubmitButton:
          'button:has-text("Verify"), button:has-text("Submit"), button[type="submit"]',
        successIndicator: '.dashboard, .welcome, [data-testid="home"]',
        errorIndicator: '.error, .alert-danger, .invalid-code',
      },
      api: {},
      custom: {},
    };
  }

  getCurrentSession(): AuthSession | null {
    return this.currentSession;
  }

  getAvailableStrategies(): AuthStrategy[] {
    return ['basic', 'oauth', 'mfa', 'api', 'custom'];
  }

  isAuthenticated(): boolean {
    return this.currentSession?.authenticated || false;
  }
}
