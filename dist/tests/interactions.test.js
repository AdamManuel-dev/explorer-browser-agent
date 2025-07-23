"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const InteractionExecutor_1 = require("../interactions/InteractionExecutor");
globals_1.jest.mock('../utils/logger');
(0, globals_1.describe)('InteractionExecutor', () => {
    let executor;
    let mockPage;
    let mockLocator;
    (0, globals_1.beforeEach)(() => {
        mockLocator = {
            fill: globals_1.jest.fn().mockResolvedValue(undefined),
            click: globals_1.jest.fn().mockResolvedValue(undefined),
            check: globals_1.jest.fn().mockResolvedValue(undefined),
            uncheck: globals_1.jest.fn().mockResolvedValue(undefined),
            selectOption: globals_1.jest.fn().mockResolvedValue([]),
            setInputFiles: globals_1.jest.fn().mockResolvedValue(undefined),
            press: globals_1.jest.fn().mockResolvedValue(undefined),
            hover: globals_1.jest.fn().mockResolvedValue(undefined),
            dragTo: globals_1.jest.fn().mockResolvedValue(undefined),
            isVisible: globals_1.jest.fn().mockResolvedValue(true),
            isEnabled: globals_1.jest.fn().mockResolvedValue(true),
            textContent: globals_1.jest.fn().mockResolvedValue('Test Content'),
            getAttribute: globals_1.jest.fn().mockResolvedValue('test-value'),
            boundingBox: globals_1.jest.fn().mockResolvedValue({ x: 10, y: 10, width: 100, height: 30 }),
            screenshot: globals_1.jest.fn().mockResolvedValue(Buffer.from('screenshot')),
            waitFor: globals_1.jest.fn().mockResolvedValue(undefined),
        };
        mockPage = {
            locator: globals_1.jest.fn().mockReturnValue(mockLocator),
            url: globals_1.jest.fn().mockReturnValue('https://example.com'),
            screenshot: globals_1.jest.fn().mockResolvedValue(Buffer.from('page-screenshot')),
            waitForTimeout: globals_1.jest.fn().mockResolvedValue(undefined),
            waitForLoadState: globals_1.jest.fn().mockResolvedValue(undefined),
            evaluate: globals_1.jest.fn().mockResolvedValue({}),
        };
        executor = new InteractionExecutor_1.InteractionExecutor();
    });
    (0, globals_1.describe)('initialization', () => {
        (0, globals_1.test)('should initialize with default options', () => {
            (0, globals_1.expect)(executor).toBeDefined();
        });
        (0, globals_1.test)('should initialize with custom options', () => {
            const customExecutor = new InteractionExecutor_1.InteractionExecutor({
                screenshotOnError: false,
                waitForStability: false,
                timeout: 10000,
                retryAttempts: 1,
            });
            (0, globals_1.expect)(customExecutor).toBeDefined();
        });
    });
    (0, globals_1.describe)('input field interactions', () => {
        (0, globals_1.test)('should fill text input successfully', async () => {
            const element = {
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
            const result = await executor.executeInteraction(mockPage, element);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.action).toBe('fill');
            (0, globals_1.expect)(result.value).toBeTruthy();
            (0, globals_1.expect)(mockLocator.fill).toHaveBeenCalled();
        });
        (0, globals_1.test)('should fill email input with valid email', async () => {
            const element = {
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
            const result = await executor.executeInteraction(mockPage, element);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.value).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/); // Basic email regex
        });
        (0, globals_1.test)('should fill password input with secure password', async () => {
            const element = {
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
            const result = await executor.executeInteraction(mockPage, element);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.value?.length).toBeGreaterThanOrEqual(8);
        });
        (0, globals_1.test)('should fill number input with valid number', async () => {
            const element = {
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
            const result = await executor.executeInteraction(mockPage, element);
            (0, globals_1.expect)(result.success).toBe(true);
            const numValue = parseInt(result.value || '0');
            (0, globals_1.expect)(numValue).toBeGreaterThanOrEqual(18);
            (0, globals_1.expect)(numValue).toBeLessThanOrEqual(100);
        });
        (0, globals_1.test)('should fill textarea with longer text', async () => {
            const element = {
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
            const result = await executor.executeInteraction(mockPage, element);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.value?.length).toBeGreaterThan(10);
            (0, globals_1.expect)(mockLocator.fill).toHaveBeenCalled();
        });
    });
    (0, globals_1.describe)('button interactions', () => {
        (0, globals_1.test)('should click button successfully', async () => {
            const element = {
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
            const result = await executor.executeInteraction(mockPage, element);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.action).toBe('click');
            (0, globals_1.expect)(mockLocator.click).toHaveBeenCalled();
        });
        (0, globals_1.test)('should handle navigation after button click', async () => {
            const element = {
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
            mockPage.url
                .mockReturnValueOnce('https://example.com/current')
                .mockReturnValueOnce('https://example.com/dashboard');
            const result = await executor.executeInteraction(mockPage, element);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.navigationOccurred).toBe(true);
            (0, globals_1.expect)(result.timing?.duration).toBeGreaterThan(0);
        });
    });
    (0, globals_1.describe)('checkbox and radio interactions', () => {
        (0, globals_1.test)('should check checkbox', async () => {
            const element = {
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
            const result = await executor.executeInteraction(mockPage, element);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.action).toBe('check');
            (0, globals_1.expect)(mockLocator.check).toHaveBeenCalled();
        });
        (0, globals_1.test)('should uncheck already checked checkbox', async () => {
            const element = {
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
            const result = await executor.executeInteraction(mockPage, element);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(mockLocator.uncheck).toHaveBeenCalled();
        });
        (0, globals_1.test)('should select radio button', async () => {
            const element = {
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
            const result = await executor.executeInteraction(mockPage, element);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.action).toBe('check');
            (0, globals_1.expect)(mockLocator.click).toHaveBeenCalled();
        });
    });
    (0, globals_1.describe)('select dropdown interactions', () => {
        (0, globals_1.test)('should select option from dropdown', async () => {
            const element = {
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
            const result = await executor.executeInteraction(mockPage, element);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.action).toBe('select');
            (0, globals_1.expect)(['US', 'UK', 'CA', 'AU']).toContain(result.value);
            (0, globals_1.expect)(mockLocator.selectOption).toHaveBeenCalled();
        });
        (0, globals_1.test)('should handle select without predefined options', async () => {
            const element = {
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
            mockPage.evaluate.mockResolvedValue(['Option 1', 'Option 2', 'Option 3']);
            const result = await executor.executeInteraction(mockPage, element);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(mockPage.evaluate).toHaveBeenCalled();
        });
    });
    (0, globals_1.describe)('link interactions', () => {
        (0, globals_1.test)('should click link successfully', async () => {
            const element = {
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
            const result = await executor.executeInteraction(mockPage, element);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.action).toBe('click');
            (0, globals_1.expect)(mockLocator.click).toHaveBeenCalled();
        });
        (0, globals_1.test)('should handle external link clicks', async () => {
            const element = {
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
            const result = await executor.executeInteraction(mockPage, element);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.metadata?.externalLink).toBe(true);
        });
    });
    (0, globals_1.describe)('file upload interactions', () => {
        (0, globals_1.test)('should upload file successfully', async () => {
            const element = {
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
            const result = await executor.executeInteraction(mockPage, element);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.action).toBe('upload');
            (0, globals_1.expect)(result.value).toMatch(/\.(pdf|doc|docx|txt|jpg|png)$/);
            (0, globals_1.expect)(mockLocator.setInputFiles).toHaveBeenCalled();
        });
        (0, globals_1.test)('should handle multiple file upload', async () => {
            const element = {
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
            const result = await executor.executeInteraction(mockPage, element);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(Array.isArray(result.value)).toBe(true);
        });
    });
    (0, globals_1.describe)('hover interactions', () => {
        (0, globals_1.test)('should hover over element', async () => {
            const element = {
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
            const result = await executor.executeInteraction(mockPage, element);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.action).toBe('hover');
            (0, globals_1.expect)(mockLocator.hover).toHaveBeenCalled();
        });
    });
    (0, globals_1.describe)('error handling', () => {
        (0, globals_1.test)('should handle element not found errors', async () => {
            const element = {
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
            mockPage.locator.mockImplementation(() => {
                throw new Error('Element not found');
            });
            const result = await executor.executeInteraction(mockPage, element);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.error).toContain('Element not found');
            (0, globals_1.expect)(result.screenshotPath).toBeDefined();
        });
        (0, globals_1.test)('should handle interaction timeout errors', async () => {
            const element = {
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
            mockLocator.click.mockRejectedValue(new Error('Timeout'));
            const result = await executor.executeInteraction(mockPage, element);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.error).toContain('Timeout');
        });
        (0, globals_1.test)('should retry failed interactions', async () => {
            const element = {
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
            mockLocator.click.mockImplementation(() => {
                attemptCount++;
                if (attemptCount === 1) {
                    throw new Error('Temporary failure');
                }
                return Promise.resolve();
            });
            const customExecutor = new InteractionExecutor_1.InteractionExecutor({
                retryAttempts: 2,
                retryDelay: 100,
            });
            const result = await customExecutor.executeInteraction(mockPage, element);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(attemptCount).toBe(2);
        });
        (0, globals_1.test)('should handle disabled elements', async () => {
            const element = {
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
            mockLocator.isEnabled.mockResolvedValue(false);
            const result = await executor.executeInteraction(mockPage, element);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.error).toContain('disabled');
        });
        (0, globals_1.test)('should handle hidden elements', async () => {
            const element = {
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
            mockLocator.isVisible.mockResolvedValue(false);
            const result = await executor.executeInteraction(mockPage, element);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.error).toContain('not visible');
        });
    });
    (0, globals_1.describe)('state tracking', () => {
        (0, globals_1.test)('should track network activity during interaction', async () => {
            const element = {
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
            const result = await executor.executeInteraction(mockPage, element);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.metadata?.networkActivity).toBeDefined();
        });
        (0, globals_1.test)('should capture screenshots on success when enabled', async () => {
            const element = {
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
            const customExecutor = new InteractionExecutor_1.InteractionExecutor({
                screenshotOnSuccess: true,
            });
            const result = await customExecutor.executeInteraction(mockPage, element);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.screenshotPath).toBeDefined();
        });
        (0, globals_1.test)('should wait for element stability', async () => {
            const element = {
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
            const customExecutor = new InteractionExecutor_1.InteractionExecutor({
                waitForStability: true,
                stabilityTimeout: 1000,
            });
            const result = await customExecutor.executeInteraction(mockPage, element);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(mockLocator.waitFor).toHaveBeenCalledWith({
                state: 'stable',
                timeout: 1000,
            });
        });
    });
    (0, globals_1.describe)('batch interactions', () => {
        (0, globals_1.test)('should execute multiple interactions in sequence', async () => {
            const elements = [
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
            const results = await executor.executeInteractions(mockPage, elements);
            (0, globals_1.expect)(results).toHaveLength(3);
            (0, globals_1.expect)(results.every((r) => r.success)).toBe(true);
            (0, globals_1.expect)(results[0].action).toBe('fill');
            (0, globals_1.expect)(results[1].action).toBe('fill');
            (0, globals_1.expect)(results[2].action).toBe('click');
        });
        (0, globals_1.test)('should handle partial failures in batch execution', async () => {
            const elements = [
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
            mockLocator.click.mockImplementation(() => {
                clickCount++;
                if (clickCount === 2) {
                    throw new Error('Second click failed');
                }
                return Promise.resolve();
            });
            const results = await executor.executeInteractions(mockPage, elements);
            (0, globals_1.expect)(results).toHaveLength(2);
            (0, globals_1.expect)(results[0].success).toBe(true);
            (0, globals_1.expect)(results[1].success).toBe(false);
        });
    });
});
//# sourceMappingURL=interactions.test.js.map