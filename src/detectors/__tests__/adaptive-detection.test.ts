import { Page } from 'playwright';
import { AIElementDetectorV2 } from '../AIElementDetectorV2';
import { InteractiveElement } from '../../types/elements';

// Mock Stagehand
jest.mock('@browserbasehq/stagehand', () => ({
  Stagehand: jest.fn().mockImplementation(() => ({
    page: null,
    observe: jest.fn(),
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

describe('Adaptive Element Detection', () => {
  let detector: AIElementDetectorV2;
  let mockPage: any;
  let mockStagehand: any;

  beforeEach(() => {
    detector = new AIElementDetectorV2();
    
    mockStagehand = {
      observe: jest.fn(),
      close: jest.fn(),
    };

    mockPage = {
      $: jest.fn(),
      $$: jest.fn(),
      url: jest.fn().mockReturnValue('https://example.com'),
    };

    jest.clearAllMocks();
  });

  describe('adaptiveElementDetection', () => {
    it('should successfully adapt elements when selectors fail', async () => {
      await detector.initialize(mockStagehand);

      // Create a mock element that "failed" (selector no longer works)
      const failedElement: InteractiveElement = {
        id: 'test-1',
        type: 'button',
        selector: 'button#old-submit',
        text: 'Submit Form',
        attributes: { id: 'old-submit', class: 'btn-primary' },
        isVisible: true,
        isEnabled: true,
        metadata: {
          context: 'Form: contact-form',
          label: 'Submit',
        },
      };

      // Mock page.$ to return null for old selector (element not found)
      mockPage.$.mockImplementation((selector: string) => {
        if (selector === 'button#old-submit') {
          return Promise.resolve(null); // Element not found
        }
        if (selector === 'button#new-submit') {
          // Return mock element for new selector
          return Promise.resolve({
            evaluate: jest.fn()
              .mockImplementation((fn) => {
                const fnStr = fn.toString();
                if (fnStr.includes('tagName')) return Promise.resolve('button');
                if (fnStr.includes('attributes')) return Promise.resolve({ id: 'new-submit', class: 'btn-primary' });
                return Promise.resolve(null);
              }),
            isVisible: jest.fn().mockResolvedValue(true),
            isEnabled: jest.fn().mockResolvedValue(true),
            boundingBox: jest.fn().mockResolvedValue({ x: 100, y: 100, width: 120, height: 40 }),
            textContent: jest.fn().mockResolvedValue('Submit Form'),
            getAttribute: jest.fn().mockResolvedValue(null),
          });
        }
        return Promise.resolve(null);
      });

      // Mock Stagehand to return a new observation
      mockStagehand.observe.mockResolvedValue([{
        selector: 'button#new-submit',
        description: 'Submit button for the form',
      }]);

      const adaptedElements = await detector.adaptiveElementDetection(
        mockPage,
        [failedElement],
        1
      );

      expect(adaptedElements).toHaveLength(1);
      expect(adaptedElements[0].selector).toBe('button#new-submit');
      expect(adaptedElements[0].metadata?.adaptedFrom).toBe('button#old-submit');
      expect(adaptedElements[0].metadata?.adaptationReason).toBe('UI change detected');
      expect(mockStagehand.observe).toHaveBeenCalled();
    });

    it('should preserve existing elements that still work', async () => {
      await detector.initialize(mockStagehand);

      const workingElement: InteractiveElement = {
        id: 'test-1',
        type: 'button',
        selector: 'button#working',
        text: 'Working Button',
        attributes: { id: 'working' },
        isVisible: true,
        isEnabled: true,
      };

      // Mock page.$ to return element for working selector
      mockPage.$.mockImplementation((selector: string) => {
        if (selector === 'button#working') {
          return Promise.resolve({
            evaluate: jest.fn()
              .mockImplementation((fn) => {
                const fnStr = fn.toString();
                if (fnStr.includes('tagName')) return Promise.resolve('button');
                if (fnStr.includes('attributes')) return Promise.resolve({ id: 'working' });
                return Promise.resolve(null);
              }),
            isVisible: jest.fn().mockResolvedValue(true),
            isEnabled: jest.fn().mockResolvedValue(true),
            boundingBox: jest.fn().mockResolvedValue({ x: 50, y: 50, width: 100, height: 30 }),
            textContent: jest.fn().mockResolvedValue('Working Button'),
            getAttribute: jest.fn().mockResolvedValue(null),
          });
        }
        return Promise.resolve(null);
      });

      const adaptedElements = await detector.adaptiveElementDetection(
        mockPage,
        [workingElement]
      );

      expect(adaptedElements).toHaveLength(1);
      expect(adaptedElements[0].selector).toBe('button#working');
      expect(adaptedElements[0].metadata?.adaptedFrom).toBeUndefined();
      expect(mockStagehand.observe).not.toHaveBeenCalled();
    });
  });

  describe('element similarity checking', () => {
    it('should identify similar elements correctly', () => {
      const original: InteractiveElement = {
        id: 'test-1',
        type: 'button',
        selector: 'button#old',
        text: 'Submit Form',
        attributes: { id: 'old', class: 'btn-primary' },
        isVisible: true,
        isEnabled: true,
        boundingBox: { x: 100, y: 100, width: 120, height: 40 },
      };

      const similar: InteractiveElement = {
        id: 'test-2',
        type: 'button',
        selector: 'button#new',
        text: 'Submit Form', // Same text
        attributes: { id: 'new', class: 'btn-primary' }, // Similar attributes
        isVisible: true,
        isEnabled: true,
        boundingBox: { x: 110, y: 105, width: 120, height: 40 }, // Close position
      };

      const different: InteractiveElement = {
        id: 'test-3',
        type: 'link', // Different type
        selector: 'a#link',
        text: 'Go Back',
        attributes: { id: 'link' },
        isVisible: true,
        isEnabled: true,
        boundingBox: { x: 300, y: 300, width: 80, height: 30 },
      };

      const isSimilar = (detector as any).isElementSimilar(original, similar);
      const isDifferent = (detector as any).isElementSimilar(original, different);

      expect(isSimilar).toBe(true);
      expect(isDifferent).toBe(false);
    });
  });
});