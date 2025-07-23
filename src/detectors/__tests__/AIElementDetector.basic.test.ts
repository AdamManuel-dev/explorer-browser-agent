import { test, expect, describe, beforeEach, jest } from '@jest/globals';
import { AIElementDetector } from '../AIElementDetector';

jest.mock('../../utils/logger');

describe('AIElementDetector Basic Tests', () => {
  let detector: AIElementDetector;

  beforeEach(() => {
    detector = new AIElementDetector({
      enableAI: false,
      enableTraditional: true,
      timeout: 5000,
      retryAttempts: 3,
    });
  });

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(detector).toBeInstanceOf(AIElementDetector);
    });
  });

  describe('basic functionality', () => {
    it('should have detectElements method', () => {
      expect(typeof detector.detectElements).toBe('function');
    });

    it('should handle empty page', async () => {
      const mockPage = {
        $: jest.fn().mockResolvedValue(null),
        $$: jest.fn().mockResolvedValue([]),
        evaluate: jest.fn().mockResolvedValue([]),
      } as any;

      const result = await detector.detectElements(mockPage);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});