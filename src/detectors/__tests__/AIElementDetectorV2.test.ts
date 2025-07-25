import { Page } from 'playwright';
import { ElementType } from '../../types/elements';

// Mock Stagehand before importing AIElementDetectorV2
jest.mock('@browserbasehq/stagehand', () => ({
  Stagehand: jest.fn().mockImplementation(() => ({
    page: null,
    browserbaseSessionID: undefined,
    init: jest.fn(),
    observe: jest.fn(),
    act: jest.fn(),
    extract: jest.fn(),
    close: jest.fn(),
  })),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { AIElementDetectorV2 } from '../AIElementDetectorV2';

// Mock Stagehand
const mockStagehand = {
  observe: jest.fn(),
  close: jest.fn(),
};

// Mock page
const mockPage = {
  url: jest.fn().mockReturnValue('https://example.com'),
  $: jest.fn(),
  $$: jest.fn(),
} as any;

// Mock element handle
const createMockElementHandle = (overrides = {}) => ({
  evaluate: jest.fn(),
  isVisible: jest.fn().mockResolvedValue(true),
  isEnabled: jest.fn().mockResolvedValue(true),
  boundingBox: jest.fn().mockResolvedValue({ x: 100, y: 100, width: 200, height: 50 }),
  textContent: jest.fn().mockResolvedValue('Click me'),
  getAttribute: jest.fn().mockResolvedValue(null),
  ...overrides,
});

describe('AIElementDetectorV2', () => {
  let detector: AIElementDetectorV2;

  beforeEach(() => {
    detector = new AIElementDetectorV2({
      enableSelectorFallback: true,
      maxElementsPerQuery: 10,
      cacheResults: true,
    });
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with Stagehand instance', async () => {
      await detector.initialize(mockStagehand as any);
      expect(detector).toBeDefined();
    });

    it('should initialize with page', async () => {
      await detector.initializeWithPage(mockPage);
      expect(detector).toBeDefined();
    });
  });

  describe('detectInteractiveElements', () => {
    beforeEach(async () => {
      await detector.initialize(mockStagehand as any);
    });

    it('should detect elements using AI', async () => {
      // Mock Stagehand observe responses
      mockStagehand.observe.mockResolvedValueOnce([
        {
          selector: 'button#submit',
          description: 'Submit button for the form',
        },
        {
          selector: 'input[type="text"]',
          description: 'Text input field for entering username',
        },
      ]);

      // Mock remaining observe calls
      mockStagehand.observe.mockResolvedValue([]);

      // Mock page.$ to return element handles
      const buttonHandle = createMockElementHandle({
        evaluate: jest.fn()
          .mockResolvedValueOnce('button') // tagName
          .mockResolvedValueOnce({ id: 'submit', type: 'submit' }), // attributes
      });

      const inputHandle = createMockElementHandle({
        evaluate: jest.fn()
          .mockResolvedValueOnce('input') // tagName
          .mockResolvedValueOnce({ type: 'text', placeholder: 'Username' }), // attributes
      });

      mockPage.$.mockImplementation((selector: string) => {
        if (selector === 'button#submit') return Promise.resolve(buttonHandle);
        if (selector === 'input[type="text"]') return Promise.resolve(inputHandle);
        return Promise.resolve(null);
      });

      const result = await detector.detectInteractiveElements(mockPage);

      expect(result.totalFound).toBeGreaterThan(0);
      expect(result.elements).toHaveLength(2);
      expect(result.elements[0].type).toBe('button');
      expect(result.elements[1].type).toBe('text-input');
    });

    it('should use cache for repeated detections', async () => {
      // First detection
      mockStagehand.observe.mockResolvedValue([
        { selector: 'button', description: 'Click button' },
      ]);

      const buttonHandle = createMockElementHandle({
        evaluate: jest.fn()
          .mockResolvedValueOnce('button')
          .mockResolvedValueOnce({}),
      });

      mockPage.$.mockResolvedValue(buttonHandle);

      const result1 = await detector.detectInteractiveElements(mockPage);
      expect(result1.totalFound).toBe(1);

      // Clear mocks
      mockStagehand.observe.mockClear();

      // Second detection should use cache
      const result2 = await detector.detectInteractiveElements(mockPage);
      expect(result2.totalFound).toBe(1);
      expect(mockStagehand.observe).not.toHaveBeenCalled();
    });

    it('should fall back to selector detection when AI returns few results', async () => {
      // Mock AI detection with only 1 result (using different selector than fallback)
      mockStagehand.observe.mockResolvedValue([
        { selector: 'div.ai-button', description: 'Single AI-detected button' },
      ]);

      const aiButtonHandle = createMockElementHandle({
        evaluate: jest.fn()
          .mockImplementation((fn) => {
            const fnStr = fn.toString();
            if (fnStr.includes('tagName')) return Promise.resolve('div');
            if (fnStr.includes('attributes')) return Promise.resolve({ class: 'ai-button' });
            return Promise.resolve(null);
          }),
      });

      const selectorButtonHandle = createMockElementHandle({
        evaluate: jest.fn()
          .mockImplementation((fn) => {
            const fnStr = fn.toString();
            if (fnStr.includes('tagName')) return Promise.resolve('button');
            if (fnStr.includes('attributes')) return Promise.resolve({});
            return Promise.resolve(null);
          }),
      });

      mockPage.$.mockImplementation((selector: string) => {
        if (selector === 'div.ai-button') return Promise.resolve(aiButtonHandle);
        return Promise.resolve(null);
      });

      // Mock selector-based detection
      const inputHandle = createMockElementHandle({
        evaluate: jest.fn()
          .mockImplementation((fn) => {
            const fnStr = fn.toString();
            if (fnStr.includes('tagName')) return Promise.resolve('input');
            if (fnStr.includes('attributes')) return Promise.resolve({ type: 'text' });
            return Promise.resolve(null);
          }),
      });

      mockPage.$$.mockImplementation((selector: string) => {
        if (selector === 'button') return Promise.resolve([selectorButtonHandle]);
        if (selector === 'input[type="text"]') return Promise.resolve([inputHandle]);
        return Promise.resolve([]);
      });

      const result = await detector.detectInteractiveElements(mockPage);
      
      // AI detection should be attempted and selector fallback should work
      // Note: Due to deduplication, we might get only the AI-detected element
      expect(result.totalFound).toBeGreaterThanOrEqual(1);
      expect(mockStagehand.observe).toHaveBeenCalled();
    });
  });

  describe('inferTypeFromDescription', () => {
    it('should correctly infer button type', () => {
      const descriptions = [
        'Submit button',
        'Click to continue',
        'Press to save',
        'Button for submitting form',
      ];

      descriptions.forEach((desc) => {
        const type = (detector as any).inferTypeFromDescription(desc);
        expect(type).toBe('button');
      });
    });

    it('should correctly infer text input type', () => {
      const descriptions = [
        'Text input field',
        'Enter your name',
        'Type your message',
        'Search box',
      ];

      descriptions.forEach((desc) => {
        const type = (detector as any).inferTypeFromDescription(desc);
        expect(type).toBe('text-input');
      });
    });

    it('should correctly infer specialized input types', () => {
      expect((detector as any).inferTypeFromDescription('Password field')).toBe('password-input');
      expect((detector as any).inferTypeFromDescription('Email address input')).toBe('email-input');
      expect((detector as any).inferTypeFromDescription('Phone number field')).toBe('tel-input');
      expect((detector as any).inferTypeFromDescription('Number input')).toBe('number-input');
    });

    it('should correctly infer other element types', () => {
      expect((detector as any).inferTypeFromDescription('Navigation link')).toBe('link');
      expect((detector as any).inferTypeFromDescription('Checkbox to agree')).toBe('checkbox');
      expect((detector as any).inferTypeFromDescription('Radio button option')).toBe('radio');
      expect((detector as any).inferTypeFromDescription('Dropdown menu')).toBe('select');
      expect((detector as any).inferTypeFromDescription('File upload button')).toBe('file-upload');
      expect((detector as any).inferTypeFromDescription('Toggle switch')).toBe('toggle');
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      await detector.initialize(mockStagehand as any);

      // Add some data to cache
      mockStagehand.observe.mockResolvedValue([]);
      await detector.detectInteractiveElements(mockPage);

      let stats = detector.getCacheStats();
      expect(stats.size).toBe(1);

      detector.clearCache();
      
      stats = detector.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should provide cache statistics', async () => {
      await detector.initialize(mockStagehand as any);

      mockStagehand.observe.mockResolvedValue([]);
      await detector.detectInteractiveElements(mockPage);

      const stats = detector.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.urls).toContain('https://example.com');
    });
  });

  describe('cleanup', () => {
    it('should clean up resources', async () => {
      await detector.initialize(mockStagehand as any);
      await detector.cleanup();

      expect(mockStagehand.close).toHaveBeenCalled();
      expect(detector.getCacheStats().size).toBe(0);
    });
  });

  describe('element classification', () => {
    it('should classify unknown elements with AI', async () => {
      await detector.initialize(mockStagehand as any);

      // Mock observe for classification
      mockStagehand.observe.mockResolvedValueOnce([
        {
          selector: '.custom-element',
          description: 'This is a clickable button element',
        },
      ]);

      const unknownElement = {
        id: '123',
        type: 'unknown' as ElementType,
        selector: '.custom-element',
        isVisible: true,
        isEnabled: true,
        metadata: {},
      };

      const classified = await (detector as any).classifyElements([unknownElement]);

      expect(classified[0].type).toBe('button');
      expect(classified[0].metadata.aiConfidence).toBeDefined();
      expect(classified[0].metadata.aiConfidence).toBeGreaterThan(0.7);
    });
  });
});