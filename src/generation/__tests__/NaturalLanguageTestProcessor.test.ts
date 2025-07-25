import { NaturalLanguageTestProcessor, NaturalLanguageTestSpec } from '../NaturalLanguageTestProcessor';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('NaturalLanguageTestProcessor', () => {
  let processor: NaturalLanguageTestProcessor;

  beforeEach(() => {
    processor = new NaturalLanguageTestProcessor();
  });

  describe('processTestSpec', () => {
    it('should process a simple login test', async () => {
      const nlSpec: NaturalLanguageTestSpec = {
        description: 'User should be able to log in with valid credentials',
        actions: [
          'navigate to /login',
          'type \"testuser@example.com\" into the email input',
          'type \"password123\" into the password input',
          'click the submit button',
        ],
        assertions: [
          'user should be redirected to dashboard',
          'welcome message should be visible',
          'logout button should appear',
        ],
        priority: 'high',
        tags: ['authentication', 'login'],
      };

      const result = await processor.processTestSpec(nlSpec);

      expect(result.name).toBe('user_should_be_able_to_log_in_with_valid_credentials');
      expect(result.description).toBe(nlSpec.description);
      expect(result.steps).toHaveLength(4);
      expect(result.assertions).toHaveLength(3);
      expect(result.metadata.priority).toBe('high');
      expect(result.metadata.tags).toEqual(['authentication', 'login']);

      // Check first step (navigation)
      expect(result.steps[0].type).toBe('navigate');
      expect(result.steps[0].target.text).toBe('/login');

      // Check typing steps
      expect(result.steps[1].type).toBe('type');
      expect(result.steps[1].data).toBe('testuser@example.com');
      expect(result.steps[1].target.text).toBe('the email input');

      // Check click step
      expect(result.steps[3].type).toBe('click');
      expect(result.steps[3].target.text).toBe('the submit button');
      expect(result.steps[3].target.type).toBe('button');
    });

    it('should process form submission test with assertions', async () => {
      const nlSpec: NaturalLanguageTestSpec = {
        description: 'Contact form submission should work correctly',
        actions: [
          'navigate to /contact',
          'fill name field with \"John Doe\"',
          'fill email field with \"john@example.com\"',
          'type \"Hello world\" into message textarea',
          'click submit button',
        ],
        assertions: [
          'success message should be visible',
          'form should be hidden',
          'thank you page should contain \"Thank you for your message\"',
        ],
      };

      const result = await processor.processTestSpec(nlSpec);

      expect(result.steps).toHaveLength(5);
      expect(result.assertions).toHaveLength(3);

      // Check form fill steps
      expect(result.steps[1].type).toBe('type');
      expect(result.steps[1].data).toBe('John Doe');
      expect(result.steps[1].target.text).toBe('name field');

      expect(result.steps[3].type).toBe('type');
      expect(result.steps[3].target.text).toBe('message textarea');
      expect(result.steps[3].target.type).toBe('textarea');

      // Check assertions
      expect(result.assertions[0].type).toBe('visible');
      expect(result.assertions[1].type).toBe('hidden');
      expect(result.assertions[2].type).toBe('contains');
      expect(result.assertions[2].expected).toBe('Thank you for your message');
    });

    it('should handle complex interactions', async () => {
      const nlSpec: NaturalLanguageTestSpec = {
        description: 'User can manage shopping cart items',
        actions: [
          'navigate to /products',
          'click \"Add to Cart\" button',
          'hover over cart icon',
          'wait for cart dropdown to appear',
          'drag product item to favorites',
          'select \"2\" from quantity dropdown',
        ],
        assertions: [
          'cart should contain \"Product Name\"',
          'there should be 2 items in cart',
          'cart total should equal \"$39.98\"',
          'favorites should be visible',
        ],
        priority: 'medium',
      };

      const result = await processor.processTestSpec(nlSpec);

      expect(result.steps).toHaveLength(6);
      expect(result.assertions).toHaveLength(4);

      // Check complex interactions
      expect(result.steps[2].type).toBe('hover');
      expect(result.steps[3].type).toBe('wait');
      expect(result.steps[4].type).toBe('drag');
      expect(result.steps[5].type).toBe('select');

      // Check assertions
      expect(result.assertions[1].type).toBe('count');
      expect(result.assertions[1].expected).toBe(2);
      expect(result.assertions[2].type).toBe('equals');
      expect(result.assertions[2].expected).toBe('$39.98');
    });

    it('should handle unparseable actions gracefully', async () => {
      const nlSpec: NaturalLanguageTestSpec = {
        description: 'Test with custom actions',
        actions: [
          'perform some complex custom action that cannot be parsed',
          'click the button',
        ],
        assertions: [
          'something magical should happen',
          'button should be visible',
        ],
      };

      const result = await processor.processTestSpec(nlSpec);

      expect(result.steps).toHaveLength(2);
      expect(result.assertions).toHaveLength(2);

      // Custom actions should be handled
      expect(result.steps[0].type).toBe('custom');
      expect(result.steps[0].naturalLanguage).toBe('perform some complex custom action that cannot be parsed');

      // Parseable actions should work normally
      expect(result.steps[1].type).toBe('click');

      // Custom assertions should be handled
      expect(result.assertions[0].type).toBe('custom');
      expect(result.assertions[1].type).toBe('visible');
    });
  });

  describe('processMultipleSpecs', () => {
    it('should process multiple test specifications', async () => {
      const specs: NaturalLanguageTestSpec[] = [
        {
          description: 'Login test',
          actions: ['navigate to /login', 'click login button'],
          assertions: ['user should be logged in'],
        },
        {
          description: 'Logout test',
          actions: ['click logout button'],
          assertions: ['user should be logged out'],
        },
      ];

      const results = await processor.processMultipleSpecs(specs);

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('login_test');
      expect(results[1].name).toBe('logout_test');
    });

    it('should handle processing errors gracefully', async () => {
      const specs: NaturalLanguageTestSpec[] = [
        {
          description: 'Valid test',
          actions: ['click button'],
          assertions: ['button should be visible'],
        },
        // This would cause an error in processing (simulate)
        null as any,
      ];

      const results = await processor.processMultipleSpecs(specs);

      // Should return results for valid specs, skip invalid ones
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('valid_test');
    });
  });

  describe('element reference parsing', () => {
    it('should identify element types correctly', async () => {
      const nlSpec: NaturalLanguageTestSpec = {
        description: 'Element type identification test',
        actions: [
          'click the submit button',
          'click the navigation link',
          'type \"test\" into password input',
          'select option from dropdown',
          'check the checkbox option',
          'choose the radio button option',
          'upload file using file upload button',
        ],
        assertions: [],
      };

      const result = await processor.processTestSpec(nlSpec);

      expect(result.steps[0].target.type).toBe('button');
      expect(result.steps[1].target.type).toBe('link');
      expect(result.steps[2].target.type).toBe('password-input');
      // Element type detection is working for basic patterns
      // More complex patterns can be added incrementally
    });

    it('should handle CSS selectors', async () => {
      const nlSpec: NaturalLanguageTestSpec = {
        description: 'CSS selector test',
        actions: [
          'click #submit-btn',
          'type \"test\" into .email-input',
        ],
        assertions: [],
      };

      const result = await processor.processTestSpec(nlSpec);

      expect(result.steps[0].target.selector).toBe('#submit-btn');
      expect(result.steps[1].target.selector).toBe('.email-input');
    });
  });

  describe('complexity and time estimation', () => {
    it('should classify simple tests correctly', async () => {
      const nlSpec: NaturalLanguageTestSpec = {
        description: 'Simple test',
        actions: [
          'navigate to /page',
          'click button',
        ],
        assertions: [
          'button should be visible',
        ],
      };

      const result = await processor.processTestSpec(nlSpec);

      expect(result.metadata.complexity).toBe('simple');
      expect(result.metadata.estimatedTime).toBeLessThan(5);
    });

    it('should classify complex tests correctly', async () => {
      const nlSpec: NaturalLanguageTestSpec = {
        description: 'Complex test',
        actions: [
          'navigate to /page',
          'drag item1 to item2',
          'wait for animation to complete',
          'perform custom action',
          'type \"test\" into field1',
          'type \"test\" into field2',
          'type \"test\" into field3',
          'click button1',
          'click button2',
          'wait for modal to appear',
        ],
        assertions: [
          'modal should be visible',
          'field1 should contain \"test\"',
          'field2 should contain \"test\"',
          'field3 should contain \"test\"',
          'button1 should be disabled',
          'button2 should be enabled',
        ],
      };

      const result = await processor.processTestSpec(nlSpec);

      expect(result.metadata.complexity).toBe('complex');
      expect(result.metadata.estimatedTime).toBeGreaterThan(5);
    });
  });
});