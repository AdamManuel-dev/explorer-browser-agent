import { BrowserAgent } from '../BrowserAgent';
import { chromium } from 'playwright';

jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('BrowserAgent', () => {
  let browserAgent: BrowserAgent;
  let mockBrowser: any;
  let mockContext: any;
  let mockPage: any;

  beforeEach(() => {
    mockPage = {
      goto: jest.fn(),
      evaluate: jest.fn(),
      screenshot: jest.fn(),
      close: jest.fn(),
    };

    mockContext = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
    };

    mockBrowser = {
      newContext: jest.fn().mockResolvedValue(mockContext),
      close: jest.fn(),
    };

    (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);

    browserAgent = new BrowserAgent();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(browserAgent).toBeInstanceOf(BrowserAgent);
    });

    it('should accept custom config', () => {
      const config = { headless: false, viewport: { width: 1024, height: 768 } };
      const agent = new BrowserAgent(config);
      expect(agent).toBeInstanceOf(BrowserAgent);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await browserAgent.initialize();

      expect(chromium.launch).toHaveBeenCalledWith({ headless: true });
      expect(mockBrowser.newContext).toHaveBeenCalledWith({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      });
      expect(mockContext.newPage).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      (chromium.launch as jest.Mock).mockRejectedValue(new Error('Launch failed'));

      await expect(browserAgent.initialize()).rejects.toThrow('Launch failed');
    });
  });

  describe('navigate', () => {
    beforeEach(async () => {
      await browserAgent.initialize();
    });

    it('should navigate to URL successfully', async () => {
      const url = 'https://example.com';
      mockPage.goto.mockResolvedValue(undefined);

      await browserAgent.navigate(url);

      expect(mockPage.goto).toHaveBeenCalledWith(url, { waitUntil: 'networkidle' });
    });

    it('should throw error if browser not initialized', async () => {
      const uninitializedAgent = new BrowserAgent();

      await expect(uninitializedAgent.navigate('https://example.com')).rejects.toThrow(
        'Browser not initialized'
      );
    });

    it('should handle navigation errors', async () => {
      const url = 'https://invalid-url';
      mockPage.goto.mockRejectedValue(new Error('Navigation failed'));

      await expect(browserAgent.navigate(url)).rejects.toThrow('Navigation failed');
    });
  });

  describe('extractContent', () => {
    beforeEach(async () => {
      await browserAgent.initialize();
    });

    it('should extract content successfully', async () => {
      const expectedContent = 'Page content';
      mockPage.evaluate.mockResolvedValue(expectedContent);

      const content = await browserAgent.extractContent();

      expect(content).toBe(expectedContent);
      expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should throw error if browser not initialized', async () => {
      const uninitializedAgent = new BrowserAgent();

      await expect(uninitializedAgent.extractContent()).rejects.toThrow('Browser not initialized');
    });

    it('should handle extraction errors', async () => {
      mockPage.evaluate.mockRejectedValue(new Error('Extraction failed'));

      await expect(browserAgent.extractContent()).rejects.toThrow('Extraction failed');
    });
  });

  describe('screenshot', () => {
    beforeEach(async () => {
      await browserAgent.initialize();
    });

    it('should take screenshot successfully', async () => {
      const path = '/tmp/screenshot.png';
      mockPage.screenshot.mockResolvedValue(Buffer.from(''));

      await browserAgent.screenshot(path);

      expect(mockPage.screenshot).toHaveBeenCalledWith({ path });
    });

    it('should throw error if browser not initialized', async () => {
      const uninitializedAgent = new BrowserAgent();

      await expect(uninitializedAgent.screenshot('/tmp/test.png')).rejects.toThrow(
        'Browser not initialized'
      );
    });
  });

  describe('getPage', () => {
    it('should return null when not initialized', () => {
      expect(browserAgent.getPage()).toBeNull();
    });

    it('should return page when initialized', async () => {
      await browserAgent.initialize();
      expect(browserAgent.getPage()).toBe(mockPage);
    });
  });

  describe('close', () => {
    it('should close browser successfully', async () => {
      await browserAgent.initialize();
      await browserAgent.close();

      expect(mockBrowser.close).toHaveBeenCalled();
      expect(browserAgent.getPage()).toBeNull();
    });

    it('should handle close when not initialized', async () => {
      await browserAgent.close();

      expect(mockBrowser.close).not.toHaveBeenCalled();
    });
  });
});
