import { Browser, BrowserContext, Page } from 'playwright';
import { logger } from '../utils/logger';

export interface StealthConfig {
  userAgents: {
    enabled: boolean;
    rotateOnNewPage: boolean;
    customAgents?: string[];
  };
  viewport: {
    randomize: boolean;
    commonSizes: Array<{ width: number; height: number }>;
  };
  timing: {
    humanLikeDelays: boolean;
    minDelay: number;
    maxDelay: number;
    typingSpeed: {
      min: number;
      max: number;
    };
  };
  fingerprinting: {
    spoofWebGL: boolean;
    spoofCanvas: boolean;
    spoofAudio: boolean;
    spoofTimezone: boolean;
    spoofLanguages: boolean;
  };
  navigation: {
    randomScrolling: boolean;
    mouseMoves: boolean;
    refererSpoofing: boolean;
  };
  headers: {
    acceptLanguage: string[];
    acceptEncoding: string[];
    customHeaders: Record<string, string>;
  };
}

export interface StealthMetrics {
  detectionAttempts: number;
  successfulEvasions: number;
  failedEvasions: number;
  averagePageLoadTime: number;
  userAgentRotations: number;
}

export class StealthMode {
  private config: StealthConfig;

  private metrics: StealthMetrics;

  private userAgentPool: string[];

  private currentUserAgentIndex = 0;

  constructor(config?: Partial<StealthConfig>) {
    this.config = this.mergeWithDefaults(config || {});
    this.metrics = {
      detectionAttempts: 0,
      successfulEvasions: 0,
      failedEvasions: 0,
      averagePageLoadTime: 0,
      userAgentRotations: 0,
    };
    this.userAgentPool = this.buildUserAgentPool();
  }

  async setupStealthBrowser(browser: Browser): Promise<BrowserContext> {
    logger.info('Setting up stealth browser context');

    const context = await browser.newContext({
      // Basic stealth settings
      userAgent: this.getRandomUserAgent(),
      viewport: this.getRandomViewport(),
      locale: this.getRandomLocale(),
      timezoneId: this.config.fingerprinting.spoofTimezone ? this.getRandomTimezone() : undefined,

      // HTTP settings
      extraHTTPHeaders: this.buildStealthHeaders(),

      // Permissions
      permissions: [],

      // Geolocation spoofing
      geolocation: this.getRandomGeolocation(),

      // Media settings
      colorScheme: Math.random() > 0.5 ? 'light' : 'dark',
      reducedMotion: Math.random() > 0.8 ? 'reduce' : 'no-preference',
    });

    // Add stealth scripts
    await this.injectStealthScripts(context);

    // Set up request/response interceptors
    await this.setupRequestInterception(context);

    logger.info('Stealth browser context configured successfully');
    return context;
  }

  async setupStealthPage(page: Page): Promise<void> {
    logger.debug('Setting up stealth page');

    // Inject stealth scripts before any page loads
    await page.addInitScript(this.getStealthScript());

    // Set up page event handlers
    this.setupPageEventHandlers(page);

    // Apply additional stealth measures
    await this.applyPageStealthMeasures(page);

    logger.debug('Stealth page configured successfully');
  }

  async navigateStealthily(page: Page, url: string): Promise<void> {
    logger.debug('Navigating stealthily to:', url);

    const startTime = Date.now();

    try {
      // Add human-like delay before navigation
      if (this.config.timing.humanLikeDelays) {
        await this.humanDelay();
      }

      // Rotate user agent if configured
      if (this.config.userAgents.rotateOnNewPage) {
        await this.rotateUserAgent(page);
      }

      // Navigate with stealth
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Simulate human behavior after load
      await this.simulateHumanBehavior(page);

      const loadTime = Date.now() - startTime;
      this.updateMetrics('navigation', true, loadTime);

      logger.debug('Stealth navigation completed successfully');
    } catch (error) {
      this.updateMetrics('navigation', false);
      logger.error('Stealth navigation failed', error);
      throw error;
    }
  }

