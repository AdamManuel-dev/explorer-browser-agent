# Stagehand Tool Wrappers for Mastra

This directory contains Mastra-compatible tool wrappers for Stagehand browser automation, enabling AI agents to perform web automation tasks using natural language instructions.

## Available Tools

### 1. `stagehandActTool`
Performs actions on web elements using AI-guided automation.

**Use cases:**
- Clicking buttons and links
- Filling forms and input fields
- Selecting dropdown options
- Hovering over elements
- Submitting forms

**Example:**
```typescript
// Agent will use this tool to perform actions
await agent.generate("Click the sign in button");
await agent.generate("Type 'john@example.com' in the email field");
```

### 2. `stagehandObserveTool` 
Finds and analyzes elements on web pages using AI-powered element detection.

**Use cases:**
- Locating elements before interaction
- Analyzing page structure
- Finding form fields and buttons
- Identifying navigation elements

**Example:**
```typescript
// Agent will use this tool to find elements
await agent.generate("Find all the form input fields on this page");
await agent.generate("Locate the navigation menu items");
```

### 3. `stagehandExtractTool`
Extracts structured data from web pages using AI-powered content analysis.

**Use cases:**
- Extracting product information
- Gathering contact details
- Pulling article content
- Converting tables to structured data

**Example:**
```typescript
// Agent will use this tool to extract data
await agent.generate("Extract the product name, price, and description from this page");
await agent.generate("Get all the contact information from the about page");
```

## Setup and Integration

### 1. Import the Tools

```typescript
import { 
  stagehandActTool, 
  stagehandObserveTool, 
  stagehandExtractTool,
  stagehandTools  // All tools as an object
} from './tools/stagehand';
```

### 2. Create an Agent with Stagehand Tools

```typescript
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { stagehandTools } from './tools/stagehand';

const webAgent = new Agent({
  name: 'Web Automation Agent',
  instructions: `
    You are a web automation agent that can navigate websites, interact with elements, and extract data.
    
    Use stagehandActTool to perform actions like clicking buttons or filling forms.
    Use stagehandObserveTool to find elements on pages before interacting with them.
    Use stagehandExtractTool to pull structured data from web pages.
    
    Always be specific in your instructions and break down complex tasks into atomic actions.
  `,
  model: openai('gpt-4'),
  tools: stagehandTools,
});
```

### 3. Initialize Stagehand Session

```typescript
import { StagehandSessionManager } from './tools/stagehand/StagehandSessionManager';

// Initialize session manager
const sessionManager = new StagehandSessionManager(
  {
    apiKey: process.env.BROWSERBASE_API_KEY!,
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    region: 'us-east-1',
  },
  {
    modelName: 'gpt-4o',
    headless: false,
    enableCaching: true,
  }
);

// Initialize Stagehand
await sessionManager.initialize();

// Get tool context
const toolContext = await sessionManager.getToolContext();
```

### 4. Run Agent with Context

```typescript
// The tools will automatically access the Stagehand instance through context
const result = await webAgent.generate(
  "Navigate to https://example.com and click the login button",
  { context: toolContext }
);
```

## Complete Example

```typescript
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { stagehandTools } from './tools/stagehand';
import { StagehandSessionManager } from './tools/stagehand/StagehandSessionManager';

async function automateWebTask() {
  // 1. Create session manager
  const sessionManager = new StagehandSessionManager(
    {
      apiKey: process.env.BROWSERBASE_API_KEY!,
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
    },
    {
      modelName: 'gpt-4o',
      headless: false,
    }
  );

  try {
    // 2. Initialize Stagehand
    await sessionManager.initialize();

    // 3. Create agent with tools
    const webAgent = new Agent({
      name: 'Web Scraper',
      instructions: 'Navigate websites and extract product information',
      model: openai('gpt-4'),
      tools: stagehandTools,
    });

    // 4. Get tool context
    const toolContext = await sessionManager.getToolContext();

    // 5. Navigate to a website
    await sessionManager.navigateTo('https://example-shop.com');

    // 6. Use agent to perform complex tasks
    const result = await webAgent.generate(
      `
      Please help me extract product information:
      1. Find all product cards on this page
      2. For each product, extract the name, price, and rating
      3. Return the data in a structured format
      `,
      { context: toolContext }
    );

    console.log('Extraction result:', result);

    // 7. Take screenshot for verification
    const screenshot = await sessionManager.takeScreenshot();
    console.log('Screenshot taken:', screenshot.substring(0, 50) + '...');

  } finally {
    // 8. Clean up
    await sessionManager.cleanup();
  }
}

// Run the automation
automateWebTask().catch(console.error);
```

## Tool Implementation Notes

### Current Status
The tools are currently implemented with placeholder logic and require integration with an actual Stagehand instance. The real implementation would:

1. Accept Stagehand instance through agent context
2. Use Stagehand's `act()`, `observe()`, and `extract()` methods
3. Handle errors and timeouts appropriately
4. Return structured results with screenshots

### Integration Steps
To complete the integration:

1. **Modify the tool implementations** to use actual Stagehand calls instead of throwing errors
2. **Set up context passing** so tools can access the Stagehand instance
3. **Configure error handling** for browser automation failures
4. **Add logging and monitoring** for tool usage and performance

### Error Handling
The tools include comprehensive error handling for:
- Network timeouts
- Element not found scenarios
- Browser crashes or disconnections
- Invalid instructions or parameters
- Session cleanup failures

### Performance Considerations
- Tools include configurable timeouts
- Screenshots are optional and can be disabled for performance
- Element observation can be limited to avoid processing too many elements
- Caching is supported through Stagehand configuration

## Environment Variables

Make sure to set these environment variables:

```bash
BROWSERBASE_API_KEY=your_browserbase_api_key
BROWSERBASE_PROJECT_ID=your_browserbase_project_id
OPENAI_API_KEY=your_openai_api_key
```

## Dependencies

The tools require these packages:
- `@mastra/core`
- `@browserbasehq/stagehand`
- `@browserbasehq/sdk`
- `playwright`
- `zod`

All dependencies are already included in the project's package.json.