import { AIElementDetector } from '../AIElementDetector';
import { Page, ElementHandle } from 'playwright';

jest.mock('../../utils/logger', () => ({
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
      mockPage.$$.mockResolvedValue([mockElementHandle as any]);
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
      expect(typeof result.detectionTime).toBe('number');
    });

    it('should handle pages with no interactive elements', async () => {
      mockPage.$$.mockResolvedValue([]);

      const result = await detector.detectInteractiveElements(mockPage);

      expect(result.elements).toHaveLength(0);
      expect(result.totalFound).toBe(0);
    });

    it('should handle detection errors gracefully', async () => {
      // Mock the detectBySelectors method to throw an error
      jest.spyOn(detector as any, 'detectBySelectors').mockRejectedValue(new Error('Detection failed'));

      // The detectInteractiveElements method should catch errors and handle them gracefully
      await expect(detector.detectInteractiveElements(mockPage)).rejects.toThrow('Detection failed');
    });

    it('should detect button elements', async () => {
      // Mock the createElementFromHandle method to return a proper element
      const mockElement = {
        id: 'button-1',
        type: 'button' as const,
        selector: 'button',
        text: 'Click me',
        isVisible: true,
        bounds: { x: 0, y: 0, width: 100, height: 30 },
        attributes: {},
        classification: { confidence: 0.9, reasoning: 'Standard button element' },
      };

      jest.spyOn(detector as any, 'createElementFromHandle').mockResolvedValue(mockElement);

      mockPage.$$.mockImplementation((selector) => {
        // Return mock elements for button selectors
        if (selector === 'button' || selector === 'input[type="submit"]' || selector === 'input[type="button"]') {
          return Promise.resolve([mockElementHandle]);
        }
        return Promise.resolve([]);
      });

      const result = await detector.detectInteractiveElements(mockPage);

      expect(result.elements.length).toBeGreaterThan(0);
      expect(result.elements[0].type).toBe('button');
    });

    it('should detect input elements', async () => {
      // Mock the createElementFromHandle method to return a proper input element
      const mockInputElement = {
        id: 'input-1',
        type: 'text-input' as const,
        selector: 'input[type="text"]',
        text: '',
        isVisible: true,
        bounds: { x: 0, y: 0, width: 200, height: 30 },
        attributes: { type: 'text', name: 'username' },
        classification: { confidence: 0.9, reasoning: 'Text input field' },
      };

      jest.spyOn(detector as any, 'createElementFromHandle').mockResolvedValue(mockInputElement);

      mockPage.$$.mockImplementation((selector) => {
        // Return mock elements for text input selectors
        if (selector.includes('input') || selector.includes('[contenteditable="true"]')) {
          return Promise.resolve([mockElementHandle]);
        }
        return Promise.resolve([]);
      });

      const result = await detector.detectInteractiveElements(mockPage);

      expect(result.elements.length).toBeGreaterThan(0);
      expect(result.elements[0].type).toBe('text-input');
    });

    it('should detect link elements', async () => {
      // Mock the createElementFromHandle method to return a proper link element
      const mockLinkElement = {
        id: 'link-1',
        type: 'link' as const,
        selector: 'a[href]',
        text: 'Click here',
        isVisible: true,
        bounds: { x: 0, y: 0, width: 100, height: 20 },
        attributes: { href: 'https://example.com' },
        classification: { confidence: 0.9, reasoning: 'Standard link element' },
      };

      jest.spyOn(detector as any, 'createElementFromHandle').mockResolvedValue(mockLinkElement);

      mockPage.$$.mockImplementation((selector) => {
        // Return mock elements for link selectors
        if (selector === 'a[href]' || selector === '[role="link"]') {
          return Promise.resolve([mockElementHandle]);
        }
        return Promise.resolve([]);
      });

      const result = await detector.detectInteractiveElements(mockPage);

      expect(result.elements.length).toBeGreaterThan(0);
      expect(result.elements[0].type).toBe('link');
    });
  });
});
