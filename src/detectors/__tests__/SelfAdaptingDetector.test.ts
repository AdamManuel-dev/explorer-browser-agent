import { Page } from 'playwright';
import { SelfAdaptingDetector } from '../SelfAdaptingDetector';
import { AIElementDetector } from '../AIElementDetector';
import { InteractiveElement } from '../../types/elements';

// Mock the dependencies
jest.mock('../AIElementDetector');
jest.mock('../../utils/logger');

describe('SelfAdaptingDetector', () => {
  let detector: SelfAdaptingDetector;
  let mockPage: any;
  let mockAIDetector: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock page
    mockPage = {
      url: jest.fn().mockReturnValue('https://example.com'),
      $: jest.fn(),
      evaluate: jest.fn(),
      waitForLoadState: jest.fn(),
    };

    // Create detector instance
    detector = new SelfAdaptingDetector();

    // Get mocked AIElementDetector instance
    mockAIDetector = (AIElementDetector as jest.MockedClass<typeof AIElementDetector>).mock.instances[0];
  });

  describe('initialization', () => {
    it('should initialize the AI detector', async () => {
      mockAIDetector.initialize = jest.fn().mockResolvedValue(undefined);

      await detector.initialize(mockPage as any);

      expect(mockAIDetector.initialize).toHaveBeenCalledWith(mockPage);
    });
  });

  describe('detectInteractiveElements', () => {
    it('should detect and cache elements', async () => {
      const mockElements: InteractiveElement[] = [
        {
          id: '1',
          type: 'button',
          selector: '#submit-btn',
          text: 'Submit',
          attributes: {},
          isVisible: true,
          isEnabled: true,
        },
        {
          id: '2',
          type: 'text-input',
          selector: '#email-input',
          text: '',
          attributes: {},
          isVisible: true,
          isEnabled: true,
        },
      ];

      mockAIDetector.detectInteractiveElements = jest.fn().mockResolvedValue({
        elements: mockElements,
        totalFound: 2,
        detectionTime: 100,
        errors: [],
      });

      // Mock element validation
      mockPage.$.mockImplementation((selector: string) => {
        if (selector === '#submit-btn' || selector === '#email-input') {
          return {
            isVisible: jest.fn().mockResolvedValue(true),
          };
        }
        return null;
      });

      const result = await detector.detectInteractiveElements(mockPage);

      expect(result.elements).toHaveLength(2);
      expect(result.totalFound).toBe(2);
      expect(mockAIDetector.detectInteractiveElements).toHaveBeenCalledWith(mockPage);
    });

    it('should adapt elements that are no longer valid', async () => {
      const mockElements: InteractiveElement[] = [
        {
          id: '1',
          type: 'button',
          selector: '#old-button',
          text: 'Click Me',
          attributes: {},
          isVisible: true,
          isEnabled: true,
        },
      ];

      mockAIDetector.detectInteractiveElements = jest.fn().mockResolvedValue({
        elements: mockElements,
        totalFound: 1,
        detectionTime: 100,
        errors: [],
      });

      // Mock that old selector fails but adaptation succeeds
      mockPage.$.mockImplementation((selector: string) => {
        if (selector === '#old-button') {
          return null; // Element not found
        }
        if (selector === '#new-button') {
          return {
            isVisible: jest.fn().mockResolvedValue(true),
          };
        }
        return null;
      });

      // Mock successful adaptation
      mockAIDetector.adaptElement = jest.fn().mockResolvedValue({
        ...mockElements[0],
        selector: '#new-button',
        metadata: {
          adaptedFrom: '#old-button',
          adaptationStrategy: 'AI-based adaptation',
        },
      });

      const result = await detector.detectInteractiveElements(mockPage);

      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].selector).toBe('#new-button');
      expect(mockAIDetector.adaptElement).toHaveBeenCalled();
    });
  });

  describe('getAdaptiveElement', () => {
    it('should return original element if still valid', async () => {
      const element: InteractiveElement = {
        id: '1',
        type: 'button',
        selector: '#valid-button',
        text: 'Click',
        attributes: {},
        isVisible: true,
        isEnabled: true,
      };

      mockPage.$.mockResolvedValue({
        isVisible: jest.fn().mockResolvedValue(true),
      });

      const result = await detector.getAdaptiveElement(mockPage, element);

      expect(result).toEqual(element);
      expect(mockPage.$).toHaveBeenCalledWith('#valid-button');
    });

    it('should adapt element if original selector fails', async () => {
      const element: InteractiveElement = {
        id: '1',
        type: 'button',
        selector: '#missing-button',
        text: 'Click',
        attributes: {},
        isVisible: true,
        isEnabled: true,
      };

      const adaptedElement: InteractiveElement = {
        ...element,
        selector: '#adapted-button',
      };

      // Original selector fails
      mockPage.$.mockImplementation((selector: string) => {
        if (selector === '#missing-button') {
          throw new Error('Element not found');
        }
        return null;
      });

      // Mock adaptation
      mockAIDetector.adaptElement = jest.fn().mockResolvedValue(adaptedElement);

      const result = await detector.getAdaptiveElement(mockPage, element);

      expect(result).toEqual(adaptedElement);
      expect(mockAIDetector.adaptElement).toHaveBeenCalledWith(mockPage, element);
    });

    it('should try structural matching if AI adaptation fails', async () => {
      const element: InteractiveElement = {
        id: '1',
        type: 'button',
        selector: '#missing-button',
        text: 'Submit',
        attributes: { class: 'btn btn-primary' },
        isVisible: true,
        isEnabled: true,
      };

      // Original selector fails
      mockPage.$.mockImplementation((selector: string) => {
        if (selector === '#missing-button') {
          return null;
        }
        if (selector === '.btn.btn-primary') {
          return {
            evaluate: jest.fn(),
            isVisible: jest.fn().mockResolvedValue(true),
          };
        }
        return null;
      });

      // AI adaptation fails
      mockAIDetector.adaptElement = jest.fn().mockResolvedValue(null);

      // Mock structural matching
      mockPage.evaluate.mockResolvedValue({
        selector: '.btn.btn-primary',
        score: 5,
      });

      const result = await detector.getAdaptiveElement(mockPage, element);

      expect(result).toBeTruthy();
      expect(result?.selector).toBe('.btn.btn-primary');
      expect((result?.metadata as any)?.adaptationStrategy).toBe('structural-similarity');
    });

    it('should try fuzzy text matching as last resort', async () => {
      const element: InteractiveElement = {
        id: '1',
        type: 'button',
        selector: '#missing-button',
        text: 'Submit Form',
        attributes: {},
        isVisible: true,
        isEnabled: true,
      };

      // All selectors fail except fuzzy match
      mockPage.$.mockImplementation((selector: string) => {
        if (selector === 'form > button:nth-child(2)') {
          return {
            evaluate: jest.fn(),
            isVisible: jest.fn().mockResolvedValue(true),
          };
        }
        return null;
      });

      // AI adaptation fails
      mockAIDetector.adaptElement = jest.fn().mockResolvedValue(null);

      // Structural matching fails
      mockPage.evaluate.mockImplementation((fn: any) => {
        if (fn.toString().includes('structural')) {
          return null;
        }
        // Fuzzy matching succeeds
        if (fn.toString().includes('fuzzy')) {
          return {
            selector: 'form > button:nth-child(2)',
            score: 0.8,
          };
        }
        return null;
      });

      const result = await detector.getAdaptiveElement(mockPage, element);

      expect(result).toBeTruthy();
      expect(result?.selector).toBe('form > button:nth-child(2)');
      expect((result?.metadata as any)?.adaptationStrategy).toBe('fuzzy-text-matching');
    });

    it('should return null if all adaptation strategies fail', async () => {
      const element: InteractiveElement = {
        id: '1',
        type: 'button',
        selector: '#impossible-button',
        text: 'Impossible',
        attributes: {},
        isVisible: true,
        isEnabled: true,
      };

      // All selectors fail
      mockPage.$.mockResolvedValue(null);

      // All adaptations fail
      mockAIDetector.adaptElement = jest.fn().mockResolvedValue(null);
      mockPage.evaluate.mockResolvedValue(null);

      const result = await detector.getAdaptiveElement(mockPage, element);

      expect(result).toBeNull();
    });

    it('should respect max adaptation attempts', async () => {
      const element: InteractiveElement = {
        id: '1',
        type: 'button',
        selector: '#limited-button',
        text: 'Limited',
        attributes: {},
        isVisible: true,
        isEnabled: true,
      };

      // All selectors fail
      mockPage.$.mockResolvedValue(null);
      mockAIDetector.adaptElement = jest.fn().mockResolvedValue(null);
      mockPage.evaluate.mockResolvedValue(null);

      // Try multiple times to exceed limit
      for (let i = 0; i < 5; i++) {
        await detector.getAdaptiveElement(mockPage, element);
      }

      // Should stop trying after max attempts
      const stats = detector.getAdaptationStats();
      expect(stats.totalAttempts).toBeLessThanOrEqual(3); // max attempts per element
    });
  });

  describe('getAdaptationStats', () => {
    it('should track adaptation statistics', async () => {
      const element: InteractiveElement = {
        id: '1',
        type: 'button',
        selector: '#stats-button',
        text: 'Stats',
        attributes: {},
        isVisible: true,
        isEnabled: true,
      };

      // Mock failed original selector but successful AI adaptation
      mockPage.$.mockImplementation((selector: string) => {
        if (selector === '#stats-button') {
          return null;
        }
        return { isVisible: jest.fn().mockResolvedValue(true) };
      });

      mockAIDetector.adaptElement = jest.fn().mockResolvedValue({
        ...element,
        selector: '#new-stats-button',
      });

      await detector.getAdaptiveElement(mockPage, element);

      const stats = detector.getAdaptationStats();
      expect(stats.totalAttempts).toBe(1);
      expect(stats.successfulAdaptations).toBe(1);
      expect(stats.failedAdaptations).toBe(0);
      expect(stats.strategiesUsed['AI-based adaptation']).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('should clean up resources', async () => {
      mockAIDetector.cleanup = jest.fn().mockResolvedValue(undefined);

      await detector.cleanup();

      expect(mockAIDetector.cleanup).toHaveBeenCalled();
      expect(detector.getAdaptationStats().totalAttempts).toBe(0);
    });
  });
});