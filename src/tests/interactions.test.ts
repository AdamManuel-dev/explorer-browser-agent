import { test, expect, describe, beforeEach, vi, MockedFunction } from '@jest/globals';
import { Page, Locator } from 'playwright';
import { InteractionExecutor } from '../interactions/InteractionExecutor';
import { DetectedElement } from '../types/detector';
import { InteractionResult } from '../types/interactions';
import { logger } from '../utils/logger';

vi.mock('../utils/logger');

describe('InteractionExecutor', () => {
  let executor: InteractionExecutor;
  let mockPage: Partial<Page>;
  let mockLocator: Partial<Locator>;

  beforeEach(() => {
    mockLocator = {
      fill: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockResolvedValue(undefined),
      check: vi.fn().mockResolvedValue(undefined),
      uncheck: vi.fn().mockResolvedValue(undefined),
      selectOption: vi.fn().mockResolvedValue([]),
      setInputFiles: vi.fn().mockResolvedValue(undefined),
      press: vi.fn().mockResolvedValue(undefined),
      hover: vi.fn().mockResolvedValue(undefined),
      dragTo: vi.fn().mockResolvedValue(undefined),
      isVisible: vi.fn().mockResolvedValue(true),
      isEnabled: vi.fn().mockResolvedValue(true),
      textContent: vi.fn().mockResolvedValue('Test Content'),
      getAttribute: vi.fn().mockResolvedValue('test-value'),
      boundingBox: vi.fn().mockResolvedValue({ x: 10, y: 10, width: 100, height: 30 }),
      screenshot: vi.fn().mockResolvedValue(Buffer.from('screenshot')),
      waitFor: vi.fn().mockResolvedValue(undefined),
    };

    mockPage = {
      locator: vi.fn().mockReturnValue(mockLocator),
      url: vi.fn().mockReturnValue('https://example.com'),
      screenshot: vi.fn().mockResolvedValue(Buffer.from('page-screenshot')),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue({}),
    };

    executor = new InteractionExecutor();
  });

  describe('initialization', () => {
    test('should initialize with default options', () => {
      expect(executor).toBeDefined();
    });

    test('should initialize with custom options', () => {
      const customExecutor = new InteractionExecutor({
        screenshotOnError: false,
        waitForStability: false,
        timeout: 10000,
        retryAttempts: 1,
      });
      expect(customExecutor).toBeDefined();
    });
  });

  describe('input field interactions', () => {
    test('should fill text input successfully', async () => {
      const element: DetectedElement = {
        id: 'username-input',
        type: 'input',
        selector: '#username',
        text: '',
        attributes: {
          inputType: 'text',
          name: 'username',
          placeholder: 'Enter username',
        },
        interactionType: ['fill'],
        confidence: 0.95,
        position: { x: 10, y: 10, width: 200, height: 30 },
        metadata: {
          name: 'username',
          required: true,
        },
      };

      const result = await executor.executeInteraction(mockPage as Page, element);

      expect(result.success).toBe(true);
      expect(result.action).toBe('fill');
      expect(result.value).toBeTruthy();
      expect(mockLocator.fill).toHaveBeenCalled();
    });

    test('should fill email input with valid email', async () => {
      const element: DetectedElement = {
        id: 'email-input',
        type: 'input',
        selector: '#email',
        text: '',
        attributes: {
          inputType: 'email',
          name: 'email',
        },
        interactionType: ['fill'],
        confidence: 0.95,
        position: { x: 10, y: 10, width: 200, height: 30 },
        metadata: {},
      };

      const result = await executor.executeInteraction(mockPage as Page, element);

      expect(result.success).toBe(true);
      expect(result.value).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/); // Basic email regex
    });

    test('should fill password input with secure password', async () => {
      const element: DetectedElement = {
        id: 'password-input',
        type: 'input',
        selector: '#password',
        text: '',
        attributes: {
          inputType: 'password',
          name: 'password',
        },
        interactionType: ['fill'],
        confidence: 0.95,
        position: { x: 10, y: 10, width: 200, height: 30 },
        metadata: {},
      };

      const result = await executor.executeInteraction(mockPage as Page, element);

      expect(result.success).toBe(true);
      expect(result.value?.length).toBeGreaterThanOrEqual(8);
    });

    test('should fill number input with valid number', async () => {
      const element: DetectedElement = {
        id: 'age-input',
        type: 'input',
        selector: '#age',
        text: '',
        attributes: {
          inputType: 'number',
          min: '18',
          max: '100',
        },
        interactionType: ['fill'],
        confidence: 0.95,
        position: { x: 10, y: 10, width: 200, height: 30 },
        metadata: {},
      };

      const result = await executor.executeInteraction(mockPage as Page, element);

      expect(result.success).toBe(true);
      const numValue = parseInt(result.value || '0');
      expect(numValue).toBeGreaterThanOrEqual(18);
      expect(numValue).toBeLessThanOrEqual(100);
    });

    test('should fill textarea with longer text', async () => {
      const element: DetectedElement = {
        id: 'description-textarea',
        type: 'textarea',
        selector: '#description',
        text: '',
        attributes: {
          name: 'description',
          placeholder: 'Enter description',
        },
        interactionType: ['fill'],
        confidence: 0.95,
        position: { x: 10, y: 10, width: 300, height: 100 },
        metadata: {},
      };

      const result = await executor.executeInteraction(mockPage as Page, element);

      expect(result.success).toBe(true);
      expect(result.value?.length).toBeGreaterThan(10);
      expect(mockLocator.fill).toHaveBeenCalled();
    });
  });

  describe('button interactions', () => {
    test('should click button successfully', async () => {
      const element: DetectedElement = {
        id: 'submit-button',
        type: 'button',
        selector: '#submit-btn',
        text: 'Submit',
        attributes: {
          type: 'submit',
        },
        interactionType: ['click'],
        confidence: 0.95,
        position: { x: 10, y: 10, width: 100, height: 40 },
        metadata: {},
      };

      const result = await executor.executeInteraction(mockPage as Page, element);

      expect(result.success).toBe(true);
      expect(result.action).toBe('click');
      expect(mockLocator.click).toHaveBeenCalled();
    });

    test('should handle navigation after button click', async () => {
      const element: DetectedElement = {
        id: 'nav-button',
        type: 'button',
        selector: '#nav-btn',
        text: 'Go to Dashboard',
        attributes: {},
        interactionType: ['click'],
        confidence: 0.95,
        position: { x: 10, y: 10, width: 100, height: 40 },
        metadata: {},
      };

      (mockPage.url as MockedFunction<any>)
        .mockReturnValueOnce('https://example.com/current')
        .mockReturnValueOnce('https://example.com/dashboard');

      const result = await executor.executeInteraction(mockPage as Page, element);

      expect(result.success).toBe(true);
      expect(result.navigationOccurred).toBe(true);
      expect(result.timing?.duration).toBeGreaterThan(0);
    });
  });

  describe('checkbox and radio interactions', () => {
    test('should check checkbox', async () => {
      const element: DetectedElement = {
        id: 'agree-checkbox',
        type: 'checkbox',
        selector: '#agree',
        text: 'I agree to terms',
        attributes: {
          name: 'agree',
          checked: false,
        },
        interactionType: ['check'],
        confidence: 0.95,
        position: { x: 10, y: 10, width: 20, height: 20 },
        metadata: {},
      };

      const result = await executor.executeInteraction(mockPage as Page, element);

      expect(result.success).toBe(true);
      expect(result.action).toBe('check');
      expect(mockLocator.check).toHaveBeenCalled();
    });

    test('should uncheck already checked checkbox', async () => {
      const element: DetectedElement = {
        id: 'newsletter-checkbox',
        type: 'checkbox',
        selector: '#newsletter',
        text: 'Subscribe to newsletter',
        attributes: {
          name: 'newsletter',
          checked: true,
        },
        interactionType: ['check'],
        confidence: 0.95,
        position: { x: 10, y: 10, width: 20, height: 20 },
        metadata: {},
      };

      const result = await executor.executeInteraction(mockPage as Page, element);

      expect(result.success).toBe(true);
      expect(mockLocator.uncheck).toHaveBeenCalled();
    });

    test('should select radio button', async () => {
      const element: DetectedElement = {
        id: 'gender-radio',
        type: 'radio',
        selector: 'input[name="gender"][value="male"]',
        text: 'Male',
        attributes: {
          name: 'gender',
          value: 'male',
        },
        interactionType: ['check'],
        confidence: 0.95,
        position: { x: 10, y: 10, width: 20, height: 20 },
        metadata: {},
      };

      const result = await executor.executeInteraction(mockPage as Page, element);

      expect(result.success).toBe(true);
      expect(result.action).toBe('check');
      expect(mockLocator.click).toHaveBeenCalled();
    });
  });

  describe('select dropdown interactions', () => {
    test('should select option from dropdown', async () => {
      const element: DetectedElement = {
        id: 'country-select',
        type: 'select',
        selector: '#country',
        text: '',
        attributes: {
          name: 'country',
        },
        interactionType: ['select'],
        confidence: 0.95,
        position: { x: 10, y: 10, width: 200, height: 30 },
        metadata: {
          options: ['US', 'UK', 'CA', 'AU'],
        },
      };

      const result = await executor.executeInteraction(mockPage as Page, element);

      expect(result.success).toBe(true);
      expect(result.action).toBe('select');
      expect(['US', 'UK', 'CA', 'AU']).toContain(result.value);
      expect(mockLocator.selectOption).toHaveBeenCalled();
    });

    test('should handle select without predefined options', async () => {
      const element: DetectedElement = {
        id: 'category-select',
        type: 'select',
        selector: '#category',
        text: '',
        attributes: {
          name: 'category',
        },
        interactionType: ['select'],
        confidence: 0.95,
        position: { x: 10, y: 10, width: 200, height: 30 },
        metadata: {},
      };

      // Mock getting options from the page
      (mockPage.evaluate as MockedFunction<any>).mockResolvedValue(['Option 1', 'Option 2', 'Option 3']);

      const result = await executor.executeInteraction(mockPage as Page, element);

      expect(result.success).toBe(true);
      expect(mockPage.evaluate).toHaveBeenCalled();
    });
  });

  describe('link interactions', () => {
    test('should click link successfully', async () => {
      const element: DetectedElement = {
        id: 'about-link',
        type: 'link',
        selector: 'a[href="/about"]',
        text: 'About Us',
        attributes: {
          href: '/about',
        },
        interactionType: ['click'],
        confidence: 0.95,
        position: { x: 10, y: 10, width: 100, height: 20 },
        metadata: {},
      };

      const result = await executor.executeInteraction(mockPage as Page, element);

      expect(result.success).toBe(true);
      expect(result.action).toBe('click');
      expect(mockLocator.click).toHaveBeenCalled();
    });

    test('should handle external link clicks', async () => {
      const element: DetectedElement = {
        id: 'external-link',
        type: 'link',
        selector: 'a[href="https://external.com"]',
        text: 'External Site',
        attributes: {
          href: 'https://external.com',
          target: '_blank',
        },
        interactionType: ['click'],
        confidence: 0.95,
        position: { x: 10, y: 10, width: 100, height: 20 },
        metadata: {},
      };

      const result = await executor.executeInteraction(mockPage as Page, element);

      expect(result.success).toBe(true);
      expect(result.metadata?.externalLink).toBe(true);
    });
  });

  describe('file upload interactions', () => {
    test('should upload file successfully', async () => {
      const element: DetectedElement = {
        id: 'file-input',
        type: 'file',
        selector: '#file-upload',
        text: '',
        attributes: {
          type: 'file',
          accept: '.pdf,.doc,.docx',
        },
        interactionType: ['upload'],
        confidence: 0.95,
        position: { x: 10, y: 10, width: 200, height: 30 },
        metadata: {},
      };

      const result = await executor.executeInteraction(mockPage as Page, element);

      expect(result.success).toBe(true);
      expect(result.action).toBe('upload');
      expect(result.value).toMatch(/\.(pdf|doc|docx|txt|jpg|png)$/);
      expect(mockLocator.setInputFiles).toHaveBeenCalled();
    });

    test('should handle multiple file upload', async () => {
      const element: DetectedElement = {
        id: 'multiple-files',
        type: 'file',
        selector: '#multiple-upload',
        text: '',
        attributes: {
          type: 'file',
          multiple: true,
        },
        interactionType: ['upload'],
        confidence: 0.95,
        position: { x: 10, y: 10, width: 200, height: 30 },
        metadata: {},
      };

      const result = await executor.executeInteraction(mockPage as Page, element);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
    });
  });

  describe('hover interactions', () => {
    test('should hover over element', async () => {
      const element: DetectedElement = {
        id: 'hover-menu',
        type: 'button',
        selector: '#menu-trigger',
        text: 'Menu',
        attributes: {},
        interactionType: ['hover'],
        confidence: 0.95,
        position: { x: 10, y: 10, width: 100, height: 30 },
        metadata: {},
      };

      const result = await executor.executeInteraction(mockPage as Page, element);

      expect(result.success).toBe(true);
      expect(result.action).toBe('hover');
      expect(mockLocator.hover).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    test('should handle element not found errors', async () => {
      const element: DetectedElement = {
        id: 'missing-element',
        type: 'button',
        selector: '#missing-btn',
        text: 'Missing Button',
        attributes: {},
        interactionType: ['click'],
        confidence: 0.95,
        position: { x: 10, y: 10, width: 100, height: 30 },
        metadata: {},
      };

      (mockPage.locator as MockedFunction<any>).mockImplementation(() => {
        throw new Error('Element not found');
      });

      const result = await executor.executeInteraction(mockPage as Page, element);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Element not found');
      expect(result.screenshotPath).toBeDefined();
    });

    test('should handle interaction timeout errors', async () => {
      const element: DetectedElement = {
        id: 'slow-element',
        type: 'button',
        selector: '#slow-btn',
        text: 'Slow Button',
        attributes: {},
        interactionType: ['click'],
        confidence: 0.95,
        position: { x: 10, y: 10, width: 100, height: 30 },
        metadata: {},
      };

      (mockLocator.click as MockedFunction<any>).mockRejectedValue(new Error('Timeout'));

      const result = await executor.executeInteraction(mockPage as Page, element);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout');
    });

    test('should retry failed interactions', async () => {
      const element: DetectedElement = {
        id: 'flaky-element',
        type: 'button',
        selector: '#flaky-btn',
        text: 'Flaky Button',
        attributes: {},
        interactionType: ['click'],
        confidence: 0.95,
        position: { x: 10, y: 10, width: 100, height: 30 },
        metadata: {},
      };

      let attemptCount = 0;
      (mockLocator.click as MockedFunction<any>).mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve();
      });

      const customExecutor = new InteractionExecutor({
        retryAttempts: 2,
        retryDelay: 100,
      });

      const result = await customExecutor.executeInteraction(mockPage as Page, element);

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(2);
    });

    test('should handle disabled elements', async () => {
      const element: DetectedElement = {
        id: 'disabled-button',
        type: 'button',
        selector: '#disabled-btn',
        text: 'Disabled Button',
        attributes: {
          disabled: true,
        },
        interactionType: ['click'],
        confidence: 0.95,
        position: { x: 10, y: 10, width: 100, height: 30 },
        metadata: {},
      };

      (mockLocator.isEnabled as MockedFunction<any>).mockResolvedValue(false);

      const result = await executor.executeInteraction(mockPage as Page, element);

      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled');
    });

    test('should handle hidden elements', async () => {
      const element: DetectedElement = {
        id: 'hidden-element',
        type: 'button',
        selector: '#hidden-btn',
        text: 'Hidden Button',
        attributes: {},
        interactionType: ['click'],
        confidence: 0.95,
        position: { x: 10, y: 10, width: 100, height: 30 },
        metadata: {},
      };

      (mockLocator.isVisible as MockedFunction<any>).mockResolvedValue(false);

      const result = await executor.executeInteraction(mockPage as Page, element);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not visible');
    });
  });

  describe('state tracking', () => {
    test('should track network activity during interaction', async () => {
      const element: DetectedElement = {
        id: 'ajax-button',
        type: 'button',
        selector: '#ajax-btn',
        text: 'Load Data',
        attributes: {},
        interactionType: ['click'],
        confidence: 0.95,
        position: { x: 10, y: 10, width: 100, height: 30 },
        metadata: {},
      };

      const result = await executor.executeInteraction(mockPage as Page, element);

      expect(result.success).toBe(true);
      expect(result.metadata?.networkActivity).toBeDefined();
    });

    test('should capture screenshots on success when enabled', async () => {
      const element: DetectedElement = {
        id: 'screenshot-element',
        type: 'button',
        selector: '#screenshot-btn',
        text: 'Screenshot Button',
        attributes: {},
        interactionType: ['click'],
        confidence: 0.95,
        position: { x: 10, y: 10, width: 100, height: 30 },
        metadata: {},
      };

      const customExecutor = new InteractionExecutor({
        screenshotOnSuccess: true,
      });

      const result = await customExecutor.executeInteraction(mockPage as Page, element);

      expect(result.success).toBe(true);
      expect(result.screenshotPath).toBeDefined();
    });

    test('should wait for element stability', async () => {
      const element: DetectedElement = {
        id: 'unstable-element',
        type: 'button',
        selector: '#unstable-btn',
        text: 'Unstable Button',
        attributes: {},
        interactionType: ['click'],
        confidence: 0.95,
        position: { x: 10, y: 10, width: 100, height: 30 },
        metadata: {},
      };

      const customExecutor = new InteractionExecutor({
        waitForStability: true,
        stabilityTimeout: 1000,
      });

      const result = await customExecutor.executeInteraction(mockPage as Page, element);

      expect(result.success).toBe(true);
      expect(mockLocator.waitFor).toHaveBeenCalledWith({
        state: 'stable',
        timeout: 1000,
      });
    });
  });

  describe('batch interactions', () => {
    test('should execute multiple interactions in sequence', async () => {
      const elements: DetectedElement[] = [
        {
          id: 'input1',
          type: 'input',
          selector: '#input1',
          text: '',
          attributes: { inputType: 'text' },
          interactionType: ['fill'],
          confidence: 0.95,
          position: { x: 10, y: 10, width: 200, height: 30 },
          metadata: {},
        },
        {
          id: 'input2',
          type: 'input',
          selector: '#input2',
          text: '',
          attributes: { inputType: 'email' },
          interactionType: ['fill'],
          confidence: 0.95,
          position: { x: 10, y: 50, width: 200, height: 30 },
          metadata: {},
        },
        {
          id: 'submit-btn',
          type: 'button',
          selector: '#submit',
          text: 'Submit',
          attributes: {},
          interactionType: ['click'],
          confidence: 0.95,
          position: { x: 10, y: 90, width: 100, height: 40 },
          metadata: {},
        },
      ];

      const results = await executor.executeInteractions(mockPage as Page, elements);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(results[0].action).toBe('fill');
      expect(results[1].action).toBe('fill');
      expect(results[2].action).toBe('click');
    });

    test('should handle partial failures in batch execution', async () => {
      const elements: DetectedElement[] = [
        {
          id: 'good-element',
          type: 'button',
          selector: '#good-btn',
          text: 'Good Button',
          attributes: {},
          interactionType: ['click'],
          confidence: 0.95,
          position: { x: 10, y: 10, width: 100, height: 30 },
          metadata: {},
        },
        {
          id: 'bad-element',
          type: 'button',
          selector: '#bad-btn',
          text: 'Bad Button',
          attributes: {},
          interactionType: ['click'],
          confidence: 0.95,
          position: { x: 10, y: 50, width: 100, height: 30 },
          metadata: {},
        },
      ];

      let clickCount = 0;
      (mockLocator.click as MockedFunction<any>).mockImplementation(() => {
        clickCount++;
        if (clickCount === 2) {
          throw new Error('Second click failed');
        }
        return Promise.resolve();
      });

      const results = await executor.executeInteractions(mockPage as Page, elements);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });
});