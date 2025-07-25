import { createTool } from '@mastra/core';
import { z } from 'zod';

const stagehandExtractInputSchema = z.object({
  instruction: z
    .string()
    .describe(
      'Natural language instruction for what to extract (e.g., "Extract all product prices", "Get the page title and description")'
    ),
  schema: z
    .record(z.any())
    .optional()
    .describe('JSON schema defining the structure of data to extract'),
  format: z.enum(['json', 'text', 'markdown']).optional().describe('Output format (default: json)'),
  includeMetadata: z
    .boolean()
    .optional()
    .describe('Whether to include metadata about the extraction (default: false)'),
});

const stagehandExtractOutputSchema = z.object({
  success: z.boolean().describe('Whether the extraction was successful'),
  data: z.any().describe('Extracted data in the requested format'),
  format: z.string().describe('Format of the extracted data'),
  metadata: z
    .object({
      extractedAt: z.string().describe('Timestamp of extraction'),
      pageUrl: z.string().optional().describe('URL of the page'),
      pageTitle: z.string().optional().describe('Title of the page'),
      elementCount: z.number().optional().describe('Number of elements processed'),
    })
    .optional()
    .describe('Metadata about the extraction'),
  message: z.string().describe('Description of what was extracted'),
  error: z.string().optional().describe('Error message if extraction failed'),
});

export const stagehandExtractTool = createTool({
  id: 'stagehand-extract',
  description:
    'Extract structured data from the current web page using AI-powered content analysis',
  inputSchema: stagehandExtractInputSchema,
  outputSchema: stagehandExtractOutputSchema,
  execute: async (context, options) => {
    try {
      // Get input data from context.context
      const input = context.context;

      // Get Stagehand instance from context
      const stagehand = context?.stagehand;
      if (!stagehand) {
        return {
          success: false,
          data: null,
          format: 'json',
          message: 'Stagehand instance not available in context',
          error: 'No Stagehand instance provided',
        };
      }

      const { instruction, schema, format = 'json', includeMetadata = false } = input;

      // Use Stagehand to extract data
      const extractOptions: any = {
        instruction,
      };

      // Add schema if provided
      if (schema) {
        extractOptions.schema = schema;
      }

      const result = await stagehand.extract(extractOptions);

      // Prepare metadata if requested
      let metadata;
      if (includeMetadata && stagehand.page) {
        try {
          const pageUrl = stagehand.page.url();
          const pageTitle = await stagehand.page.title();
          metadata = {
            extractedAt: new Date().toISOString(),
            pageUrl,
            pageTitle,
          };
        } catch (metadataError) {
          // Don't fail extraction if metadata collection fails
          console.warn('Failed to collect metadata:', metadataError);
        }
      }

      // Format the result based on requested format
      let formattedData;
      try {
        switch (format) {
          case 'text':
            formattedData = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
            break;
          case 'markdown':
            formattedData =
              typeof result === 'string'
                ? `\`\`\`\n${result}\n\`\`\``
                : `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
            break;
          case 'json':
          default:
            formattedData = result;
            break;
        }
      } catch (formatError) {
        formattedData = result; // Fallback to raw result
      }

      return {
        success: true,
        data: formattedData,
        format,
        metadata,
        message: `Successfully extracted data using instruction: ${instruction}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        data: null,
        format: context.context.format || 'json',
        message: `Failed to extract data: ${context.context.instruction}`,
        error: errorMessage,
      };
    }
  },
});
