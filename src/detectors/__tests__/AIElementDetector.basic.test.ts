import { test, expect, describe, beforeEach, jest } from '@jest/globals';
import { AIElementDetector } from '../AIElementDetector';

jest.mock('../../utils/logger');

describe('AIElementDetector Basic Tests', () => {
  let detector: AIElementDetector;

  beforeEach(() => {
    detector = new AIElementDetector();
  });

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(detector).toBeInstanceOf(AIElementDetector);
    });
  });

  describe('basic functionality', () => {
    it('should have detectInteractiveElements method', () => {
      expect(typeof detector.detectInteractiveElements).toBe('function');
    });

    it('should handle empty page', async () => {
      const mockPage = {
        $: jest.fn<() => Promise<null>>().mockResolvedValue(null),
        $$: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
        evaluate: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
      } as any;

      const result = await detector.detectInteractiveElements(mockPage);
      expect(result).toHaveProperty('elements');
      expect(Array.isArray(result.elements)).toBe(true);
    });
  });
});
