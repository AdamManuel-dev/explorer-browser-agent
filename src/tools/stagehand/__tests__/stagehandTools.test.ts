import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  stagehandActTool,
  stagehandObserveTool,
  stagehandExtractTool,
  stagehandTools,
  toolMetadata,
} from '../index';

describe('Stagehand Tools', () => {
  describe('Tool Exports', () => {
    it('should export individual tools', () => {
      expect(stagehandActTool).toBeDefined();
      expect(stagehandObserveTool).toBeDefined();
      expect(stagehandExtractTool).toBeDefined();
    });

    it('should export tools collection', () => {
      expect(stagehandTools).toBeDefined();
      expect(stagehandTools.stagehandActTool).toBe(stagehandActTool);
      expect(stagehandTools.stagehandObserveTool).toBe(stagehandObserveTool);
      expect(stagehandTools.stagehandExtractTool).toBe(stagehandExtractTool);
    });

    it('should export tool metadata', () => {
      expect(toolMetadata).toBeDefined();
      expect(toolMetadata.stagehandActTool).toBeDefined();
      expect(toolMetadata.stagehandObserveTool).toBeDefined();
      expect(toolMetadata.stagehandExtractTool).toBeDefined();
    });
  });

  describe('Tool Structure', () => {
    it('stagehandActTool should have correct structure', () => {
      expect(stagehandActTool.id).toBe('stagehand-act');
      expect(stagehandActTool.description).toBeDefined();
      expect(typeof stagehandActTool.execute).toBe('function');
      expect(stagehandActTool.inputSchema).toBeDefined();
      expect(stagehandActTool.outputSchema).toBeDefined();
    });

    it('stagehandObserveTool should have correct structure', () => {
      expect(stagehandObserveTool.id).toBe('stagehand-observe');
      expect(stagehandObserveTool.description).toBeDefined();
      expect(typeof stagehandObserveTool.execute).toBe('function');
      expect(stagehandObserveTool.inputSchema).toBeDefined();
      expect(stagehandObserveTool.outputSchema).toBeDefined();
    });

    it('stagehandExtractTool should have correct structure', () => {
      expect(stagehandExtractTool.id).toBe('stagehand-extract');
      expect(stagehandExtractTool.description).toBeDefined();
      expect(typeof stagehandExtractTool.execute).toBe('function');
      expect(stagehandExtractTool.inputSchema).toBeDefined();
      expect(stagehandExtractTool.outputSchema).toBeDefined();
    });
  });

  describe('Tool Functionality', () => {
    it('tools should have execution functions', () => {
      expect(typeof stagehandActTool.execute).toBe('function');
      expect(typeof stagehandObserveTool.execute).toBe('function');
      expect(typeof stagehandExtractTool.execute).toBe('function');
    });

    it('tools should be available in collection', () => {
      expect(Object.keys(stagehandTools)).toHaveLength(3);
      expect(stagehandTools.stagehandActTool.id).toBe('stagehand-act');
      expect(stagehandTools.stagehandObserveTool.id).toBe('stagehand-observe');
      expect(stagehandTools.stagehandExtractTool.id).toBe('stagehand-extract');
    });

    it('tools should have proper descriptions for AI agents', () => {
      expect(stagehandActTool.description).toContain('action');
      expect(stagehandActTool.description).toContain('Click');
      
      expect(stagehandObserveTool.description).toContain('elements');
      expect(stagehandObserveTool.description).toContain('Find');
      
      expect(stagehandExtractTool.description).toContain('Extract');
      expect(stagehandExtractTool.description).toContain('data');
    });
  });

  describe('Input Validation', () => {
    it('should validate act tool input schema', () => {
      const validInput = {
        action: 'Click the submit button',
        timeout: 30000,
      };

      const parseResult = stagehandActTool.inputSchema.safeParse(validInput);
      expect(parseResult.success).toBe(true);
    });

    it('should validate observe tool input schema', () => {
      const validInput = {
        instruction: 'Find all form inputs',
        limit: 10,
        includeHidden: false,
      };

      const parseResult = stagehandObserveTool.inputSchema.safeParse(validInput);
      expect(parseResult.success).toBe(true);
    });

    it('should validate extract tool input schema', () => {
      const validInput = {
        instruction: 'Extract product details',
        format: 'json' as const,
      };

      const parseResult = stagehandExtractTool.inputSchema.safeParse(validInput);
      expect(parseResult.success).toBe(true);
    });

    it('should reject invalid input', () => {
      const invalidInput = {
        // Missing required 'action' field
        timeout: 30000,
      };

      const parseResult = stagehandActTool.inputSchema.safeParse(invalidInput);
      expect(parseResult.success).toBe(false);
    });
  });

  describe('Tool Metadata', () => {
    it('should have correct metadata for each tool', () => {
      expect(toolMetadata.stagehandActTool.category).toBe('web-automation');
      expect(toolMetadata.stagehandActTool.complexity).toBe('medium');
      expect(toolMetadata.stagehandActTool.rateLimit).toBeDefined();
      expect(toolMetadata.stagehandActTool.requiredCapabilities).toContain('browser');
      expect(toolMetadata.stagehandActTool.requiredCapabilities).toContain('stagehand');

      expect(toolMetadata.stagehandObserveTool.category).toBe('web-analysis');
      expect(toolMetadata.stagehandObserveTool.complexity).toBe('low');

      expect(toolMetadata.stagehandExtractTool.category).toBe('data-extraction');
      expect(toolMetadata.stagehandExtractTool.complexity).toBe('medium');
    });
  });
});