  async typeStealthily(page: Page, selector: string, text: string): Promise<void> {
    logger.debug('Typing stealthily', { selector, textLength: text.length });

    const element = page.locator(selector);

    // Clear existing content
    await element.clear();

    // Type with human-like speed and pauses
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      await element.type(char);

      // Random delay between keystrokes
      const delay = this.getTypingDelay();
      await page.waitForTimeout(delay);

      // Occasional longer pauses (thinking time)
      if (Math.random() < 0.05) {
        await page.waitForTimeout(this.randomBetween(500, 1500));
      }
    }

    logger.debug('Stealth typing completed');
  }

  async clickStealthily(page: Page, selector: string): Promise<void> {
    logger.debug('Clicking stealthily', { selector });

    const element = page.locator(selector);

    // Move mouse to element first
    if (this.config.navigation.mouseMoves) {
      await element.hover();
      await this.humanDelay(100, 300);
    }

    // Simulate human-like click with slight randomization
    const box = await element.boundingBox();
    if (box) {
      const x = box.x + box.width * (0.2 + Math.random() * 0.6);
      const y = box.y + box.height * (0.2 + Math.random() * 0.6);

      await page.mouse.click(x, y, {
        delay: this.randomBetween(50, 150),
      });
    } else {
      await element.click();
    }

    // Brief pause after click
    await this.humanDelay(200, 500);

    logger.debug('Stealth click completed');
  }

  async detectBotDetection(page: Page): Promise<boolean> {
    logger.debug('Checking for bot detection');

    this.metrics.detectionAttempts++;

    const detectionIndicators = [
      // Common bot detection patterns
      () => page.locator('text="Access Denied"').isVisible(),
      () => page.locator('text="Bot Detected"').isVisible(),
      () => page.locator('text="Suspicious Activity"').isVisible(),
      () => page.locator('[id*="captcha"]').isVisible(),
      () => page.locator('[class*="captcha"]').isVisible(),
      () => page.locator('text="Please verify you are human"').isVisible(),
      () => page.locator('text="Security Check"').isVisible(),

      // Cloudflare detection
      () => page.locator('text="Checking your browser"').isVisible(),
      () => page.locator('.cf-browser-verification').isVisible(),

      // Custom detection check
      () =>
        page.evaluate(
          () =>
            // Check for common bot detection variables
            !!(window as unknown as { webdriver?: boolean }).webdriver ||
            !!(window as unknown as { phantom?: boolean }).phantom ||
            !!(window as unknown as { callPhantom?: boolean }).callPhantom ||
            navigator.webdriver === true
        ),
    ];

    for (const check of detectionIndicators) {
      try {
        if (await check()) {
          logger.warn('Bot detection detected');
          this.metrics.failedEvasions++;
          return true;
        }
      } catch (error) {
        // Ignore individual check errors
      }
    }

    this.metrics.successfulEvasions++;
    logger.debug('No bot detection found');
    return false;
  }

  getMetrics(): StealthMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      detectionAttempts: 0,
      successfulEvasions: 0,
      failedEvasions: 0,
      averagePageLoadTime: 0,
      userAgentRotations: 0,
    };
  }

  getConfig(): StealthConfig {
    return { ...this.config };
  }

  generateRandomUserAgent(): string {
    return this.getRandomUserAgent();
  }

  // Private methods
  private async injectStealthScripts(context: BrowserContext): Promise<void> {
    await context.addInitScript(this.getStealthScript());
  }

  private getStealthScript(): string {
    return `
    (function() {
      // Override webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Override plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' },
        ],
      });

      // Override languages
      ${
        this.config.fingerprinting.spoofLanguages
          ? `
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      `
          : ''
      }

      // Override canvas fingerprinting
      ${
        this.config.fingerprinting.spoofCanvas
          ? `
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type) {
        if (type === '2d') {
          const context = getContext.call(this, type);
          const getImageData = context.getImageData;
          context.getImageData = function(sx, sy, sw, sh) {
            const imageData = getImageData.call(this, sx, sy, sw, sh);
            for (let i = 0; i < imageData.data.length; i += 4) {
              imageData.data[i] += Math.floor(Math.random() * 10) - 5;
              imageData.data[i + 1] += Math.floor(Math.random() * 10) - 5;
              imageData.data[i + 2] += Math.floor(Math.random() * 10) - 5;
            }
            return imageData;
          };
          return context;
        }
        return getContext.call(this, type);
      };
      `
          : ''
      }

      // Override WebGL fingerprinting
      ${
        this.config.fingerprinting.spoofWebGL
          ? `
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) return 'Intel Inc.';
        if (parameter === 37446) return 'Intel Iris OpenGL Engine';
        return getParameter.call(this, parameter);
      };
      `
          : ''
      }

      // Override audio fingerprinting
      ${
        this.config.fingerprinting.spoofAudio
          ? `
      const createAnalyser = AudioContext.prototype.createAnalyser;
      AudioContext.prototype.createAnalyser = function() {
        const analyser = createAnalyser.call(this);
        const getFloatFrequencyData = analyser.getFloatFrequencyData;
        analyser.getFloatFrequencyData = function(array) {
          getFloatFrequencyData.call(this, array);
          for (let i = 0; i < array.length; i++) {
            array[i] += Math.random() * 0.1 - 0.05;
          }
        };
        return analyser;
      };
      `
          : ''
      }

      // Hide automation indicators
      delete window.webdriver;
      delete window.phantom;
      delete window.callPhantom;
      delete window._phantom;
      delete window.Buffer;
      delete window.emit;
      delete window.spawn;

      // Override chrome runtime
      if (!window.chrome) {
        window.chrome = {
          runtime: {
            onConnect: undefined,
            onMessage: undefined,
          },
        };
      }

      // Override permission API
      const originalQuery = navigator.permissions.query;
      navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );

      // Stealth mode activated (logging handled by browser console)
    })();
    `;
  }

  private async setupRequestInterception(context: BrowserContext): Promise<void> {
    await context.route('**/*', async (route) => {
      const request = route.request();
      const headers = { ...request.headers() };

      // Add/modify headers for stealth
      if (this.config.headers.customHeaders) {
        Object.assign(headers, this.config.headers.customHeaders);
      }

      // Random Accept-Language
      if (this.config.headers.acceptLanguage.length > 0) {
        headers['Accept-Language'] = this.getRandomItem(this.config.headers.acceptLanguage);
      }

      // Random Accept-Encoding
      if (this.config.headers.acceptEncoding.length > 0) {
        headers['Accept-Encoding'] = this.getRandomItem(this.config.headers.acceptEncoding);
      }

      // Spoof referrer
      if (this.config.navigation.refererSpoofing && Math.random() < 0.3) {
        headers.Referer = 'https://www.google.com/';
      }

      await route.continue({ headers });
    });
  }

  private setupPageEventHandlers(page: Page): void {
    page.on('response', (response) => {
      // Monitor for bot detection responses
      if (response.status() === 403 || response.status() === 429) {
        logger.warn('Potential bot detection response', {
          url: response.url(),
          status: response.status(),
        });
      }
    });
  }

  async applyPageStealthMeasures(page: Page): Promise<void> {
    // Set random viewport if enabled
    if (this.config.viewport.randomize) {
      const viewport = this.getRandomViewport();
      await page.setViewportSize(viewport);
    }
  }

  private async simulateHumanBehavior(page: Page): Promise<void> {
    // Random scrolling
    if (this.config.navigation.randomScrolling && Math.random() < 0.4) {
      await this.randomScroll(page);
    }

    // Random mouse movements
    if (this.config.navigation.mouseMoves && Math.random() < 0.3) {
      await this.randomMouseMove(page);
    }

    // Brief pause
    await this.humanDelay(500, 1500);
  }

  private async randomScroll(page: Page): Promise<void> {
    const scrollAmount = this.randomBetween(100, 500);
    await page.mouse.wheel(0, scrollAmount);
    await this.humanDelay(100, 300);
  }

  private async randomMouseMove(page: Page): Promise<void> {
    const viewport = page.viewportSize();
    if (viewport) {
      const x = this.randomBetween(100, viewport.width - 100);
      const y = this.randomBetween(100, viewport.height - 100);
      await page.mouse.move(x, y);
    }
  }

  private async rotateUserAgent(page: Page): Promise<void> {
    const newUserAgent = this.getRandomUserAgent();
    await page.setExtraHTTPHeaders({ 'User-Agent': newUserAgent });
    this.metrics.userAgentRotations++;
    logger.debug('User agent rotated', { userAgent: newUserAgent });
  }

  private getRandomUserAgent(): string {
    if (this.config.userAgents.enabled) {
      const agent = this.userAgentPool[this.currentUserAgentIndex];
      this.currentUserAgentIndex = (this.currentUserAgentIndex + 1) % this.userAgentPool.length;
      return agent;
    }
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  private getRandomViewport(): { width: number; height: number } {
    return this.getRandomItem(this.config.viewport.commonSizes);
  }

  private getRandomLocale(): string {
    const locales = ['en-US', 'en-GB', 'de-DE', 'fr-FR', 'es-ES', 'it-IT'];
    return this.getRandomItem(locales);
  }

  private getRandomTimezone(): string {
    const timezones = [
      'America/New_York',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Asia/Tokyo',
    ];
    return this.getRandomItem(timezones);
  }

  private getRandomGeolocation(): { latitude: number; longitude: number } {
    const locations = [
      { latitude: 40.7128, longitude: -74.006 }, // New York
      { latitude: 34.0522, longitude: -118.2437 }, // Los Angeles
      { latitude: 51.5074, longitude: -0.1278 }, // London
      { latitude: 48.8566, longitude: 2.3522 }, // Paris
    ];
    return this.getRandomItem(locations);
  }

  private buildStealthHeaders(): Record<string, string> {
    return {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': this.getRandomItem(this.config.headers.acceptLanguage),
      'Accept-Encoding': this.getRandomItem(this.config.headers.acceptEncoding),
      DNT: '1',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      ...this.config.headers.customHeaders,
    };
  }

  private buildUserAgentPool(): string[] {
    const defaultAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ];

    return this.config.userAgents.customAgents || defaultAgents;
  }

  private async humanDelay(
    min = this.config.timing.minDelay,
    max = this.config.timing.maxDelay
  ): Promise<void> {
    if (this.config.timing.humanLikeDelays) {
      const delay = this.randomBetween(min, max);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  private getTypingDelay(): number {
    return this.randomBetween(
      this.config.timing.typingSpeed.min,
      this.config.timing.typingSpeed.max
    );
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private getRandomItem<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  private updateMetrics(operation: string, success: boolean, timing?: number): void {
    if (timing) {
      this.metrics.averagePageLoadTime = (this.metrics.averagePageLoadTime + timing) / 2;
    }

    logger.debug('Stealth metrics updated', {
      operation,
      success,
      timing,
      metrics: this.metrics,
    });
  }

  private mergeWithDefaults(config: Partial<StealthConfig>): StealthConfig {
    return {
      userAgents: {
        enabled: true,
        rotateOnNewPage: true,
        customAgents: undefined,
        ...config.userAgents,
      },
      viewport: {
        randomize: true,
        commonSizes: [
          { width: 1920, height: 1080 },
          { width: 1366, height: 768 },
          { width: 1440, height: 900 },
          { width: 1536, height: 864 },
          { width: 1280, height: 720 },
        ],
        ...config.viewport,
      },
      timing: {
        humanLikeDelays: true,
        minDelay: 100,
        maxDelay: 500,
        typingSpeed: {
          min: 50,
          max: 150,
        },
        ...config.timing,
      },
      fingerprinting: {
        spoofWebGL: true,
        spoofCanvas: true,
        spoofAudio: true,
        spoofTimezone: true,
        spoofLanguages: true,
        ...config.fingerprinting,
      },
      navigation: {
        randomScrolling: true,
        mouseMoves: true,
        refererSpoofing: true,
        ...config.navigation,
      },
      headers: {
        acceptLanguage: ['en-US,en;q=0.9', 'en-GB,en;q=0.8', 'en;q=0.7'],
        acceptEncoding: ['gzip, deflate, br', 'gzip, deflate'],
        customHeaders: {},
        ...config.headers,
      },
    };
  }
}
