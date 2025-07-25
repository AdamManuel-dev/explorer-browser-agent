import { createTool } from '@mastra/core';
import { z } from 'zod';

const stagehandObserveInputSchema = z.object({
  instruction: z
    .string()
    .optional()
    .describe(
      'Natural language instruction for what to observe (e.g., "Find all login buttons", "Look for form fields")'
    ),
  limit: z.number().optional().describe('Maximum number of elements to return (default: 10)'),
  includeInvisible: z
    .boolean()
    .optional()
    .describe('Whether to include invisible elements (default: false)'),
});

const elementSchema = z.object({
  selector: z.string().describe('CSS selector for the element'),
  description: z.string().describe('AI-generated description of the element'),
  backendNodeId: z.number().optional().describe('Backend node ID if available'),
  method: z.string().optional().describe('Suggested interaction method'),
  arguments: z.array(z.string()).optional().describe('Arguments for the interaction method'),
});

const stagehandObserveOutputSchema = z.object({
  success: z.boolean().describe('Whether the observation was successful'),
  elements: z.array(elementSchema).describe('Array of observed elements'),
  message: z.string().describe('Description of what was observed'),
  error: z.string().optional().describe('Error message if observation failed'),
});

export const stagehandObserveTool = createTool({
  id: 'stagehand-observe',
  description:
    'Observe and find elements on the current web page using AI-powered element detection',
  inputSchema: stagehandObserveInputSchema,
  outputSchema: stagehandObserveOutputSchema,
  execute: async (context, options) => {
    try {
      // Get input data from context.context
      const input = context.context;

      // Get Stagehand instance from context
      const stagehand = context?.stagehand;
      if (!stagehand) {
        return {
          success: false,
          elements: [],
          message: 'Stagehand instance not available in context',
          error: 'No Stagehand instance provided',
        };
      }

      const { instruction, limit = 10, includeInvisible = false } = input;

      // Use Stagehand to observe elements
      const result = await stagehand.observe({
        instruction: instruction || 'Find all interactive elements on the page',
      });

      // Filter and limit results
      let elements = Array.isArray(result) ? result : [];

      // Apply limit
      if (limit > 0) {
        elements = elements.slice(0, limit);
      }

      return {
        success: true,
        elements: elements.map((el) => ({
          selector: el.selector || '',
          description: el.description || 'Element found on page',
          backendNodeId: el.backendNodeId,
          method: el.method,
          arguments: el.arguments,
        })),
        message: `Found ${elements.length} elements${instruction ? ` matching: ${instruction}` : ''}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        elements: [],
        message: 'Failed to observe elements on page',
        error: errorMessage,
      };
    }
  },
});
