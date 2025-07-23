"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const UserPathRecorder_1 = require("../recording/UserPathRecorder");
globals_1.jest.mock('../utils/logger');
(0, globals_1.describe)('UserPathRecorder', () => {
    let recorder;
    let mockPage;
    (0, globals_1.beforeEach)(() => {
        mockPage = {
            url: globals_1.jest.fn().mockReturnValue('https://example.com'),
            title: globals_1.jest.fn().mockResolvedValue('Test Page'),
            screenshot: globals_1.jest.fn().mockResolvedValue(Buffer.from('screenshot-data')),
            evaluate: globals_1.jest.fn().mockResolvedValue({}),
            on: globals_1.jest.fn(),
            off: globals_1.jest.fn(),
        };
        recorder = new UserPathRecorder_1.UserPathRecorder();
    });
    (0, globals_1.describe)('initialization', () => {
        (0, globals_1.test)('should initialize with default options', () => {
            (0, globals_1.expect)(recorder).toBeDefined();
        });
        (0, globals_1.test)('should initialize with custom options', () => {
            const customRecorder = new UserPathRecorder_1.UserPathRecorder({
                captureScreenshots: false,
                trackNetworkRequests: false,
                generateAssertions: false,
                maxSteps: 50,
            });
            (0, globals_1.expect)(customRecorder).toBeDefined();
        });
    });
    (0, globals_1.describe)('recording lifecycle', () => {
        (0, globals_1.test)('should start recording successfully', async () => {
            await recorder.startRecording(mockPage, 'https://example.com/login', 'Login Flow');
            (0, globals_1.expect)(recorder.isRecording()).toBe(true);
            const currentPath = recorder.getCurrentPath();
            (0, globals_1.expect)(currentPath?.startUrl).toBe('https://example.com/login');
            (0, globals_1.expect)(currentPath?.title).toBe('Login Flow');
        });
        (0, globals_1.test)('should not allow starting recording twice', async () => {
            await recorder.startRecording(mockPage, 'https://example.com', 'Test');
            await (0, globals_1.expect)(recorder.startRecording(mockPage, 'https://example.com', 'Test2')).rejects.toThrow('Recording already in progress');
        });
        (0, globals_1.test)('should stop recording and return path', async () => {
            await recorder.startRecording(mockPage, 'https://example.com', 'Test Flow');
            // Add some interaction
            const mockElement = {
                id: 'test-element',
                type: 'button',
                selector: '#test-btn',
                text: 'Test Button',
                attributes: {},
                interactionType: ['click'],
                confidence: 0.95,
                position: { x: 10, y: 10, width: 100, height: 30 },
                metadata: {},
            };
            const mockResult = {
                success: true,
                action: 'click',
                selector: '#test-btn',
                timing: {
                    startTime: new Date(),
                    endTime: new Date(Date.now() + 200),
                    duration: 200,
                },
                screenshotPath: './screenshots/test.png',
            };
            await recorder.recordInteraction(mockElement, mockResult);
            const path = await recorder.stopRecording();
            (0, globals_1.expect)(recorder.isRecording()).toBe(false);
            (0, globals_1.expect)(path).toBeDefined();
            (0, globals_1.expect)(path?.steps).toHaveLength(1);
            (0, globals_1.expect)(path?.metadata.totalSteps).toBe(1);
            (0, globals_1.expect)(path?.metadata.totalDuration).toBeGreaterThan(0);
        });
        (0, globals_1.test)('should handle stop recording when not started', async () => {
            await (0, globals_1.expect)(recorder.stopRecording()).rejects.toThrow('No recording in progress');
        });
    });
    (0, globals_1.describe)('interaction recording', () => {
        (0, globals_1.beforeEach)(async () => {
            await recorder.startRecording(mockPage, 'https://example.com', 'Test Recording');
        });
        (0, globals_1.test)('should record successful interaction', async () => {
            const element = {
                id: 'username-input',
                type: 'input',
                selector: '#username',
                text: '',
                attributes: {
                    inputType: 'text',
                    name: 'username',
                },
                interactionType: ['fill'],
                confidence: 0.95,
                position: { x: 10, y: 10, width: 200, height: 30 },
                metadata: {},
            };
            const result = {
                success: true,
                action: 'fill',
                selector: '#username',
                value: 'testuser',
                timing: {
                    startTime: new Date(),
                    endTime: new Date(Date.now() + 500),
                    duration: 500,
                },
                screenshotPath: './screenshots/fill-username.png',
                assertion: {
                    type: 'value',
                    expected: 'testuser',
                    actual: 'testuser',
                },
            };
            await recorder.recordInteraction(element, result);
            const currentPath = recorder.getCurrentPath();
            (0, globals_1.expect)(currentPath?.steps).toHaveLength(1);
            const step = currentPath?.steps[0];
            (0, globals_1.expect)(step?.type).toBe('fill');
            (0, globals_1.expect)(step?.selector).toBe('#username');
            (0, globals_1.expect)(step?.value).toBe('testuser');
            (0, globals_1.expect)(step?.assertion).toBeDefined();
        });
        (0, globals_1.test)('should record failed interaction', async () => {
            const element = {
                id: 'broken-button',
                type: 'button',
                selector: '#broken-btn',
                text: 'Broken Button',
                attributes: {},
                interactionType: ['click'],
                confidence: 0.95,
                position: { x: 10, y: 10, width: 100, height: 30 },
                metadata: {},
            };
            const result = {
                success: false,
                action: 'click',
                selector: '#broken-btn',
                error: 'Element not clickable',
                timing: {
                    startTime: new Date(),
                    endTime: new Date(Date.now() + 1000),
                    duration: 1000,
                },
                screenshotPath: './screenshots/error-click.png',
            };
            await recorder.recordInteraction(element, result);
            const currentPath = recorder.getCurrentPath();
            (0, globals_1.expect)(currentPath?.steps).toHaveLength(1);
            const step = currentPath?.steps[0];
            (0, globals_1.expect)(step?.type).toBe('click');
            (0, globals_1.expect)(step?.success).toBe(false);
            (0, globals_1.expect)(step?.error).toBe('Element not clickable');
        });
        (0, globals_1.test)('should record navigation interaction', async () => {
            const element = {
                id: 'nav-link',
                type: 'link',
                selector: 'a[href="/dashboard"]',
                text: 'Dashboard',
                attributes: {
                    href: '/dashboard',
                },
                interactionType: ['click'],
                confidence: 0.95,
                position: { x: 10, y: 10, width: 100, height: 20 },
                metadata: {},
            };
            const result = {
                success: true,
                action: 'click',
                selector: 'a[href="/dashboard"]',
                navigationOccurred: true,
                previousUrl: 'https://example.com',
                newUrl: 'https://example.com/dashboard',
                timing: {
                    startTime: new Date(),
                    endTime: new Date(Date.now() + 800),
                    duration: 800,
                },
                assertion: {
                    type: 'navigation',
                    expected: 'https://example.com/dashboard',
                    actual: 'https://example.com/dashboard',
                },
            };
            await recorder.recordInteraction(element, result);
            const currentPath = recorder.getCurrentPath();
            const step = currentPath?.steps[0];
            (0, globals_1.expect)(step?.type).toBe('click');
            (0, globals_1.expect)(step?.navigationOccurred).toBe(true);
            (0, globals_1.expect)(step?.previousUrl).toBe('https://example.com');
            (0, globals_1.expect)(step?.newUrl).toBe('https://example.com/dashboard');
        });
        (0, globals_1.test)('should record interaction without recording', async () => {
            await recorder.stopRecording();
            const element = {
                id: 'test-element',
                type: 'button',
                selector: '#test-btn',
                text: 'Test',
                attributes: {},
                interactionType: ['click'],
                confidence: 0.95,
                position: { x: 10, y: 10, width: 100, height: 30 },
                metadata: {},
            };
            const result = {
                success: true,
                action: 'click',
                selector: '#test-btn',
                timing: {
                    startTime: new Date(),
                    endTime: new Date(),
                    duration: 100,
                },
            };
            await (0, globals_1.expect)(recorder.recordInteraction(element, result)).rejects.toThrow('No recording in progress');
        });
    });
    (0, globals_1.describe)('screenshot capture', () => {
        (0, globals_1.beforeEach)(async () => {
            await recorder.startRecording(mockPage, 'https://example.com', 'Screenshot Test');
        });
        (0, globals_1.test)('should capture screenshot when enabled', async () => {
            const screenshotRecorder = new UserPathRecorder_1.UserPathRecorder({
                captureScreenshots: true,
            });
            await screenshotRecorder.startRecording(mockPage, 'https://example.com', 'Test');
            const element = {
                id: 'test-element',
                type: 'button',
                selector: '#test-btn',
                text: 'Test',
                attributes: {},
                interactionType: ['click'],
                confidence: 0.95,
                position: { x: 10, y: 10, width: 100, height: 30 },
                metadata: {},
            };
            const result = {
                success: true,
                action: 'click',
                selector: '#test-btn',
                timing: {
                    startTime: new Date(),
                    endTime: new Date(),
                    duration: 100,
                },
            };
            await screenshotRecorder.recordInteraction(element, result);
            const path = screenshotRecorder.getCurrentPath();
            const step = path?.steps[0];
            (0, globals_1.expect)(step?.screenshotPath).toBeDefined();
            (0, globals_1.expect)(mockPage.screenshot).toHaveBeenCalled();
        });
        (0, globals_1.test)('should skip screenshot when disabled', async () => {
            const noScreenshotRecorder = new UserPathRecorder_1.UserPathRecorder({
                captureScreenshots: false,
            });
            await noScreenshotRecorder.startRecording(mockPage, 'https://example.com', 'Test');
            const element = {
                id: 'test-element',
                type: 'button',
                selector: '#test-btn',
                text: 'Test',
                attributes: {},
                interactionType: ['click'],
                confidence: 0.95,
                position: { x: 10, y: 10, width: 100, height: 30 },
                metadata: {},
            };
            const result = {
                success: true,
                action: 'click',
                selector: '#test-btn',
                timing: {
                    startTime: new Date(),
                    endTime: new Date(),
                    duration: 100,
                },
            };
            await noScreenshotRecorder.recordInteraction(element, result);
            const path = noScreenshotRecorder.getCurrentPath();
            const step = path?.steps[0];
            (0, globals_1.expect)(step?.screenshotPath).toBeUndefined();
            (0, globals_1.expect)(mockPage.screenshot).not.toHaveBeenCalled();
        });
    });
    (0, globals_1.describe)('network request tracking', () => {
        (0, globals_1.test)('should track network requests when enabled', async () => {
            const networkRecorder = new UserPathRecorder_1.UserPathRecorder({
                trackNetworkRequests: true,
            });
            await networkRecorder.startRecording(mockPage, 'https://example.com', 'Network Test');
            // Simulate page events
            const mockRequestHandler = mockPage.on.mock.calls.find((call) => call[0] === 'request')?.[1];
            const mockResponseHandler = mockPage.on.mock.calls.find((call) => call[0] === 'response')?.[1];
            (0, globals_1.expect)(mockRequestHandler).toBeDefined();
            (0, globals_1.expect)(mockResponseHandler).toBeDefined();
            // Simulate request/response
            if (mockRequestHandler && mockResponseHandler) {
                const mockRequest = {
                    url: () => 'https://api.example.com/data',
                    method: () => 'GET',
                    headers: () => ({ 'Content-Type': 'application/json' }),
                };
                const mockResponse = {
                    url: () => 'https://api.example.com/data',
                    status: () => 200,
                    headers: () => ({ 'Content-Type': 'application/json' }),
                };
                mockRequestHandler(mockRequest);
                mockResponseHandler(mockResponse);
            }
            const element = {
                id: 'api-button',
                type: 'button',
                selector: '#api-btn',
                text: 'Load Data',
                attributes: {},
                interactionType: ['click'],
                confidence: 0.95,
                position: { x: 10, y: 10, width: 100, height: 30 },
                metadata: {},
            };
            const result = {
                success: true,
                action: 'click',
                selector: '#api-btn',
                timing: {
                    startTime: new Date(),
                    endTime: new Date(),
                    duration: 500,
                },
                metadata: {
                    networkActivity: {
                        requestCount: 1,
                        requests: [
                            {
                                url: 'https://api.example.com/data',
                                method: 'GET',
                                status: 200,
                            },
                        ],
                    },
                },
            };
            await networkRecorder.recordInteraction(element, result);
            const path = networkRecorder.getCurrentPath();
            const step = path?.steps[0];
            (0, globals_1.expect)(step?.networkActivity).toBeDefined();
            (0, globals_1.expect)(step?.networkActivity?.requestCount).toBe(1);
        });
    });
    (0, globals_1.describe)('assertion generation', () => {
        (0, globals_1.beforeEach)(async () => {
            await recorder.startRecording(mockPage, 'https://example.com', 'Assertion Test');
        });
        (0, globals_1.test)('should generate assertions when enabled', async () => {
            const assertionRecorder = new UserPathRecorder_1.UserPathRecorder({
                generateAssertions: true,
            });
            await assertionRecorder.startRecording(mockPage, 'https://example.com', 'Test');
            const element = {
                id: 'form-input',
                type: 'input',
                selector: '#email',
                text: '',
                attributes: {
                    inputType: 'email',
                },
                interactionType: ['fill'],
                confidence: 0.95,
                position: { x: 10, y: 10, width: 200, height: 30 },
                metadata: {},
            };
            const result = {
                success: true,
                action: 'fill',
                selector: '#email',
                value: 'test@example.com',
                timing: {
                    startTime: new Date(),
                    endTime: new Date(),
                    duration: 300,
                },
            };
            await assertionRecorder.recordInteraction(element, result);
            const path = assertionRecorder.getCurrentPath();
            const step = path?.steps[0];
            (0, globals_1.expect)(step?.assertion).toBeDefined();
            (0, globals_1.expect)(step?.assertion?.type).toBe('value');
            (0, globals_1.expect)(step?.assertion?.expected).toBe('test@example.com');
        });
        (0, globals_1.test)('should generate different assertion types', async () => {
            const testCases = [
                {
                    element: {
                        id: 'button',
                        type: 'button',
                        selector: '#submit-btn',
                        text: 'Submit',
                        attributes: {},
                        interactionType: ['click'],
                        confidence: 0.95,
                        position: { x: 10, y: 10, width: 100, height: 30 },
                        metadata: {},
                    },
                    result: {
                        success: true,
                        action: 'click',
                        selector: '#submit-btn',
                        navigationOccurred: true,
                        newUrl: 'https://example.com/success',
                        timing: {
                            startTime: new Date(),
                            endTime: new Date(),
                            duration: 200,
                        },
                    },
                },
                {
                    element: {
                        id: 'checkbox',
                        type: 'checkbox',
                        selector: '#agree',
                        text: 'I agree',
                        attributes: {},
                        interactionType: ['check'],
                        confidence: 0.95,
                        position: { x: 10, y: 10, width: 20, height: 20 },
                        metadata: {},
                    },
                    result: {
                        success: true,
                        action: 'check',
                        selector: '#agree',
                        timing: {
                            startTime: new Date(),
                            endTime: new Date(),
                            duration: 100,
                        },
                    },
                },
            ];
            for (const testCase of testCases) {
                await recorder.recordInteraction(testCase.element, testCase.result);
            }
            const path = recorder.getCurrentPath();
            (0, globals_1.expect)(path?.steps).toHaveLength(2);
            (0, globals_1.expect)(path?.steps[0].assertion?.type).toBe('navigation');
            (0, globals_1.expect)(path?.steps[1].assertion?.type).toBe('checked');
        });
    });
    (0, globals_1.describe)('path metadata', () => {
        (0, globals_1.test)('should calculate accurate metadata', async () => {
            await recorder.startRecording(mockPage, 'https://example.com', 'Metadata Test');
            // Record multiple interactions with delays
            const interactions = [
                { duration: 500, success: true },
                { duration: 300, success: true },
                { duration: 700, success: false },
                { duration: 200, success: true },
            ];
            for (let i = 0; i < interactions.length; i++) {
                const element = {
                    id: `element-${i}`,
                    type: 'button',
                    selector: `#btn-${i}`,
                    text: `Button ${i}`,
                    attributes: {},
                    interactionType: ['click'],
                    confidence: 0.95,
                    position: { x: 10, y: 10, width: 100, height: 30 },
                    metadata: {},
                };
                const result = {
                    success: interactions[i].success,
                    action: 'click',
                    selector: `#btn-${i}`,
                    timing: {
                        startTime: new Date(),
                        endTime: new Date(Date.now() + interactions[i].duration),
                        duration: interactions[i].duration,
                    },
                };
                if (!interactions[i].success) {
                    result.error = 'Interaction failed';
                }
                await recorder.recordInteraction(element, result);
            }
            const path = await recorder.stopRecording();
            (0, globals_1.expect)(path.metadata.totalSteps).toBe(4);
            (0, globals_1.expect)(path.metadata.totalDuration).toBe(1700); // Sum of all durations
            (0, globals_1.expect)(path.metadata.successfulSteps).toBe(3);
            (0, globals_1.expect)(path.metadata.failedSteps).toBe(1);
            (0, globals_1.expect)(path.metadata.endTime.getTime()).toBeGreaterThan(path.metadata.startTime.getTime());
        });
        (0, globals_1.test)('should include user agent in metadata', async () => {
            mockPage.evaluate.mockResolvedValue('TestAgent/1.0');
            await recorder.startRecording(mockPage, 'https://example.com', 'UserAgent Test');
            const path = await recorder.stopRecording();
            (0, globals_1.expect)(path.metadata.userAgent).toBe('TestAgent/1.0');
        });
    });
    (0, globals_1.describe)('path limits', () => {
        (0, globals_1.test)('should respect maximum step limit', async () => {
            const limitedRecorder = new UserPathRecorder_1.UserPathRecorder({
                maxSteps: 2,
            });
            await limitedRecorder.startRecording(mockPage, 'https://example.com', 'Limited Test');
            // Try to record 3 interactions
            for (let i = 0; i < 3; i++) {
                const element = {
                    id: `element-${i}`,
                    type: 'button',
                    selector: `#btn-${i}`,
                    text: `Button ${i}`,
                    attributes: {},
                    interactionType: ['click'],
                    confidence: 0.95,
                    position: { x: 10, y: 10, width: 100, height: 30 },
                    metadata: {},
                };
                const result = {
                    success: true,
                    action: 'click',
                    selector: `#btn-${i}`,
                    timing: {
                        startTime: new Date(),
                        endTime: new Date(),
                        duration: 100,
                    },
                };
                if (i < 2) {
                    await limitedRecorder.recordInteraction(element, result);
                }
                else {
                    await (0, globals_1.expect)(limitedRecorder.recordInteraction(element, result)).rejects.toThrow('Maximum step limit reached');
                }
            }
            const path = limitedRecorder.getCurrentPath();
            (0, globals_1.expect)(path?.steps).toHaveLength(2);
        });
    });
    (0, globals_1.describe)('path persistence', () => {
        (0, globals_1.test)('should save and load paths', async () => {
            await recorder.startRecording(mockPage, 'https://example.com', 'Persistence Test');
            const element = {
                id: 'test-element',
                type: 'button',
                selector: '#test-btn',
                text: 'Test',
                attributes: {},
                interactionType: ['click'],
                confidence: 0.95,
                position: { x: 10, y: 10, width: 100, height: 30 },
                metadata: {},
            };
            const result = {
                success: true,
                action: 'click',
                selector: '#test-btn',
                timing: {
                    startTime: new Date(),
                    endTime: new Date(),
                    duration: 100,
                },
            };
            await recorder.recordInteraction(element, result);
            const originalPath = await recorder.stopRecording();
            // Save path
            const savedPath = await recorder.savePath(originalPath, './test-path.json');
            (0, globals_1.expect)(savedPath).toBeDefined();
            // Load path
            const loadedPath = await recorder.loadPath('./test-path.json');
            (0, globals_1.expect)(loadedPath.id).toBe(originalPath.id);
            (0, globals_1.expect)(loadedPath.title).toBe(originalPath.title);
            (0, globals_1.expect)(loadedPath.steps).toHaveLength(originalPath.steps.length);
        });
    });
});
//# sourceMappingURL=recording.test.js.map