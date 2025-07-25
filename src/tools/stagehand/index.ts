import { stagehandActTool } from './stagehandActTool';
import { stagehandObserveTool } from './stagehandObserveTool';
import { stagehandExtractTool } from './stagehandExtractTool';

export { stagehandActTool, stagehandObserveTool, stagehandExtractTool };

// Tool collection for easy integration with Mastra agents
export const stagehandTools = {
  act: stagehandActTool,
  observe: stagehandObserveTool,
  extract: stagehandExtractTool,
};

// Tool array for agents that need tools as an array
export const stagehandToolsArray = [stagehandActTool, stagehandObserveTool, stagehandExtractTool];

// Tool metadata for documentation and discovery
export const stagehandToolsMetadata = {
  name: 'Stagehand Browser Automation Tools',
  description: 'AI-powered web browser automation tools using Stagehand',
  version: '1.0.0',
  tools: [
    {
      id: 'stagehand-act',
      name: 'Act Tool',
      description: 'Perform web actions using natural language',
      category: 'automation',
    },
    {
      id: 'stagehand-observe',
      name: 'Observe Tool',
      description: 'Find and analyze elements on web pages',
      category: 'observation',
    },
    {
      id: 'stagehand-extract',
      name: 'Extract Tool',
      description: 'Extract structured data from web pages',
      category: 'data-extraction',
    },
  ],
};
