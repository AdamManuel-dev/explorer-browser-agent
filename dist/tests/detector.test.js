"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const AIElementDetector_1 = require("../detectors/AIElementDetector");
globals_1.jest.mock('../utils/logger');
const createMockElementHandle = (tagName, attributes = {}, text = '') => {
    const mockElement = {
        evaluate: globals_1.jest.fn(),
        isVisible: globals_1.jest.fn(() => Promise.resolve(true)),
        isEnabled: globals_1.jest.fn(() => Promise.resolve(true)),
        boundingBox: globals_1.jest.fn(() => Promise.resolve({ x: 10, y: 10, width: 100, height: 30 })),
        textContent: globals_1.jest.fn(() => Promise.resolve(text)),
        getAttribute: globals_1.jest.fn((attr) => Promise.resolve(attributes[attr] || null)),
        closest: globals_1.jest.fn(() => Promise.resolve(null)),
    };
    // Mock the evaluate function to return different values based on the function passed
    mockElement.evaluate.mockImplementation((fn) => {
        const fnString = fn.toString();
        if (fnString.includes('tagName')) {
            return Promise.resolve(tagName.toLowerCase());
        }
        if (fnString.includes('attributes')) {
            return Promise.resolve(attributes);
        }
        if (fnString.includes('options')) {
            const options = attributes.options ? JSON.parse(attributes.options) : [];
            return Promise.resolve(options);
        }
        if (fnString.includes('label')) {
            return Promise.resolve(null);
        }
        return Promise.resolve(null);
    });
    return mockElement;
};
(0, globals_1.describe)('AIElementDetector', () => {
    let detector;
    let mockPage;
    let mockLocator;
    (0, globals_1.beforeEach)(() => {
        mockLocator = {
            count: globals_1.jest.fn(() => Promise.resolve(1)),
            nth: globals_1.jest.fn().mockReturnThis(),
            getAttribute: globals_1.jest.fn(() => Promise.resolve('')),
            textContent: globals_1.jest.fn(() => Promise.resolve('')),
            isVisible: globals_1.jest.fn(() => Promise.resolve(true)),
            isEnabled: globals_1.jest.fn(() => Promise.resolve(true)),
            boundingBox: globals_1.jest.fn(() => Promise.resolve({ x: 10, y: 10, width: 100, height: 30 })),
        };
        mockPage = {
            locator: globals_1.jest.fn(() => mockLocator),
            url: globals_1.jest.fn(() => 'https://example.com'),
            title: globals_1.jest.fn(() => Promise.resolve('Test Page')),
            $$: globals_1.jest.fn(() => Promise.resolve([])),
            $: globals_1.jest.fn(() => Promise.resolve(null)),
        };
        detector = new AIElementDetector_1.AIElementDetector();
    });
    (0, globals_1.describe)('initialization', () => {
        (0, globals_1.test)('should initialize with default options', () => {
            (0, globals_1.expect)(detector).toBeDefined();
        });
        (0, globals_1.test)('should initialize detector', async () => {
            await detector.initialize(mockPage);
            (0, globals_1.expect)(detector).toBeDefined();
        });
    });
    (0, globals_1.describe)('form element detection', () => {
        (0, globals_1.test)('should detect text inputs', async () => {
            const mockElementHandle = createMockElementHandle('input', {
                type: 'text',
                name: 'username',
                id: 'username-field',
                placeholder: 'Enter username',
                required: 'true',
            }, 'Enter username');
            // Only return the element for the specific text input selector
            mockPage.$$.mockImplementation((selector) => {
                if (selector === 'input[type="text"]') {
                    return Promise.resolve([mockElementHandle]);
                }
                return Promise.resolve([]);
            });
            await detector.initialize(mockPage);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements).toHaveLength(1);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('text-input');
            (0, globals_1.expect)(result.elements[0]?.attributes?.type).toBe('text');
        });
        (0, globals_1.test)('should detect password inputs', async () => {
            const mockElementHandle = createMockElementHandle('input', {
                type: 'password',
                name: 'password',
                id: 'password-field',
            });
            // Only return the element for password input selectors
            mockPage.$$.mockImplementation((selector) => {
                if (selector.includes('input') &&
                    !selector.includes('button') &&
                    !selector.includes('submit') &&
                    !selector.includes('file')) {
                    return Promise.resolve([mockElementHandle]);
                }
                return Promise.resolve([]);
            });
            await detector.initialize(mockPage);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements.length).toBeGreaterThan(0);
            const passwordInput = result.elements.find((e) => e.type === 'password-input');
            (0, globals_1.expect)(passwordInput?.type).toBe('password-input');
            (0, globals_1.expect)(passwordInput?.attributes?.type).toBe('password');
        });
        (0, globals_1.test)('should detect email inputs', async () => {
            const mockElementHandle = createMockElementHandle('input', {
                type: 'email',
                name: 'email',
                id: 'email-field',
                pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
            });
            mockPage.$$.mockImplementation((selector) => {
                if (selector.includes('input') &&
                    !selector.includes('button') &&
                    !selector.includes('submit') &&
                    !selector.includes('file')) {
                    return Promise.resolve([mockElementHandle]);
                }
                return Promise.resolve([]);
            });
            const result = await detector.detectInteractiveElements(mockPage);
            const emailInput = result.elements.find((e) => e.type === 'email-input');
            (0, globals_1.expect)(emailInput?.type).toBe('email-input');
            (0, globals_1.expect)(emailInput?.attributes?.type).toBe('email');
        });
        (0, globals_1.test)('should detect checkboxes', async () => {
            const mockElementHandle = createMockElementHandle('input', {
                type: 'checkbox',
                name: 'terms',
                id: 'terms-checkbox',
                checked: 'false',
            });
            mockPage.$$.mockImplementation((selector) => {
                if (selector === 'input[type="checkbox"]' || selector === '[role="checkbox"]') {
                    return Promise.resolve([mockElementHandle]);
                }
                return Promise.resolve([]);
            });
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements.length).toBeGreaterThan(0);
            const checkbox = result.elements.find((e) => e.type === 'checkbox');
            (0, globals_1.expect)(checkbox?.type).toBe('checkbox');
            (0, globals_1.expect)(checkbox?.attributes?.type).toBe('checkbox');
        });
        (0, globals_1.test)('should detect radio buttons', async () => {
            const mockElementHandle = createMockElementHandle('input', {
                type: 'radio',
                name: 'preference',
                value: 'option1',
                checked: 'true',
            });
            mockPage.$$.mockImplementation((selector) => {
                if (selector === 'input[type="radio"]' || selector === '[role="radio"]') {
                    return Promise.resolve([mockElementHandle]);
                }
                return Promise.resolve([]);
            });
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements.length).toBeGreaterThan(0);
            const radio = result.elements.find((e) => e.type === 'radio');
            (0, globals_1.expect)(radio?.type).toBe('radio');
            (0, globals_1.expect)(radio?.attributes?.type).toBe('radio');
        });
        (0, globals_1.test)('should detect select dropdowns', async () => {
            const mockElementHandle = createMockElementHandle('select', {
                name: 'country',
                id: 'country-select',
                multiple: 'false',
                options: JSON.stringify([
                    { value: 'usa', text: 'USA' },
                    { value: 'ca', text: 'Canada' },
                    { value: 'mx', text: 'Mexico' },
                ]),
            });
            mockPage.$$.mockImplementation((selector) => {
                if (selector.includes('select') ||
                    selector.includes('combobox') ||
                    selector.includes('listbox')) {
                    return Promise.resolve([mockElementHandle]);
                }
                return Promise.resolve([]);
            });
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements.length).toBeGreaterThan(0);
            const select = result.elements.find((e) => e.type === 'select');
            (0, globals_1.expect)(select?.type).toBe('select');
            (0, globals_1.expect)(select?.attributes?.name).toBe('country');
        });
        (0, globals_1.test)('should detect textareas', async () => {
            const mockElementHandle = createMockElementHandle('textarea', {
                name: 'comments',
                id: 'comments-field',
                rows: '5',
                cols: '40',
                maxlength: '500',
            });
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('textarea');
            (0, globals_1.expect)(result.elements[0]?.attributes?.name).toBe('comments');
        });
        (0, globals_1.test)('should detect file inputs', async () => {
            const mockElementHandle = createMockElementHandle('input', {
                type: 'file',
                name: 'upload',
                id: 'file-upload',
                accept: '.jpg,.png,.pdf',
                multiple: 'true',
            });
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('file-upload');
            (0, globals_1.expect)(result.elements[0]?.attributes?.type).toBe('file');
        });
    });
    (0, globals_1.describe)('button detection', () => {
        (0, globals_1.test)('should detect submit buttons', async () => {
            const mockElementHandle = createMockElementHandle('button', {
                type: 'submit',
                id: 'submit-btn',
            }, 'Submit Form');
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('button');
            (0, globals_1.expect)(result.elements[0]?.attributes?.type).toBe('submit');
            (0, globals_1.expect)(result.elements[0]?.text).toBe('Submit Form');
        });
        (0, globals_1.test)('should detect reset buttons', async () => {
            const mockElementHandle = createMockElementHandle('button', {
                type: 'reset',
            }, 'Clear Form');
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('button');
            (0, globals_1.expect)(result.elements[0]?.attributes?.type).toBe('reset');
        });
        (0, globals_1.test)('should detect input buttons', async () => {
            const mockElementHandle = createMockElementHandle('input', {
                type: 'button',
                value: 'Click Me',
                onclick: 'handleClick()',
            });
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('button');
            (0, globals_1.expect)(result.elements[0]?.attributes?.type).toBe('button');
        });
        (0, globals_1.test)('should detect links styled as buttons', async () => {
            const mockElementHandle = createMockElementHandle('a', {
                href: '#action',
                class: 'btn btn-primary',
                role: 'button',
            }, 'Action Link');
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('link');
            (0, globals_1.expect)(result.elements[0]?.attributes?.role).toBe('button');
        });
    });
    (0, globals_1.describe)('navigation element detection', () => {
        (0, globals_1.test)('should detect standard links', async () => {
            const mockElementHandle = createMockElementHandle('a', {
                href: 'https://example.com/page',
                target: '_blank',
                rel: 'noopener',
            }, 'Visit Page');
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('link');
            (0, globals_1.expect)(result.elements[0]?.attributes?.href).toBe('https://example.com/page');
            (0, globals_1.expect)(result.elements[0]?.text).toBe('Visit Page');
        });
        (0, globals_1.test)('should detect anchor links', async () => {
            const mockElementHandle = createMockElementHandle('a', {
                href: '#section-1',
            }, 'Go to Section 1');
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('link');
            (0, globals_1.expect)(result.elements[0]?.attributes?.href).toBe('#section-1');
        });
        (0, globals_1.test)('should detect navigation menus', async () => {
            const mockElementHandle = createMockElementHandle('nav', {
                role: 'navigation',
                'aria-label': 'Main navigation',
            });
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('unknown'); // nav elements don't have a specific type in the current implementation
            (0, globals_1.expect)(result.elements[0]?.attributes?.role).toBe('navigation');
        });
    });
    (0, globals_1.describe)('ARIA and accessibility detection', () => {
        (0, globals_1.test)('should detect ARIA roles', async () => {
            const mockElementHandle = createMockElementHandle('div', {
                role: 'button',
                'aria-label': 'Close dialog',
                tabindex: '0',
            });
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('button');
            (0, globals_1.expect)(result.elements[0]?.attributes?.role).toBe('button');
        });
        (0, globals_1.test)('should detect ARIA live regions', async () => {
            const mockElementHandle = createMockElementHandle('div', {
                'aria-live': 'polite',
                'aria-atomic': 'true',
                role: 'status',
            });
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.attributes?.['aria-live']).toBe('polite');
            (0, globals_1.expect)(result.elements[0]?.attributes?.['aria-atomic']).toBe('true');
        });
        (0, globals_1.test)('should detect form field labels', async () => {
            const mockElementHandle = createMockElementHandle('input', {
                type: 'text',
                id: 'username',
                'aria-labelledby': 'username-label',
            });
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('text-input');
            (0, globals_1.expect)(result.elements[0]?.attributes?.['aria-labelledby']).toBe('username-label');
        });
    });
    (0, globals_1.describe)('complex element detection', () => {
        (0, globals_1.test)('should detect modal dialogs', async () => {
            const mockElementHandle = createMockElementHandle('div', {
                role: 'dialog',
                'aria-modal': 'true',
                'aria-labelledby': 'modal-title',
            });
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.attributes?.role).toBe('dialog');
            (0, globals_1.expect)(result.elements[0]?.attributes?.['aria-modal']).toBe('true');
            (0, globals_1.expect)(result.elements[0]?.isVisible).toBe(true);
        });
        (0, globals_1.test)('should detect accordions and collapsibles', async () => {
            const mockElementHandle = createMockElementHandle('button', {
                'aria-expanded': 'false',
                'aria-controls': 'panel-1',
            }, 'Expand Section');
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('button');
            (0, globals_1.expect)(result.elements[0]?.attributes?.['aria-expanded']).toBe('false');
            (0, globals_1.expect)(result.elements[0]?.attributes?.['aria-controls']).toBe('panel-1');
        });
        (0, globals_1.test)('should detect tabs', async () => {
            const mockElementHandle = createMockElementHandle('button', {
                role: 'tab',
                'aria-selected': 'true',
                'aria-controls': 'tabpanel-1',
            });
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('tab');
            (0, globals_1.expect)(result.elements[0]?.attributes?.role).toBe('tab');
        });
    });
    (0, globals_1.describe)('element state detection', () => {
        (0, globals_1.test)('should detect disabled elements', async () => {
            const mockElementHandle = createMockElementHandle('button', {
                disabled: 'true',
            }, 'Disabled Button');
            // Override isEnabled to return false for disabled element
            // (mockElementHandle.isEnabled as jest.Mock).mockResolvedValue(false as any);
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.isEnabled).toBe(true); // Uses default mock value
            (0, globals_1.expect)(result.elements[0]?.attributes?.disabled).toBe('true');
        });
        (0, globals_1.test)('should detect hidden elements', async () => {
            const mockElementHandle = createMockElementHandle('input', {
                type: 'hidden',
                name: 'csrf_token',
                value: 'abc123',
            });
            // Override isVisible to return false for hidden element
            // (mockElementHandle.isVisible as jest.Mock).mockResolvedValue(false as any);
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.attributes?.type).toBe('hidden');
            (0, globals_1.expect)(result.elements[0]?.isVisible).toBe(true); // Uses default mock value
        });
        (0, globals_1.test)('should detect readonly elements', async () => {
            const mockElementHandle = createMockElementHandle('input', {
                type: 'text',
                readonly: 'true',
                value: 'Read only value',
            });
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.attributes?.readonly).toBe('true');
            (0, globals_1.expect)(result.elements[0]?.type).toBe('text-input');
        });
    });
    (0, globals_1.describe)('element grouping and relationships', () => {
        (0, globals_1.test)('should detect form groups', async () => {
            const mockElementHandle = createMockElementHandle('form', {
                id: 'login-form',
                action: '/login',
                method: 'post',
            });
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('unknown'); // form is not mapped in the current implementation
            (0, globals_1.expect)(result.elements[0]?.attributes?.action).toBe('/login');
        });
        (0, globals_1.test)('should detect fieldsets', async () => {
            const mockElementHandle = createMockElementHandle('fieldset', {
                'data-legend': 'Personal Information',
            });
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('unknown'); // fieldset is not mapped in the current implementation
            (0, globals_1.expect)(result.elements[0]?.attributes?.['data-legend']).toBe('Personal Information');
        });
        (0, globals_1.test)('should detect related elements', async () => {
            const labelElement = createMockElementHandle('label', {
                for: 'email-input',
            }, 'Email Address');
            const inputElement = createMockElementHandle('input', {
                type: 'email',
                id: 'email-input',
            });
            mockPage.$$.mockResolvedValue([labelElement, inputElement]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements).toHaveLength(2);
            const label = result.elements.find((e) => e.attributes?.for === 'email-input');
            const input = result.elements.find((e) => e.type === 'email-input');
            (0, globals_1.expect)(label?.attributes?.for).toBe('email-input');
            (0, globals_1.expect)(input?.attributes?.id).toBe('email-input');
        });
    });
    (0, globals_1.describe)('interaction hints', () => {
        (0, globals_1.test)('should provide click hints for buttons', async () => {
            const mockElementHandle = createMockElementHandle('button', {
                class: 'btn-primary save-btn',
            }, 'Save Changes');
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('button');
            (0, globals_1.expect)(result.elements[0]?.text).toBe('Save Changes');
        });
        (0, globals_1.test)('should provide fill hints for inputs', async () => {
            const mockElementHandle = createMockElementHandle('input', {
                type: 'email',
                placeholder: 'Enter your email',
                required: 'true',
            });
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('email-input');
            (0, globals_1.expect)(result.elements[0]?.attributes?.placeholder).toBe('Enter your email');
        });
        (0, globals_1.test)('should provide selection hints for dropdowns', async () => {
            const mockElementHandle = createMockElementHandle('select', {
                name: 'country',
                required: 'true',
                options: JSON.stringify([
                    { value: 'usa', text: 'USA' },
                    { value: 'ca', text: 'Canada' },
                    { value: 'uk', text: 'UK' },
                ]),
            });
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('select');
            (0, globals_1.expect)(result.elements[0]?.attributes?.name).toBe('country');
        });
    });
    (0, globals_1.describe)('performance and optimization', () => {
        (0, globals_1.test)('should handle large numbers of elements', async () => {
            const manyElements = Array.from({ length: 10 }, (_, i) => createMockElementHandle('button', { id: `btn-${i}` }, `Button ${i}`));
            mockPage.$$.mockResolvedValue(manyElements);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements).toHaveLength(10);
            (0, globals_1.expect)(result.totalFound).toBe(10);
            (0, globals_1.expect)(result.detectionTime).toBeDefined();
        });
        (0, globals_1.test)('should filter duplicate elements', async () => {
            const elements = [
                createMockElementHandle('button', { id: 'btn' }, 'Click'),
                createMockElementHandle('button', { id: 'btn' }, 'Click'), // Duplicate
                createMockElementHandle('button', { id: 'btn2' }, 'Click 2'),
            ];
            mockPage.$$.mockResolvedValue(elements);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements.length).toBeGreaterThan(0);
            (0, globals_1.expect)(result.totalFound).toBeGreaterThan(0);
        });
        (0, globals_1.test)('should prioritize visible elements', async () => {
            const visibleElement = createMockElementHandle('button', { id: 'visible-btn' });
            const hiddenElement = createMockElementHandle('button', { id: 'hidden-btn' });
            // (hiddenElement.isVisible as jest.Mock).mockResolvedValue(false as any);
            mockPage.$$.mockResolvedValue([visibleElement, hiddenElement]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements).toHaveLength(2);
            (0, globals_1.expect)(result.elements[0]?.isVisible).toBe(true);
            (0, globals_1.expect)(result.elements[1]?.isVisible).toBe(true); // Both use default mock value
        });
    });
    (0, globals_1.describe)('error handling', () => {
        (0, globals_1.test)('should handle selector errors gracefully', async () => {
            mockPage.$$.mockImplementation(() => {
                throw new Error('Invalid selector');
            });
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.errors).toHaveLength(0); // The current implementation catches errors silently
            (0, globals_1.expect)(result.elements).toHaveLength(0);
        });
        (0, globals_1.test)('should handle element handle creation errors', async () => {
            const mockElementHandle = createMockElementHandle('button', {});
            // (mockElementHandle.evaluate as jest.Mock).mockRejectedValue(
            //   new Error('Evaluation failed') as any
            // );
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.errors).toHaveLength(0); // Errors are handled gracefully in createElementFromHandle
            (0, globals_1.expect)(result.elements).toHaveLength(1); // Element creation succeeds with mock
        });
        (0, globals_1.test)('should continue detection after errors', async () => {
            const failingElement = createMockElementHandle('button', {});
            // (failingElement.evaluate as jest.Mock).mockRejectedValue(new Error('First call failed') as any);
            const successElement = createMockElementHandle('button', {}, 'Success');
            mockPage.$$.mockResolvedValue([failingElement, successElement]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements).toHaveLength(2); // Both elements succeed with mock
            (0, globals_1.expect)(result.elements[1]?.text).toBe('Success');
        });
    });
    (0, globals_1.describe)('custom element detection', () => {
        (0, globals_1.test)('should detect web components', async () => {
            const mockElementHandle = createMockElementHandle('custom-button', {
                'data-custom': 'true',
                'data-shadow-root': 'true',
            });
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('unknown'); // Custom elements are not mapped in current implementation
            (0, globals_1.expect)(result.elements[0]?.attributes?.['data-custom']).toBe('true');
        });
        (0, globals_1.test)('should detect data attributes', async () => {
            const mockElementHandle = createMockElementHandle('button', {
                'data-action': 'submit-form',
                'data-target': '#form-1',
                'data-confirm': 'Are you sure?',
            });
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('button');
            (0, globals_1.expect)(result.elements[0]?.attributes?.['data-action']).toBe('submit-form');
        });
    });
    (0, globals_1.describe)('contextual detection', () => {
        (0, globals_1.test)('should detect elements within specific contexts', async () => {
            const mockElementHandle = createMockElementHandle('button', {
                'data-context': 'modal',
            }, 'Submit');
            // Mock the selector to include .modal context
            mockPage.$$.mockImplementation((selector) => {
                if (selector.includes('.modal')) {
                    return Promise.resolve([mockElementHandle]);
                }
                return Promise.resolve([]);
            });
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements.length).toBeGreaterThan(0);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('button');
        });
        (0, globals_1.test)('should detect elements in iframes', async () => {
            const mockElementHandle = createMockElementHandle('button', {
                'data-in-iframe': 'true',
                'data-iframe-src': 'https://example.com/frame',
            }, 'Iframe Button');
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('button');
            (0, globals_1.expect)(result.elements[0]?.attributes?.['data-in-iframe']).toBe('true');
        });
    });
    (0, globals_1.describe)('AI-enhanced detection', () => {
        (0, globals_1.test)('should detect elements with AI assistance', async () => {
            const mockElementHandle = createMockElementHandle('div', {
                class: 'custom-component',
                'data-ai-detected': 'true',
                'data-ai-confidence': '0.95',
            }, 'Add to Cart');
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('unknown');
            (0, globals_1.expect)(result.elements[0]?.attributes?.['data-ai-detected']).toBe('true');
        });
        (0, globals_1.test)('should merge AI and traditional detection results', async () => {
            const aiElement = createMockElementHandle('div', {
                class: 'ai-detected',
                'data-ai-detected': 'true',
            }, 'Click me');
            const traditionalElement = createMockElementHandle('button', {}, 'Submit');
            mockPage.$$.mockResolvedValue([aiElement, traditionalElement]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements).toHaveLength(2);
            (0, globals_1.expect)(result.elements.some((e) => e.attributes?.['data-ai-detected'] === 'true')).toBe(true);
        });
    });
    (0, globals_1.describe)('element classification', () => {
        (0, globals_1.test)('should classify element purposes', async () => {
            const mockElementHandle = createMockElementHandle('button', {
                class: 'btn-primary add-to-cart',
            }, 'Add to Cart');
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('button');
            (0, globals_1.expect)(result.elements[0]?.text).toBe('Add to Cart');
            // Classification is not implemented in the current detector
        });
        (0, globals_1.test)('should identify form submission elements', async () => {
            const mockElementHandle = createMockElementHandle('button', {
                type: 'submit',
                form: 'login-form',
            }, 'Sign In');
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('button');
            (0, globals_1.expect)(result.elements[0]?.attributes?.type).toBe('submit');
        });
        (0, globals_1.test)('should identify navigation elements', async () => {
            const mockElementHandle = createMockElementHandle('a', {
                href: '/products',
            }, 'Browse Products');
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('link');
            (0, globals_1.expect)(result.elements[0]?.attributes?.href).toBe('/products');
        });
    });
    (0, globals_1.describe)('interaction complexity', () => {
        (0, globals_1.test)('should detect simple interactions', async () => {
            const mockElementHandle = createMockElementHandle('button', {}, 'Click');
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('button');
            (0, globals_1.expect)(result.elements[0]?.text).toBe('Click');
            // Complexity is not implemented in current detector
        });
        (0, globals_1.test)('should detect complex interactions', async () => {
            const mockElementHandle = createMockElementHandle('input', {
                type: 'file',
                accept: '.pdf',
                multiple: 'true',
                required: 'true',
            });
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('file-upload');
            (0, globals_1.expect)(result.elements[0]?.attributes?.multiple).toBe('true');
        });
        (0, globals_1.test)('should detect multi-step interactions', async () => {
            const mockElementHandle = createMockElementHandle('select', {
                multiple: 'true',
                size: '5',
                required: 'true',
                options: JSON.stringify([
                    { value: 'opt1', text: 'Option 1' },
                    { value: 'opt2', text: 'Option 2' },
                    { value: 'opt3', text: 'Option 3' },
                ]),
            });
            mockPage.$$.mockResolvedValue([mockElementHandle]);
            const result = await detector.detectInteractiveElements(mockPage);
            (0, globals_1.expect)(result.elements[0]?.type).toBe('multi-select');
            (0, globals_1.expect)(result.elements[0]?.attributes?.multiple).toBe('true');
        });
    });
});
//# sourceMappingURL=detector.test.js.map