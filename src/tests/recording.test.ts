import { test, expect, describe, beforeEach, vi, MockedFunction } from '@jest/globals';
import { Page } from 'playwright';
import { UserPathRecorder } from '../recording/UserPathRecorder';
import { InteractionResult } from '../types/interactions';
import { UserPath, InteractionStep } from '../types/recording';
import { DetectedElement } from '../types/detector';
import { logger } from '../utils/logger';

vi.mock('../utils/logger');

describe('UserPathRecorder', () => {
  let recorder: UserPathRecorder;
  let mockPage: Partial<Page>;

  beforeEach(() => {
    mockPage = {
      url: vi.fn().mockReturnValue('https://example.com'),
      title: vi.fn().mockResolvedValue('Test Page'),
      screenshot: vi.fn().mockResolvedValue(Buffer.from('screenshot-data')),
      evaluate: vi.fn().mockResolvedValue({}),
      on: vi.fn(),
      off: vi.fn(),
    };

    recorder = new UserPathRecorder();
  });

  describe('initialization', () => {
    test('should initialize with default options', () => {
      expect(recorder).toBeDefined();
    });

    test('should initialize with custom options', () => {
      const customRecorder = new UserPathRecorder({
        captureScreenshots: false,
        trackNetworkRequests: false,
        generateAssertions: false,
        maxSteps: 50,
      });
      expect(customRecorder).toBeDefined();
    });
  });

  describe('recording lifecycle', () => {
    test('should start recording successfully', async () => {
      await recorder.startRecording(mockPage as Page, 'https://example.com/login', 'Login Flow');

      expect(recorder.isRecording()).toBe(true);
      const currentPath = recorder.getCurrentPath();
      expect(currentPath?.startUrl).toBe('https://example.com/login');
      expect(currentPath?.title).toBe('Login Flow');
    });

    test('should not allow starting recording twice', async () => {
      await recorder.startRecording(mockPage as Page, 'https://example.com', 'Test');

      await expect(recorder.startRecording(mockPage as Page, 'https://example.com', 'Test2'))
        .rejects.toThrow('Recording already in progress');
    });

    test('should stop recording and return path', async () => {
      await recorder.startRecording(mockPage as Page, 'https://example.com', 'Test Flow');

      // Add some interaction
      const mockElement: DetectedElement = {
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

      const mockResult: InteractionResult = {
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

      expect(recorder.isRecording()).toBe(false);
      expect(path).toBeDefined();
      expect(path?.steps).toHaveLength(1);
      expect(path?.metadata.totalSteps).toBe(1);
      expect(path?.metadata.totalDuration).toBeGreaterThan(0);
    });

    test('should handle stop recording when not started', async () => {
      await expect(recorder.stopRecording()).rejects.toThrow('No recording in progress');
    });
  });

  describe('interaction recording', () => {
    beforeEach(async () => {
      await recorder.startRecording(mockPage as Page, 'https://example.com', 'Test Recording');
    });

    test('should record successful interaction', async () => {
      const element: DetectedElement = {
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

      const result: InteractionResult = {
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
      expect(currentPath?.steps).toHaveLength(1);
      
      const step = currentPath?.steps[0];
      expect(step?.type).toBe('fill');
      expect(step?.selector).toBe('#username');
      expect(step?.value).toBe('testuser');
      expect(step?.assertion).toBeDefined();
    });

    test('should record failed interaction', async () => {
      const element: DetectedElement = {
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

      const result: InteractionResult = {
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
      expect(currentPath?.steps).toHaveLength(1);
      
      const step = currentPath?.steps[0];
      expect(step?.type).toBe('click');
      expect(step?.success).toBe(false);
      expect(step?.error).toBe('Element not clickable');
    });

    test('should record navigation interaction', async () => {
      const element: DetectedElement = {
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

      const result: InteractionResult = {
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
      
      expect(step?.type).toBe('click');
      expect(step?.navigationOccurred).toBe(true);
      expect(step?.previousUrl).toBe('https://example.com');
      expect(step?.newUrl).toBe('https://example.com/dashboard');
    });

    test('should record interaction without recording', async () => {
      await recorder.stopRecording();

      const element: DetectedElement = {
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

      const result: InteractionResult = {
        success: true,
        action: 'click',
        selector: '#test-btn',
        timing: {
          startTime: new Date(),
          endTime: new Date(),
          duration: 100,
        },
      };

      await expect(recorder.recordInteraction(element, result))
        .rejects.toThrow('No recording in progress');
    });
  });

  describe('screenshot capture', () => {
    beforeEach(async () => {
      await recorder.startRecording(mockPage as Page, 'https://example.com', 'Screenshot Test');
    });

    test('should capture screenshot when enabled', async () => {
      const screenshotRecorder = new UserPathRecorder({
        captureScreenshots: true,
      });

      await screenshotRecorder.startRecording(mockPage as Page, 'https://example.com', 'Test');

      const element: DetectedElement = {
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

      const result: InteractionResult = {
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
      expect(step?.screenshotPath).toBeDefined();
      expect(mockPage.screenshot).toHaveBeenCalled();
    });

    test('should skip screenshot when disabled', async () => {
      const noScreenshotRecorder = new UserPathRecorder({
        captureScreenshots: false,
      });

      await noScreenshotRecorder.startRecording(mockPage as Page, 'https://example.com', 'Test');

      const element: DetectedElement = {
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

      const result: InteractionResult = {
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
      expect(step?.screenshotPath).toBeUndefined();
      expect(mockPage.screenshot).not.toHaveBeenCalled();
    });
  });

  describe('network request tracking', () => {
    test('should track network requests when enabled', async () => {
      const networkRecorder = new UserPathRecorder({
        trackNetworkRequests: true,
      });

      await networkRecorder.startRecording(mockPage as Page, 'https://example.com', 'Network Test');

      // Simulate page events
      const mockRequestHandler = (mockPage.on as MockedFunction<any>).mock.calls
        .find(call => call[0] === 'request')?.[1];
      const mockResponseHandler = (mockPage.on as MockedFunction<any>).mock.calls
        .find(call => call[0] === 'response')?.[1];

      expect(mockRequestHandler).toBeDefined();
      expect(mockResponseHandler).toBeDefined();

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

      const element: DetectedElement = {
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

      const result: InteractionResult = {
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
      expect(step?.networkActivity).toBeDefined();
      expect(step?.networkActivity?.requestCount).toBe(1);
    });
  });

  describe('assertion generation', () => {
    beforeEach(async () => {
      await recorder.startRecording(mockPage as Page, 'https://example.com', 'Assertion Test');
    });

    test('should generate assertions when enabled', async () => {
      const assertionRecorder = new UserPathRecorder({
        generateAssertions: true,
      });

      await assertionRecorder.startRecording(mockPage as Page, 'https://example.com', 'Test');

      const element: DetectedElement = {
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

      const result: InteractionResult = {
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
      expect(step?.assertion).toBeDefined();
      expect(step?.assertion?.type).toBe('value');
      expect(step?.assertion?.expected).toBe('test@example.com');
    });

    test('should generate different assertion types', async () => {
      const testCases = [
        {
          element: {
            id: 'button',
            type: 'button' as const,
            selector: '#submit-btn',
            text: 'Submit',
            attributes: {},
            interactionType: ['click' as const],
            confidence: 0.95,
            position: { x: 10, y: 10, width: 100, height: 30 },
            metadata: {},
          },
          result: {
            success: true,
            action: 'click' as const,
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
            type: 'checkbox' as const,
            selector: '#agree',
            text: 'I agree',
            attributes: {},
            interactionType: ['check' as const],
            confidence: 0.95,
            position: { x: 10, y: 10, width: 20, height: 20 },
            metadata: {},
          },
          result: {
            success: true,
            action: 'check' as const,
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
      expect(path?.steps).toHaveLength(2);
      expect(path?.steps[0].assertion?.type).toBe('navigation');
      expect(path?.steps[1].assertion?.type).toBe('checked');
    });
  });

  describe('path metadata', () => {
    test('should calculate accurate metadata', async () => {
      await recorder.startRecording(mockPage as Page, 'https://example.com', 'Metadata Test');

      // Record multiple interactions with delays
      const interactions = [
        { duration: 500, success: true },
        { duration: 300, success: true },
        { duration: 700, success: false },
        { duration: 200, success: true },
      ];

      for (let i = 0; i < interactions.length; i++) {
        const element: DetectedElement = {
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

        const result: InteractionResult = {
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

      expect(path.metadata.totalSteps).toBe(4);
      expect(path.metadata.totalDuration).toBe(1700); // Sum of all durations
      expect(path.metadata.successfulSteps).toBe(3);
      expect(path.metadata.failedSteps).toBe(1);
      expect(path.metadata.endTime.getTime()).toBeGreaterThan(path.metadata.startTime.getTime());
    });

    test('should include user agent in metadata', async () => {
      (mockPage.evaluate as MockedFunction<any>).mockResolvedValue('TestAgent/1.0');

      await recorder.startRecording(mockPage as Page, 'https://example.com', 'UserAgent Test');
      const path = await recorder.stopRecording();

      expect(path.metadata.userAgent).toBe('TestAgent/1.0');
    });
  });

  describe('path limits', () => {
    test('should respect maximum step limit', async () => {
      const limitedRecorder = new UserPathRecorder({
        maxSteps: 2,
      });

      await limitedRecorder.startRecording(mockPage as Page, 'https://example.com', 'Limited Test');

      // Try to record 3 interactions
      for (let i = 0; i < 3; i++) {
        const element: DetectedElement = {
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

        const result: InteractionResult = {
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
        } else {
          await expect(limitedRecorder.recordInteraction(element, result))
            .rejects.toThrow('Maximum step limit reached');
        }
      }

      const path = limitedRecorder.getCurrentPath();
      expect(path?.steps).toHaveLength(2);
    });
  });

  describe('path persistence', () => {
    test('should save and load paths', async () => {
      await recorder.startRecording(mockPage as Page, 'https://example.com', 'Persistence Test');

      const element: DetectedElement = {
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

      const result: InteractionResult = {
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
      expect(savedPath).toBeDefined();

      // Load path
      const loadedPath = await recorder.loadPath('./test-path.json');
      expect(loadedPath.id).toBe(originalPath.id);
      expect(loadedPath.title).toBe(originalPath.title);
      expect(loadedPath.steps).toHaveLength(originalPath.steps.length);
    });
  });
});