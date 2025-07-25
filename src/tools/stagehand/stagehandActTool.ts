import { createTool } from '@mastra/core';
import { z } from 'zod';

const stagehandActInputSchema = z.object({
  action: z
    .string()
    .describe(
      'Natural language description of the action to perform (e.g., "Click the login button", "Fill in the email field with test@example.com")'
    ),
  waitForElement: z
    .boolean()
    .optional()
    .describe('Whether to wait for element to be visible before acting'),
  timeout: z.number().optional().describe('Timeout in milliseconds (default: 30000)'),
  takeScreenshot: z.boolean().optional().describe('Whether to take a screenshot after the action'),
});

const stagehandActOutputSchema = z.object({
  success: z.boolean().describe('Whether the action was successful'),
  message: z.string().describe('Description of what happened'),
  screenshot: z.string().optional().describe('Base64 encoded screenshot if taken'),
  error: z.string().optional().describe('Error message if action failed'),
});

export const stagehandActTool = createTool({
  id: 'stagehand-act',
  description:
    'Perform web actions using natural language instructions via Stagehand AI browser automation',
  inputSchema: stagehandActInputSchema,
  outputSchema: stagehandActOutputSchema,
  execute: async (context, options) => {
    try {
      // Get input data from context.context
      const input = context.context;

      // Get Stagehand instance from context
      const stagehand = context?.stagehand;
      if (!stagehand) {
        return {
          success: false,
          message: 'Stagehand instance not available in context',
          error: 'No Stagehand instance provided',
        };
      }

      const { action, waitForElement = true, timeout = 30000, takeScreenshot = false } = input;

      // Perform the action using Stagehand
      const result = await stagehand.act({
        action,
        // Additional options can be added here based on Stagehand API
      });

      let screenshot: string | undefined;
      if (takeScreenshot && stagehand.page) {
        try {
          const screenshotBuffer = await stagehand.page.screenshot({
            type: 'png',
            fullPage: false,
          });
          screenshot = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
        } catch (screenshotError) {
          // Don't fail the action if screenshot fails
          console.warn('Failed to take screenshot:', screenshotError);
        }
      }

      return {
        success: result.success || false,
        message: result.message || `Performed action: ${action}`,
        screenshot,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Failed to perform action: ${context.context.action}`,
        error: errorMessage,
      };
    }
  },
});
