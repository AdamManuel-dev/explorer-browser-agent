/**
 * Usage Example: Stagehand Tools with Mastra Agents
 *
 * This example demonstrates how to use the Stagehand tool wrappers
 * with a Mastra agent for web automation tasks.
 */

import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { stagehandTools } from '../index';
import { StagehandSessionManager } from '../StagehandSessionManager';
import { logger } from '../../../utils/logger';

// Environment setup
const BROWSERBASE_API_KEY = process.env.BROWSERBASE_API_KEY || 'demo-key';
const BROWSERBASE_PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID || 'demo-project';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'demo-key';

/**
 * Example 1: Basic Agent Setup
 */
export async function createWebAutomationAgent() {
  // Create agent with Stagehand tools
  const agent = new Agent({
    id: 'web-automation-example',
    name: 'Web Automation Example Agent',
    instructions: `
      You are a web automation specialist that can navigate websites and extract information.
      
      Use the available Stagehand tools:
      - stagehandActTool: For performing actions (clicking, typing, selecting)
      - stagehandObserveTool: For finding elements on pages
      - stagehandExtractTool: For extracting structured data
      
      Always break down complex tasks into atomic actions.
      Be specific in your instructions to tools.
      Take screenshots when helpful for verification.
    `,
    model: openai('gpt-4'),
    tools: stagehandTools,
  });

  logger.info('Created web automation agent with Stagehand tools');
  return agent;
}

/**
 * Example 2: Session Management Setup
 */
export async function setupStagehandSession() {
  // Create session manager
  const sessionManager = new StagehandSessionManager(
    {
      apiKey: BROWSERBASE_API_KEY,
      projectId: BROWSERBASE_PROJECT_ID,
      region: 'us-east-1',
    },
    {
      modelName: 'gpt-4o',
      headless: false,
      enableCaching: true,
    }
  );

  // Initialize the session
  await sessionManager.initialize();

  logger.info('Stagehand session initialized');
  return sessionManager;
}

/**
 * Example 3: Complete Automation Workflow
 */
export async function runWebAutomationExample() {
  let sessionManager: StagehandSessionManager | null = null;

  try {
    // 1. Setup
    logger.info('Starting web automation example');

    const agent = await createWebAutomationAgent();
    sessionManager = await setupStagehandSession();

    // 2. Navigate to a website
    await sessionManager.navigateTo('https://example.com');
    logger.info('Navigated to example.com');

    // 3. Take initial screenshot
    const initialScreenshot = await sessionManager.takeScreenshot();
    logger.info('Initial screenshot captured');

    // 4. Get page information
    const pageInfo = await sessionManager.getPageInfo();
    logger.info('Page info retrieved', pageInfo);

    // 5. Use agent to perform complex tasks
    // Note: In the current placeholder implementation, this will log warnings
    // but demonstrate the intended API structure

    const observationTask = `
      Please observe the current page and find all clickable elements.
      Look for buttons, links, and form controls.
    `;

    const observationResult = await agent.generate(observationTask);
    logger.info('Observation task completed', { result: observationResult });

    const extractionTask = `
      Extract the following information from the current page:
      - Page title
      - Main heading text
      - Any navigation menu items
      - Contact information if available
      
      Return the data in JSON format.
    `;

    const extractionResult = await agent.generate(extractionTask);
    logger.info('Extraction task completed', { result: extractionResult });

    // 6. Demonstrate action capabilities
    const actionTask = `
      If there's a search box on the page, type "web automation" into it.
      If there's no search box, click on any available link.
    `;

    const actionResult = await agent.generate(actionTask);
    logger.info('Action task completed', { result: actionResult });

    // 7. Final screenshot
    const finalScreenshot = await sessionManager.takeScreenshot();
    logger.info('Final screenshot captured');

    // 8. Health check
    const healthCheck = await sessionManager.healthCheck();
    logger.info('Session health check', healthCheck);

    return {
      success: true,
      pageInfo,
      observationResult,
      extractionResult,
      actionResult,
      screenshots: {
        initial: `${initialScreenshot.substring(0, 50)}...`,
        final: `${finalScreenshot.substring(0, 50)}...`,
      },
      healthCheck,
    };
  } catch (error) {
    logger.error('Web automation example failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // 9. Cleanup
    if (sessionManager) {
      await sessionManager.cleanup();
      logger.info('Session cleanup completed');
    }
  }
}

/**
 * Example 4: E-commerce Product Extraction
 */
export async function extractProductInformation(productUrl: string) {
  let sessionManager: StagehandSessionManager | null = null;

  try {
    const agent = await createWebAutomationAgent();
    sessionManager = await setupStagehandSession();

    // Navigate to product page
    await sessionManager.navigateTo(productUrl);

    // Extract product data using the agent
    const extractionTask = `
      Extract detailed product information from this e-commerce page:
      
      Please find and extract:
      1. Product name/title
      2. Price (current and original if on sale)
      3. Product description
      4. Customer rating/reviews summary
      5. Availability status
      6. Product images (count)
      7. Key features/specifications
      8. Shipping information
      
      Return the data in a structured JSON format.
      If any information is not available, mark it as null.
    `;

    const result = await agent.generate(extractionTask);

    return {
      success: true,
      productUrl,
      data: result,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      productUrl,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (sessionManager) {
      await sessionManager.cleanup();
    }
  }
}

/**
 * Example 5: Multi-step Form Automation
 */
export async function automateFormFilling(formUrl: string, formData: Record<string, string>) {
  let sessionManager: StagehandSessionManager | null = null;

  try {
    const agent = await createWebAutomationAgent();
    sessionManager = await setupStagehandSession();

    // Navigate to form page
    await sessionManager.navigateTo(formUrl);

    // Analyze the form first
    const analysisTask = `
      Please analyze the form on this page and identify all input fields.
      For each field, note:
      - Field type (text, email, password, select, etc.)
      - Field label or placeholder
      - Whether it's required
      - Any validation hints
      
      Return a structured list of all form fields.
    `;

    const formAnalysis = await agent.generate(analysisTask);

    // Fill the form step by step
    const fillTasks = Object.entries(formData).map(
      ([field, value]) => `Fill the field labeled "${field}" with the value "${value}"`
    );

    const fillResults = [];
    for (const task of fillTasks) {
      const result = await agent.generate(task);
      fillResults.push({ task, result });
    }

    // Submit the form
    const submitTask = 'Find and click the form submit button';
    const submitResult = await agent.generate(submitTask);

    return {
      success: true,
      formUrl,
      formAnalysis,
      fillResults,
      submitResult,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      formUrl,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (sessionManager) {
      await sessionManager.cleanup();
    }
  }
}

// CLI-style usage examples
if (require.main === module) {
  (async () => {
    console.log('Running Stagehand Tools Example...\n');

    // Example 1: Basic automation
    console.log('1. Running basic web automation example...');
    const basicResult = await runWebAutomationExample();
    console.log('Basic example result:', JSON.stringify(basicResult, null, 2));

    // Example 2: Product extraction (placeholder URL)
    console.log('\n2. Running product extraction example...');
    const productResult = await extractProductInformation('https://example-shop.com/product/123');
    console.log('Product extraction result:', JSON.stringify(productResult, null, 2));

    // Example 3: Form automation (placeholder URL and data)
    console.log('\n3. Running form automation example...');
    const formResult = await automateFormFilling('https://example.com/contact', {
      Name: 'John Doe',
      Email: 'john@example.com',
      Message: 'Hello from Stagehand automation!',
    });
    console.log('Form automation result:', JSON.stringify(formResult, null, 2));

    console.log('\nAll examples completed!');
  })().catch(console.error);
}
