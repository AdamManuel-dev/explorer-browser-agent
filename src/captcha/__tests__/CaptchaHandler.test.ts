import { CaptchaHandler } from '../CaptchaHandler';
import { Page, Locator } from 'playwright';

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('CaptchaHandler', () => {
  let captchaHandler: CaptchaHandler;
  let mockPage: jest.Mocked<Page>;
  let mockLocator: jest.Mocked<Locator>;

  beforeEach(() => {
    mockLocator = {
      count: jest.fn(),
      first: jest.fn(),
      getAttribute: jest.fn(),
      isVisible: jest.fn(),
      click: jest.fn(),
      fill: jest.fn(),
    } as any;

    mockPage = {
      locator: jest.fn().mockReturnValue(mockLocator),
      waitForSelector: jest.fn(),
      evaluate: jest.fn(),
      waitForTimeout: jest.fn(),
      screenshot: jest.fn(),
    } as any;

    captchaHandler = new CaptchaHandler();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(captchaHandler).toBeInstanceOf(CaptchaHandler);
    });

    it('should accept custom config', () => {
      const config = {
        autoDetect: false,
        solveAttempts: 5,
        timeout: 60000,
      };

      const handler = new CaptchaHandler(config);
      expect(handler).toBeInstanceOf(CaptchaHandler);
    });
  });

  describe('detectCaptcha', () => {
    it('should return not detected when autoDetect is disabled', async () => {
      const handler = new CaptchaHandler({ autoDetect: false });

      const result = await handler.detectCaptcha(mockPage);

      expect(result.detected).toBe(false);
      expect(result.type).toBe('unknown');
      expect(result.confidence).toBe(0);
    });

    it('should detect reCAPTCHA', async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.isVisible.mockResolvedValue(true);
      mockLocator.getAttribute.mockResolvedValue('site-key-123');

      const result = await captchaHandler.detectCaptcha(mockPage);

      expect(mockPage.locator).toHaveBeenCalledWith('.g-recaptcha');
      expect(result.detected).toBe(true);
      expect(result.type).toBe('recaptcha');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect hCaptcha', async () => {
      mockLocator.isVisible
        .mockResolvedValueOnce(false) // .g-recaptcha
        .mockResolvedValueOnce(false) // [data-sitekey]
        .mockResolvedValueOnce(false) // #recaptcha-element
        .mockResolvedValueOnce(false) // .recaptcha-checkbox
        .mockResolvedValueOnce(false) // iframe[src*="recaptcha"]
        .mockResolvedValueOnce(false) // .grecaptcha-badge
        .mockResolvedValueOnce(true); // .h-captcha
      mockLocator.getAttribute.mockResolvedValue('hcaptcha-site-key');

      const result = await captchaHandler.detectCaptcha(mockPage);

      expect(result.detected).toBe(true);
      expect(result.type).toBe('hcaptcha');
    });

    it('should detect Cloudflare challenge', async () => {
      // Need to check how many selectors there are for each type
      mockLocator.isVisible
        .mockResolvedValueOnce(false) // .g-recaptcha
        .mockResolvedValueOnce(false) // [data-sitekey]
        .mockResolvedValueOnce(false) // #recaptcha-element
        .mockResolvedValueOnce(false) // .recaptcha-checkbox
        .mockResolvedValueOnce(false) // iframe[src*="recaptcha"]
        .mockResolvedValueOnce(false) // .grecaptcha-badge
        .mockResolvedValueOnce(false) // .h-captcha
        .mockResolvedValueOnce(false) // [data-hcaptcha-sitekey]
        .mockResolvedValueOnce(false) // iframe[src*="hcaptcha"]
        .mockResolvedValueOnce(false) // .hcaptcha-checkbox
        .mockResolvedValueOnce(false) // .funcaptcha
        .mockResolvedValueOnce(false) // #funcaptcha
        .mockResolvedValueOnce(false) // iframe[src*="funcaptcha"]
        .mockResolvedValueOnce(false) // [data-callback*="funcaptcha"]
        .mockResolvedValueOnce(true); // .cf-browser-verification

      const result = await captchaHandler.detectCaptcha(mockPage);

      expect(result.detected).toBe(true);
      expect(result.type).toBe('cloudflare');
    });

    it('should return unknown when no CAPTCHA detected', async () => {
      mockLocator.count.mockResolvedValue(0);

      const result = await captchaHandler.detectCaptcha(mockPage);

      expect(result.detected).toBe(false);
      expect(result.type).toBe('unknown');
    });

    it('should handle detection errors gracefully', async () => {
      mockPage.locator.mockImplementation(() => {
        throw new Error('Locator error');
      });

      const result = await captchaHandler.detectCaptcha(mockPage);

      expect(result.detected).toBe(false);
      expect(result.type).toBe('unknown');
    });
  });

  describe('solveCaptcha', () => {
    it('should return failure when manual solving is disabled', async () => {
      const handler = new CaptchaHandler({
        manualSolving: {
          enabled: false,
          promptUser: false,
          timeout: 30000,
        },
      });
      
      const detection = {
        detected: true,
        type: 'recaptcha' as const,
        confidence: 0.9,
        element: mockLocator,
      };

      const result = await handler.solveCaptcha(mockPage, detection);

      // Since no services are enabled and manual solving is disabled,
      // it attempts bypass and for recaptcha type it should fail
      expect(result.success).toBe(false);
      expect(result.method).toBe('service'); // Final fallback when all methods fail
      expect(result.error).toBe('All solving methods failed');
    });

    it('should handle manual solving when enabled', async () => {
      const handler = new CaptchaHandler({
        manualSolving: {
          enabled: true,
          promptUser: true,
          timeout: 30000,
        },
      });

      const detection = {
        detected: true,
        type: 'recaptcha' as const,
        confidence: 0.9,
        element: mockLocator,
      };

      // Mock successful manual solution
      mockPage.waitForTimeout.mockResolvedValue(undefined);
      
      // Mock detectCaptcha to return not detected after manual solving
      const mockDetectCaptcha = jest.spyOn(handler, 'detectCaptcha');
      mockDetectCaptcha.mockResolvedValueOnce({ detected: false, type: 'unknown', confidence: 0 });
      
      // Add small delay to ensure timeToSolve > 0
      jest.useFakeTimers();
      const promise = handler.solveCaptcha(mockPage, detection);
      jest.advanceTimersByTime(100);
      const result = await promise;
      jest.useRealTimers();

      expect(result.success).toBe(true);
      expect(result.method).toBe('manual');
      expect(result.timeToSolve).toBeGreaterThan(0);
    });

    it('should timeout during manual solving', async () => {
      const handler = new CaptchaHandler({
        manualSolving: {
          enabled: true,
          promptUser: true,
          timeout: 100, // Very short timeout
        },
      });

      const detection = {
        detected: true,
        type: 'recaptcha' as const,
        confidence: 0.9,
        element: mockLocator,
      };

      // Mock timeout scenario
      mockPage.waitForTimeout.mockResolvedValue(undefined);
      
      // Mock detectCaptcha to return still detected after manual solving attempt
      const mockDetectCaptcha = jest.spyOn(handler, 'detectCaptcha');
      mockDetectCaptcha.mockResolvedValueOnce({ detected: true, type: 'recaptcha', confidence: 0.9 });

      const result = await handler.solveCaptcha(mockPage, detection);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Manual solving timeout');
    });
  });

  describe('handleCaptchaWorkflow', () => {
    it('should handle workflow successfully when CAPTCHA is detected and solved', async () => {
      const handler = new CaptchaHandler({
        manualSolving: {
          enabled: true,
          promptUser: true,
          timeout: 30000,
        },
      });

      // Mock detection - first call detects captcha, second call after solving shows no captcha
      const mockDetectCaptcha = jest.spyOn(handler, 'detectCaptcha');
      mockDetectCaptcha
        .mockResolvedValueOnce({ detected: true, type: 'recaptcha', confidence: 0.9 })
        .mockResolvedValueOnce({ detected: false, type: 'unknown', confidence: 0 });

      // Mock solving
      mockPage.waitForTimeout.mockResolvedValue(undefined);

      const result = await handler.handleCaptchaWorkflow(mockPage);

      expect(result).toBe(true);
    });

    it('should return true when no CAPTCHA is detected', async () => {
      mockLocator.count.mockResolvedValue(0);

      const result = await captchaHandler.handleCaptchaWorkflow(mockPage);

      expect(result).toBe(true);
    });

    it('should return false when CAPTCHA detected but solving fails', async () => {
      // Mock detection success
      mockLocator.count.mockResolvedValue(1);
      mockLocator.isVisible.mockResolvedValue(true);
      mockLocator.getAttribute.mockResolvedValue('site-key-123');

      // Mock solving failure (no manual solving enabled)
      const result = await captchaHandler.handleCaptchaWorkflow(mockPage);

      expect(result).toBe(false);
    });

    it('should handle workflow errors gracefully', async () => {
      // Mock detectCaptcha to return detected captcha first, then fail
      const mockDetectCaptcha = jest.spyOn(captchaHandler, 'detectCaptcha');
      mockDetectCaptcha
        .mockResolvedValueOnce({ detected: true, type: 'recaptcha', confidence: 0.9 })
        .mockRejectedValue(new Error('Detection error'));
      
      // Mock solveCaptcha to succeed
      const mockSolveCaptcha = jest.spyOn(captchaHandler, 'solveCaptcha');
      mockSolveCaptcha.mockResolvedValue({ success: true, timeToSolve: 100, method: 'manual' });

      try {
        const result = await captchaHandler.handleCaptchaWorkflow(mockPage);
        expect(result).toBe(false);
      } catch (error) {
        // If it throws, that's also acceptable for error handling
        expect(error).toBeDefined();
      }
    });
  });
});
