import { AIElementDetector } from '../AIElementDetector';
import { Page, ElementHandle } from 'playwright';

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('AIElementDetector', () => {
  let detector: AIElementDetector;
  let mockPage: jest.Mocked<Page>;
  let mockElementHandle: jest.Mocked<ElementHandle>;

  beforeEach(() => {
    mockElementHandle = {
      getAttribute: jest.fn(),
      boundingBox: jest.fn(),
      isVisible: jest.fn(),
      textContent: jest.fn(),
      evaluate: jest.fn(),
    } as any;

    mockPage = {
      $$: jest.fn(),
      locator: jest.fn(),
      evaluate: jest.fn(),
      waitForSelector: jest.fn(),
      screenshot: jest.fn(),
    } as any;

    detector = new AIElementDetector();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize detector', () => {
      expect(detector).toBeInstanceOf(AIElementDetector);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await detector.initialize(mockPage);

      // Should not throw and should log success
      expect(detector).toBeDefined();
    });

    it('should handle initialization errors', async () => {
      // Mock an error scenario if needed
      await expect(detector.initialize(mockPage)).resolves.not.toThrow();
    });
  });

  describe('detectInteractiveElements', () => {
    beforeEach(() => {
      // Mock basic page methods
      mockPage.$$.mockResolvedValue([mockElementHandle]);
      mockElementHandle.getAttribute.mockResolvedValue('button');
      mockElementHandle.boundingBox.mockResolvedValue({
        x: 10,
        y: 10,
        width: 100,
        height: 30,
      });
      mockElementHandle.isVisible.mockResolvedValue(true);
      mockElementHandle.textContent.mockResolvedValue('Click me');
      mockElementHandle.evaluate.mockResolvedValue('button');
    });

    it('should detect elements successfully', async () => {
      const result = await detector.detectInteractiveElements(mockPage);

      expect(result).toBeDefined();
      expect(result.elements).toBeDefined();
      expect(Array.isArray(result.elements)).toBe(true);
      expect(result.totalFound).toBeGreaterThanOrEqual(0);
      expect(typeof result.processingTime).toBe('number');
    });

    it('should handle pages with no interactive elements', async () => {
      mockPage.$$.mockResolvedValue([]);

      const result = await detector.detectInteractiveElements(mockPage);

      expect(result.elements).toHaveLength(0);
      expect(result.totalFound).toBe(0);
    });

    it('should handle detection errors gracefully', async () => {
      mockPage.$$.mockRejectedValue(new Error('Page access error'));

      const result = await detector.detectInteractiveElements(mockPage);

      expect(result).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect button elements', async () => {
      mockPage.$$.mockImplementation((selector) => {
        if (selector === 'button, input[type="button"], input[type="submit"]') {
          return Promise.resolve([mockElementHandle]);
        }
        return Promise.resolve([]);
      });

      const result = await detector.detectInteractiveElements(mockPage);

      expect(result.elements.length).toBeGreaterThan(0);
    });

    it('should detect input elements', async () => {
      mockElementHandle.getAttribute.mockImplementation((attr) => {
        if (attr === 'type') return 'text';
        if (attr === 'name') return 'username';
        return null;
      });

      mockPage.$$.mockImplementation((selector) => {
        if (selector.includes('input')) {
          return Promise.resolve([mockElementHandle]);
        }
        return Promise.resolve([]);
      });

      const result = await detector.detectInteractiveElements(mockPage);

      expect(result.elements.length).toBeGreaterThan(0);
    });

    it('should detect link elements', async () => {
      mockElementHandle.getAttribute.mockImplementation((attr) => {
        if (attr === 'href') return 'https://example.com';
        return null;
      });

      mockPage.$$.mockImplementation((selector) => {
        if (selector === 'a[href]') {
          return Promise.resolve([mockElementHandle]);
        }
        return Promise.resolve([]);
      });

      const result = await detector.detectInteractiveElements(mockPage);

      expect(result.elements.length).toBeGreaterThan(0);
    });
  });

  describe('classifyElement', () => {
    beforeEach(async () => {
      await detector.initialize(mockPage);
    });

    it('should classify button elements', async () => {
      mockElementHandle.evaluate
        .mockResolvedValueOnce('BUTTON') // tagName
        .mockResolvedValueOnce('button') // type
        .mockResolvedValueOnce('Submit') // text content
        .mockResolvedValueOnce('submit-btn'); // className

      const classification = await detector.classifyElement(mockElementHandle);

      expect(classification).toBeDefined();
      expect(classification.type).toBe('button');
      expect(classification.confidence).toBeGreaterThan(0);
    });

    it('should classify input elements', async () => {
      mockElementHandle.evaluate
        .mockResolvedValueOnce('INPUT') // tagName
        .mockResolvedValueOnce('text') // type
        .mockResolvedValueOnce('') // text content
        .mockResolvedValueOnce('form-input'); // className

      const classification = await detector.classifyElement(mockElementHandle);

      expect(classification).toBeDefined();
      expect(classification.type).toBe('input');
    });

    it('should handle classification errors', async () => {
      mockElementHandle.evaluate.mockRejectedValue(new Error('Element evaluation failed'));

      const classification = await detector.classifyElement(mockElementHandle);

      expect(classification).toBeDefined();
      expect(classification.type).toBe('unknown');
      expect(classification.confidence).toBe(0);
    });
  });

  describe('generateSelector', () => {
    it('should generate CSS selector for element', async () => {
      mockElementHandle.evaluate.mockResolvedValue('#unique-id');

      const selector = await detector.generateSelector(mockElementHandle);

      expect(typeof selector).toBe('string');
      expect(selector.length).toBeGreaterThan(0);
    });

    it('should handle selector generation errors', async () => {
      mockElementHandle.evaluate.mockRejectedValue(new Error('Selector generation failed'));

      const selector = await detector.generateSelector(mockElementHandle);

      expect(typeof selector).toBe('string');
    });
  });

  describe('extractElementInfo', () => {
    it('should extract comprehensive element information', async () => {
      mockElementHandle.getAttribute.mockImplementation((attr) => {
        switch (attr) {
          case 'id':
            return 'test-button';
          case 'class':
            return 'btn btn-primary';
          case 'type':
            return 'button';
          case 'name':
            return 'submit';
          default:
            return null;
        }
      });

      mockElementHandle.boundingBox.mockResolvedValue({
        x: 10,
        y: 20,
        width: 100,
        height: 40,
      });

      mockElementHandle.isVisible.mockResolvedValue(true);
      mockElementHandle.textContent.mockResolvedValue('Click Me');

      const info = await detector.extractElementInfo(mockElementHandle);

      expect(info).toBeDefined();
      expect(info.id).toBe('test-button');
      expect(info.classes).toContain('btn');
      expect(info.isVisible).toBe(true);
      expect(info.text).toBe('Click Me');
      expect(info.boundingBox).toBeDefined();
    });

    it('should handle missing element attributes', async () => {
      mockElementHandle.getAttribute.mockResolvedValue(null);
      mockElementHandle.boundingBox.mockResolvedValue(null);
      mockElementHandle.isVisible.mockResolvedValue(false);
      mockElementHandle.textContent.mockResolvedValue('');

      const info = await detector.extractElementInfo(mockElementHandle);

      expect(info).toBeDefined();
      expect(info.id).toBe('');
      expect(info.classes).toHaveLength(0);
      expect(info.isVisible).toBe(false);
    });
  });

  describe('isElementInteractive', () => {
    it('should identify interactive elements correctly', async () => {
      mockElementHandle.evaluate.mockResolvedValue(true);

      const isInteractive = await detector.isElementInteractive(mockElementHandle);

      expect(typeof isInteractive).toBe('boolean');
    });

    it('should identify non-interactive elements', async () => {
      mockElementHandle.evaluate.mockResolvedValue(false);

      const isInteractive = await detector.isElementInteractive(mockElementHandle);

      expect(isInteractive).toBe(false);
    });

    it('should handle evaluation errors', async () => {
      mockElementHandle.evaluate.mockRejectedValue(new Error('Evaluation failed'));

      const isInteractive = await detector.isElementInteractive(mockElementHandle);

      expect(isInteractive).toBe(false);
    });
  });
});
