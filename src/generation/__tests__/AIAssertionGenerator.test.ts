import { AIAssertionGenerator, AssertionContext, SmartAssertion } from '../AIAssertionGenerator';

// Mock the dependencies
jest.mock('../../detectors/AIElementDetector', () => ({
  AIElementDetector: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    detectInteractiveElements: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('AIAssertionGenerator', () => {
  let generator: AIAssertionGenerator;
  let mockPage: any;

  beforeEach(() => {
    generator = new AIAssertionGenerator();
    mockPage = {
      title: jest.fn().mockResolvedValue('Test Page'),
      url: jest.fn().mockResolvedValue('https://example.com'),
      locator: jest.fn().mockReturnValue({
        count: jest.fn().mockResolvedValue(0),
        isVisible: jest.fn().mockResolvedValue(true),
      }),
      textContent: jest.fn().mockResolvedValue('Welcome to our test page'),
    };
  });

  afterEach(async () => {
    await generator.close();
  });

  describe('generateAssertions', () => {
    it('should generate contextual assertions for click actions', async () => {
      const context: AssertionContext = {
        action: 'click submit button',
        element: {
          selector: '#submit-btn',
          type: 'button',
          text: 'Submit',
        },
        pageState: {
          url: 'https://example.com/form',
          title: 'Form Page',
          timestamp: Date.now(),
        },
        previousAssertions: [],
      };

      const assertions = await generator.generateAssertions(mockPage, context);

      expect(assertions).toBeDefined();
      expect(Array.isArray(assertions)).toBe(true);
      expect(assertions.length).toBeGreaterThan(0);

      // Should include URL assertion for navigation verification
      const urlAssertion = assertions.find(a => a.type === 'url');
      expect(urlAssertion).toBeDefined();
      expect(urlAssertion?.reasoning).toContain('navigation after click');
    });

    it('should generate form validation assertions for type actions', async () => {
      // Mock form elements
      mockPage.locator = jest.fn().mockReturnValue({
        count: jest.fn().mockResolvedValue(1),
        isVisible: jest.fn().mockResolvedValue(true),
      });

      const context: AssertionContext = {
        action: 'type email address',
        element: {
          selector: '#email',
          type: 'input',
          text: '',
        },
        pageState: {
          url: 'https://example.com/signup',
          title: 'Sign Up',
          timestamp: Date.now(),
        },
        previousAssertions: [],
      };

      const assertions = await generator.generateAssertions(mockPage, context);

      expect(assertions).toBeDefined();
      expect(assertions.length).toBeGreaterThan(0);

      // Should include visibility assertion for element
      const visibilityAssertion = assertions.find(a => a.type === 'visible');
      expect(visibilityAssertion).toBeDefined();
    });

    it('should generate business logic assertions for e-commerce context', async () => {
      // Mock e-commerce page content
      mockPage.textContent = jest.fn().mockResolvedValue('Add to cart checkout shopping');
      mockPage.locator = jest.fn().mockReturnValue({
        count: jest.fn().mockResolvedValue(1),
        isVisible: jest.fn().mockResolvedValue(true),
      });

      const context: AssertionContext = {
        action: 'add item to cart',
        element: {
          selector: '.add-to-cart',
          type: 'button',
          text: 'Add to Cart',
        },
        pageState: {
          url: 'https://shop.example.com/product/123',
          title: 'Product Page',
          timestamp: Date.now(),
        },
        previousAssertions: [],
      };

      const assertions = await generator.generateAssertions(mockPage, context);

      expect(assertions).toBeDefined();
      expect(assertions.length).toBeGreaterThan(0);

      // Should include cart-related assertions
      const cartAssertion = assertions.find(a => 
        a.reasoning.toLowerCase().includes('cart') || 
        a.target.includes('cart')
      );
      expect(cartAssertion).toBeDefined();
    });

    it('should handle errors gracefully and return fallback assertions', async () => {
      // Mock page that throws error
      const errorPage = {
        ...mockPage,
        title: jest.fn().mockRejectedValue(new Error('Page error')),
        locator: jest.fn().mockReturnValue({
          count: jest.fn().mockRejectedValue(new Error('Locator error')),
        }),
        textContent: jest.fn().mockRejectedValue(new Error('Text error')),
      } as any;

      const context: AssertionContext = {
        action: 'click button',
        element: {
          selector: '#btn',
          type: 'button',
        },
        pageState: {
          url: 'https://example.com',
          title: 'Test',
          timestamp: Date.now(),
        },
        previousAssertions: [],
      };

      const assertions = await generator.generateAssertions(errorPage, context);

      expect(assertions).toBeDefined();
      expect(Array.isArray(assertions)).toBe(true);
      // Should return fallback assertions even when errors occur
      expect(assertions.length).toBeGreaterThan(0);
    });

    it('should prioritize and optimize assertions', async () => {
      const context: AssertionContext = {
        action: 'complex user interaction',
        element: {
          selector: '#complex-element',
          type: 'button',
        },
        pageState: {
          url: 'https://example.com/complex',
          title: 'Complex Page',
          timestamp: Date.now(),
        },
        previousAssertions: [],
      };

      const assertions = await generator.generateAssertions(mockPage, context);

      expect(assertions).toBeDefined();
      expect(assertions.length).toBeLessThanOrEqual(8); // Should limit assertions

      // Should be sorted by priority and confidence
      if (assertions.length > 1) {
        const priorities = assertions.map(a => a.priority);
        const highPriorityCount = priorities.filter(p => p === 'high').length;
        const mediumPriorityCount = priorities.filter(p => p === 'medium').length;
        const lowPriorityCount = priorities.filter(p => p === 'low').length;

        // High priority assertions should come first
        if (highPriorityCount > 0 && mediumPriorityCount > 0) {
          const firstHighIndex = priorities.indexOf('high');
          const firstMediumIndex = priorities.indexOf('medium');
          expect(firstHighIndex).toBeLessThan(firstMediumIndex);
        }
      }
    });

    it('should assign confidence scores and reasoning', async () => {
      const context: AssertionContext = {
        action: 'submit form',
        element: {
          selector: '#submit',
          type: 'button',
        },
        pageState: {
          url: 'https://example.com/form',
          title: 'Form',
          timestamp: Date.now(),
        },
        previousAssertions: [],
      };

      const assertions = await generator.generateAssertions(mockPage, context);

      expect(assertions).toBeDefined();
      assertions.forEach(assertion => {
        expect(assertion.confidence).toBeGreaterThan(0);
        expect(assertion.confidence).toBeLessThanOrEqual(1);
        expect(assertion.reasoning).toBeDefined();
        expect(typeof assertion.reasoning).toBe('string');
        expect(assertion.reasoning.length).toBeGreaterThan(0);
        expect(assertion.priority).toMatch(/^(high|medium|low)$/);
        expect(assertion.category).toMatch(/^(functional|ui|performance|accessibility)$/);
      });
    });
  });

  describe('close', () => {
    it('should cleanup resources properly', async () => {
      await expect(generator.close()).resolves.not.toThrow();
    });
  });
});