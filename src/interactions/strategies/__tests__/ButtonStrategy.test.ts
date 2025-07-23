import { expect, describe, beforeEach, jest } from '@jest/globals';
import { ButtonStrategy } from '../ButtonStrategy';

jest.mock('../../../utils/logger');

describe('ButtonStrategy', () => {
  let strategy: ButtonStrategy;

  beforeEach(() => {
    strategy = new ButtonStrategy();
  });

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(strategy).toBeInstanceOf(ButtonStrategy);
    });
  });

  describe('canHandle', () => {
    it('should return true for button elements', () => {
      const mockElement = {
        tagName: 'button',
        type: 'button',
      } as any;

      const canHandle = strategy.canHandle(mockElement);
      expect(canHandle).toBe(true);
    });

    it('should return true for input buttons', () => {
      const mockElement = {
        tagName: 'input',
        type: 'button',
      } as any;

      const canHandle = strategy.canHandle(mockElement);
      expect(canHandle).toBe(true);
    });

    it('should return false for non-button elements', () => {
      const mockElement = {
        tagName: 'div',
        type: 'text',
      } as any;

      const canHandle = strategy.canHandle(mockElement);
      expect(canHandle).toBe(false);
    });
  });

  describe('execute', () => {
    it('should click button elements', async () => {
      const mockElementHandle = {
        scrollIntoViewIfNeeded: jest.fn<() => Promise<void>>().mockResolvedValue(),
        click: jest.fn<() => Promise<void>>().mockResolvedValue(),
      };

      const mockPage = {
        $: jest.fn<(selector: string) => Promise<any>>().mockResolvedValue(mockElementHandle),
        waitForTimeout: jest.fn<(timeout: number) => Promise<void>>().mockResolvedValue(),
      } as any;

      const mockElement = {
        selector: 'button[type="submit"]',
        type: 'button',
        isEnabled: true,
        isVisible: true,
      } as any;

      const context = {
        page: mockPage,
        testData: {
          value: 'test',
          type: 'click',
          generated: new Date(),
        },
        options: {},
      };

      const result = await strategy.execute(mockElement, context);

      expect(result.success).toBe(true);
      expect(mockPage.$).toHaveBeenCalledWith('button[type="submit"]');
      expect(mockElementHandle.click).toHaveBeenCalled();
    });
  });
});