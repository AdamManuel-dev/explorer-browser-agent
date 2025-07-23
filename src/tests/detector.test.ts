import { test, expect, describe, beforeEach, vi, MockedFunction } from '@jest/globals';
import { Page, Locator } from 'playwright';
import { AIElementDetector, DetectionOptions } from '../detectors/AIElementDetector';
import { DetectedElement, ElementType } from '../types/detector';
import { logger } from '../utils/logger';

vi.mock('../utils/logger');

describe('AIElementDetector', () => {
  let detector: AIElementDetector;
  let mockPage: Partial<Page>;
  let mockLocator: Partial<Locator>;

  beforeEach(() => {
    mockLocator = {
      count: vi.fn().mockResolvedValue(1),
      nth: vi.fn().mockReturnThis(),
      getAttribute: vi.fn().mockResolvedValue(''),
      textContent: vi.fn().mockResolvedValue(''),
      isVisible: vi.fn().mockResolvedValue(true),
      isEnabled: vi.fn().mockResolvedValue(true),
      boundingBox: vi.fn().mockResolvedValue({ x: 10, y: 10, width: 100, height: 30 }),
    };

    mockPage = {
      locator: vi.fn().mockReturnValue(mockLocator),
      evaluate: vi.fn().mockResolvedValue([]),
      url: vi.fn().mockReturnValue('https://example.com'),
      title: vi.fn().mockResolvedValue('Test Page'),
    };

    detector = new AIElementDetector();
  });

  describe('initialization', () => {
    test('should initialize with default options', () => {
      expect(detector).toBeDefined();
    });

    test('should validate detection options', async () => {
      const invalidOptions: DetectionOptions = {
        includeHidden: true,
        includeDisabled: true,
        maxElements: -1, // Invalid
        timeout: -1000, // Invalid
      };

      await expect(detector.detectElements(mockPage as Page, invalidOptions))
        .rejects.toThrow();
    });
  });

  describe('form element detection', () => {
    test('should detect text inputs', async () => {
      (mockPage.evaluate as MockedFunction<any>).mockResolvedValue([
        {
          tagName: 'INPUT',
          type: 'text',
          name: 'username',
          id: 'username-field',
          placeholder: 'Enter username',
          required: true,
          selector: '#username-field',
        }
      ]);

      const options: DetectionOptions = {
        includeHidden: false,
        includeDisabled: false,
        maxElements: 100,
        timeout: 5000,
      };

      const result = await detector.detectElements(mockPage as Page, options);

      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].type).toBe('input');
      expect(result.elements[0].attributes.inputType).toBe('text');
      expect(result.elements[0].metadata.name).toBe('username');
      expect(result.elements[0].metadata.required).toBe(true);
    });

    test('should detect password inputs', async () => {
      (mockPage.evaluate as MockedFunction<any>).mockResolvedValue([
        {
          tagName: 'INPUT',
          type: 'password',
          name: 'password',
          id: 'password-field',
          selector: '#password-field',
        }
      ]);

      const result = await detector.detectElements(mockPage as Page);

      expect(result.elements[0].type).toBe('input');
      expect(result.elements[0].attributes.inputType).toBe('password');
      expect(result.elements[0].interactionType).toContain('fill');
    });

    test('should detect select dropdowns', async () => {
      (mockPage.evaluate as MockedFunction<any>).mockResolvedValue([
        {
          tagName: 'SELECT',
          name: 'country',
          id: 'country-select',
          selector: '#country-select',
          options: ['US', 'UK', 'CA'],
        }
      ]);

      const result = await detector.detectElements(mockPage as Page);

      expect(result.elements[0].type).toBe('select');
      expect(result.elements[0].interactionType).toContain('select');
      expect(result.elements[0].metadata.options).toEqual(['US', 'UK', 'CA']);
    });

    test('should detect textareas', async () => {
      (mockPage.evaluate as MockedFunction<any>).mockResolvedValue([
        {
          tagName: 'TEXTAREA',
          name: 'description',
          id: 'description-field',
          placeholder: 'Enter description',
          selector: '#description-field',
        }
      ]);

      const result = await detector.detectElements(mockPage as Page);

      expect(result.elements[0].type).toBe('textarea');
      expect(result.elements[0].interactionType).toContain('fill');
    });

    test('should detect checkboxes and radio buttons', async () => {
      (mockPage.evaluate as MockedFunction<any>).mockResolvedValue([
        {
          tagName: 'INPUT',
          type: 'checkbox',
          name: 'agree',
          id: 'agree-checkbox',
          selector: '#agree-checkbox',
          checked: false,
        },
        {
          tagName: 'INPUT',
          type: 'radio',
          name: 'gender',
          value: 'male',
          selector: 'input[name="gender"][value="male"]',
          checked: false,
        }
      ]);

      const result = await detector.detectElements(mockPage as Page);

      expect(result.elements).toHaveLength(2);
      expect(result.elements[0].type).toBe('checkbox');
      expect(result.elements[1].type).toBe('radio');
      expect(result.elements[0].interactionType).toContain('check');
      expect(result.elements[1].interactionType).toContain('check');
    });
  });

  describe('navigation element detection', () => {
    test('should detect buttons', async () => {
      (mockPage.evaluate as MockedFunction<any>).mockResolvedValue([
        {
          tagName: 'BUTTON',
          type: 'submit',
          textContent: 'Submit Form',
          id: 'submit-btn',
          selector: '#submit-btn',
        }
      ]);

      const result = await detector.detectElements(mockPage as Page);

      expect(result.elements[0].type).toBe('button');
      expect(result.elements[0].interactionType).toContain('click');
      expect(result.elements[0].text).toBe('Submit Form');
    });

    test('should detect links', async () => {
      (mockPage.evaluate as MockedFunction<any>).mockResolvedValue([
        {
          tagName: 'A',
          href: 'https://example.com/about',
          textContent: 'About Us',
          selector: 'a[href="/about"]',
        }
      ]);

      const result = await detector.detectElements(mockPage as Page);

      expect(result.elements[0].type).toBe('link');
      expect(result.elements[0].interactionType).toContain('click');
      expect(result.elements[0].attributes.href).toBe('https://example.com/about');
    });

    test('should detect images', async () => {
      (mockPage.evaluate as MockedFunction<any>).mockResolvedValue([
        {
          tagName: 'IMG',
          src: 'https://example.com/logo.png',
          alt: 'Company Logo',
          selector: 'img[alt="Company Logo"]',
        }
      ]);

      const result = await detector.detectElements(mockPage as Page);

      expect(result.elements[0].type).toBe('image');
      expect(result.elements[0].attributes.src).toBe('https://example.com/logo.png');
      expect(result.elements[0].attributes.alt).toBe('Company Logo');
    });
  });

  describe('filtering and options', () => {
    test('should exclude hidden elements by default', async () => {
      (mockPage.evaluate as MockedFunction<any>).mockResolvedValue([
        {
          tagName: 'INPUT',
          type: 'text',
          name: 'visible-input',
          selector: '#visible-input',
        },
        {
          tagName: 'INPUT',
          type: 'hidden',
          name: 'hidden-input',
          selector: '#hidden-input',
        }
      ]);

      // Mock visibility check
      (mockLocator.isVisible as MockedFunction<any>)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const result = await detector.detectElements(mockPage as Page, {
        includeHidden: false,
      });

      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].metadata.name).toBe('visible-input');
    });

    test('should include hidden elements when requested', async () => {
      (mockPage.evaluate as MockedFunction<any>).mockResolvedValue([
        {
          tagName: 'INPUT',
          type: 'text',
          name: 'visible-input',
          selector: '#visible-input',
        },
        {
          tagName: 'INPUT',
          type: 'hidden',
          name: 'hidden-input',
          selector: '#hidden-input',
        }
      ]);

      const result = await detector.detectElements(mockPage as Page, {
        includeHidden: true,
      });

      expect(result.elements).toHaveLength(2);
    });

    test('should exclude disabled elements by default', async () => {
      (mockPage.evaluate as MockedFunction<any>).mockResolvedValue([
        {
          tagName: 'BUTTON',
          textContent: 'Enabled Button',
          selector: '#enabled-btn',
          disabled: false,
        },
        {
          tagName: 'BUTTON',
          textContent: 'Disabled Button',
          selector: '#disabled-btn',
          disabled: true,
        }
      ]);

      // Mock enabled check
      (mockLocator.isEnabled as MockedFunction<any>)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const result = await detector.detectElements(mockPage as Page, {
        includeDisabled: false,
      });

      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].text).toBe('Enabled Button');
    });

    test('should respect max elements limit', async () => {
      const mockElements = Array.from({ length: 10 }, (_, i) => ({
        tagName: 'BUTTON',
        textContent: `Button ${i + 1}`,
        selector: `#btn-${i + 1}`,
      }));

      (mockPage.evaluate as MockedFunction<any>).mockResolvedValue(mockElements);

      const result = await detector.detectElements(mockPage as Page, {
        maxElements: 5,
      });

      expect(result.elements).toHaveLength(5);
    });
  });

  describe('element classification', () => {
    test('should classify interactive elements correctly', async () => {
      (mockPage.evaluate as MockedFunction<any>).mockResolvedValue([
        {
          tagName: 'INPUT',
          type: 'text',
          name: 'search',
          selector: '#search-input',
        },
        {
          tagName: 'BUTTON',
          type: 'submit',
          textContent: 'Search',
          selector: '#search-btn',
        },
        {
          tagName: 'A',
          href: '/results',
          textContent: 'View Results',
          selector: '#results-link',
        }
      ]);

      const result = await detector.detectElements(mockPage as Page);

      expect(result.elements).toHaveLength(3);
      
      const inputElement = result.elements.find(e => e.type === 'input');
      const buttonElement = result.elements.find(e => e.type === 'button');
      const linkElement = result.elements.find(e => e.type === 'link');

      expect(inputElement?.interactionType).toContain('fill');
      expect(buttonElement?.interactionType).toContain('click');
      expect(linkElement?.interactionType).toContain('click');
    });

    test('should detect form associations', async () => {
      (mockPage.evaluate as MockedFunction<any>).mockResolvedValue([
        {
          tagName: 'INPUT',
          type: 'text',
          name: 'username',
          form: 'login-form',
          selector: '#username',
        },
        {
          tagName: 'INPUT',
          type: 'password',
          name: 'password',
          form: 'login-form',
          selector: '#password',
        },
        {
          tagName: 'BUTTON',
          type: 'submit',
          form: 'login-form',
          textContent: 'Login',
          selector: '#login-btn',
        }
      ]);

      const result = await detector.detectElements(mockPage as Page);

      expect(result.elements).toHaveLength(3);
      result.elements.forEach(element => {
        expect(element.metadata.form).toBe('login-form');
      });
    });
  });

  describe('error handling', () => {
    test('should handle page evaluation errors', async () => {
      (mockPage.evaluate as MockedFunction<any>).mockRejectedValue(
        new Error('Page evaluation failed')
      );

      const result = await detector.detectElements(mockPage as Page);

      expect(result.elements).toHaveLength(0);
      expect(result.metadata.errors).toHaveLength(1);
      expect(result.metadata.errors[0]).toContain('Page evaluation failed');
    });

    test('should handle individual element processing errors', async () => {
      (mockPage.evaluate as MockedFunction<any>).mockResolvedValue([
        {
          tagName: 'INPUT',
          type: 'text',
          selector: '#valid-input',
        },
        {
          tagName: 'INVALID',
          selector: '#invalid-element',
        }
      ]);

      // Mock locator error for invalid element
      (mockPage.locator as MockedFunction<any>).mockImplementation((selector) => {
        if (selector === '#invalid-element') {
          throw new Error('Invalid selector');
        }
        return mockLocator;
      });

      const result = await detector.detectElements(mockPage as Page);

      expect(result.elements).toHaveLength(1);
      expect(result.metadata.errors).toHaveLength(1);
    });

    test('should handle timeout errors gracefully', async () => {
      (mockPage.evaluate as MockedFunction<any>).mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const result = await detector.detectElements(mockPage as Page, {
        timeout: 50,
      });

      expect(result.elements).toHaveLength(0);
      expect(result.metadata.errors).toHaveLength(1);
    });
  });

  describe('metadata generation', () => {
    test('should generate comprehensive metadata', async () => {
      (mockPage.evaluate as MockedFunction<any>).mockResolvedValue([
        {
          tagName: 'INPUT',
          type: 'text',
          name: 'username',
          selector: '#username',
        }
      ]);

      const result = await detector.detectElements(mockPage as Page);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.totalElements).toBe(1);
      expect(result.metadata.detectedAt).toBeInstanceOf(Date);
      expect(result.metadata.url).toBe('https://example.com');
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
    });

    test('should categorize elements by type', async () => {
      (mockPage.evaluate as MockedFunction<any>).mockResolvedValue([
        { tagName: 'INPUT', type: 'text', selector: '#input1' },
        { tagName: 'INPUT', type: 'email', selector: '#input2' },
        { tagName: 'BUTTON', textContent: 'Click me', selector: '#btn1' },
        { tagName: 'A', href: '/link', textContent: 'Link', selector: '#link1' },
      ]);

      const result = await detector.detectElements(mockPage as Page);

      expect(result.metadata.elementCounts).toBeDefined();
      expect(result.metadata.elementCounts.input).toBe(2);
      expect(result.metadata.elementCounts.button).toBe(1);
      expect(result.metadata.elementCounts.link).toBe(1);
    });
  });
});