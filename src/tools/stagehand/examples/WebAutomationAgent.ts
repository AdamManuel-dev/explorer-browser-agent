import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { stagehandTools } from '../index';
import { StagehandSessionManager } from '../StagehandSessionManager';
import { logger } from '../../../utils/logger';
import { BrowserbaseConfig, StagehandConfig } from '../../../mastra/types';

/**
 * Example Web Automation Agent using Stagehand Tools
 *
 * This agent demonstrates how to integrate the Stagehand tool wrappers
 * with a Mastra agent for web automation tasks.
 */
export class WebAutomationAgent {
  private agent: Agent;

  private sessionManager: StagehandSessionManager;

  private isInitialized = false;

  constructor(browserbaseConfig: BrowserbaseConfig, stagehandConfig: StagehandConfig) {
    // Initialize session manager
    this.sessionManager = new StagehandSessionManager(browserbaseConfig, stagehandConfig);

    // Create agent with Stagehand tools
    this.agent = new Agent({
      id: 'web-automation-agent',
      name: 'Web Automation Agent',
      instructions: `
        You are a helpful web automation agent that can navigate websites, interact with elements, and extract data.
        
        Available Tools:
        - stagehandActTool: Use this to perform actions like clicking buttons, filling forms, selecting options
        - stagehandObserveTool: Use this to find and analyze elements on web pages
        - stagehandExtractTool: Use this to extract structured data from web pages
        
        Guidelines:
        1. Always be specific in your instructions to tools
        2. Break down complex tasks into atomic actions
        3. Use observe before acting on elements when necessary
        4. Extract data in structured formats when possible
        5. Take screenshots when helpful for verification
        
        Example workflows:
        - To fill a form: First observe to find fields, then act to fill each field
        - To extract data: Use specific extraction instructions with clear schemas
        - To navigate: Use act tool with clear navigation instructions
      `,
      model: openai('gpt-4'),
      tools: stagehandTools,
    });
  }

  /**
   * Initialize the agent and Stagehand session
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('WebAutomationAgent already initialized');
      return;
    }

    try {
      logger.info('Initializing WebAutomationAgent');
      await this.sessionManager.initialize();
      this.isInitialized = true;
      logger.info('WebAutomationAgent initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize WebAutomationAgent', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Navigate to a URL
   */
  async navigateToUrl(url: string): Promise<void> {
    this.ensureInitialized();
    await this.sessionManager.navigateTo(url);
    logger.info('Navigated to URL', { url });
  }

  /**
   * Execute a web automation task using natural language
   */
  async executeTask(task: string): Promise<any> {
    this.ensureInitialized();

    try {
      logger.info('Executing web automation task', { task });

      // Get tool context for Stagehand integration
      const toolContext = await this.sessionManager.getToolContext();

      // Generate response using the agent with tool access
      const result = await this.agent.generate(task);

      logger.info('Web automation task completed', {
        task: task.substring(0, 100),
        success: true,
      });

      return result;
    } catch (error) {
      logger.error('Web automation task failed', {
        task: task.substring(0, 100),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Extract structured data from the current page
   */
  async extractData(instruction: string, schema?: Record<string, any>): Promise<any> {
    this.ensureInitialized();

    const extractTask = schema
      ? `Extract data from the current page: ${instruction}. Use this schema: ${JSON.stringify(schema)}`
      : `Extract data from the current page: ${instruction}`;

    return this.executeTask(extractTask);
  }

  /**
   * Perform a series of actions in sequence
   */
  async performWorkflow(steps: string[]): Promise<any[]> {
    this.ensureInitialized();

    const results = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      logger.info('Executing workflow step', {
        step: i + 1,
        total: steps.length,
        instruction: step,
      });

      try {
        const result = await this.executeTask(step);
        results.push({ step: i + 1, instruction: step, result, success: true });
      } catch (error) {
        const errorResult = {
          step: i + 1,
          instruction: step,
          error: error instanceof Error ? error.message : String(error),
          success: false,
        };
        results.push(errorResult);

        // Decide whether to continue or stop on error
        logger.warn('Workflow step failed', errorResult);
        // For now, continue with remaining steps
      }
    }

    return results;
  }

  /**
   * Take a screenshot of the current page
   */
  async takeScreenshot(fullPage = false): Promise<string> {
    this.ensureInitialized();
    return this.sessionManager.takeScreenshot({ fullPage });
  }

  /**
   * Get information about the current page
   */
  async getPageInfo(): Promise<{
    url: string;
    title: string;
    description?: string;
  }> {
    this.ensureInitialized();
    return this.sessionManager.getPageInfo();
  }

  /**
   * Health check for the agent and session
   */
  async healthCheck(): Promise<{
    agent: boolean;
    session: any;
    overall: boolean;
  }> {
    const sessionHealth = await this.sessionManager.healthCheck();
    const agentHealth = this.isInitialized;

    return {
      agent: agentHealth,
      session: sessionHealth,
      overall: agentHealth && sessionHealth.healthy,
    };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up WebAutomationAgent');
      await this.sessionManager.cleanup();
      this.isInitialized = false;
      logger.info('WebAutomationAgent cleanup completed');
    } catch (error) {
      logger.error('Error during WebAutomationAgent cleanup', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get agent metrics
   */
  getMetrics(): {
    initialized: boolean;
    session: ReturnType<typeof this.sessionManager.getMetrics>;
  } {
    return {
      initialized: this.isInitialized,
      session: this.sessionManager.getMetrics(),
    };
  }

  /**
   * Ensure agent is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('WebAutomationAgent not initialized. Call initialize() first.');
    }
  }
}

// Example usage function
export async function createWebAutomationAgent(): Promise<WebAutomationAgent> {
  const browserbaseConfig: BrowserbaseConfig = {
    apiKey: process.env.BROWSERBASE_API_KEY!,
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    region: 'us-east-1',
  };

  const stagehandConfig: StagehandConfig = {
    modelName: 'gpt-4o',
    headless: false,
    enableCaching: true,
  };

  const agent = new WebAutomationAgent(browserbaseConfig, stagehandConfig);
  await agent.initialize();

  return agent;
}

// Example automation tasks
export const exampleTasks = {
  // Simple navigation and extraction
  extractProductInfo: async (agent: WebAutomationAgent, productUrl: string) => {
    await agent.navigateToUrl(productUrl);
    return agent.extractData(
      'Extract product information including name, price, description, and reviews',
      {
        name: 'string',
        price: 'string',
        description: 'string',
        rating: 'number',
        reviewCount: 'number',
      }
    );
  },

  // Multi-step workflow
  loginAndExtractData: async (
    agent: WebAutomationAgent,
    loginUrl: string,
    username: string,
    password: string
  ) => {
    return agent.performWorkflow([
      `Navigate to ${loginUrl}`,
      'Find and click the login button',
      `Type "${username}" in the username field`,
      `Type "${password}" in the password field`,
      'Click the submit button',
      'Wait for login to complete',
      'Extract user profile information from the dashboard',
    ]);
  },

  // Form automation
  fillContactForm: async (agent: WebAutomationAgent, formData: Record<string, string>) => {
    const steps = Object.entries(formData).map(
      ([field, value]) => `Fill "${value}" in the ${field} field`
    );
    steps.push('Submit the form');

    return agent.performWorkflow(steps);
  },
};
