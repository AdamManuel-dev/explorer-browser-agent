// Custom workflow base classes since @mastra/workflows doesn't exist
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { MonitoringService } from '../../monitoring';
import { ExplorerAgent } from '../agents/ExplorerAgent';
import { PlannerAgent } from '../agents/PlannerAgent';
import { GeneratorAgent } from '../agents/GeneratorAgent';
import { Workflow } from './WorkflowBase';
import {
  ExplorationTarget,
  ExplorationResult,
  CrawlPlan,
  TestGenerationRequest,
  TestGenerationResult,
  WorkflowContext as CustomWorkflowContext,
  BrowserbaseConfig,
  StagehandConfig,
} from '../types';

export interface ExplorationWorkflowConfig {
  browserbase: BrowserbaseConfig;
  stagehand: StagehandConfig;
  monitoring?: MonitoringService;
  maxConcurrentExplorations?: number;
  defaultTimeout?: number;
  retryAttempts?: number;
  enableTestGeneration?: boolean;
  outputDirectory?: string;
}

export interface ExplorationWorkflowInput {
  targets: ExplorationTarget[];
  planningContext?: {
    domain: string;
    objectives: string[];
    constraints: {
      timeLimit?: number;
      resourceLimit?: number;
      priorityAreas?: string[];
      excludedAreas?: string[];
    };
  };
  testGenerationOptions?: {
    framework: 'playwright' | 'cypress' | 'selenium';
    language: 'typescript' | 'javascript' | 'python' | 'java';
    generatePageObjects: boolean;
    generateFixtures: boolean;
    generateHelpers: boolean;
  };
}

export interface ExplorationWorkflowOutput {
  sessionId: string;
  plan: CrawlPlan;
  explorationResults: ExplorationResult[];
  testGenerationResult?: TestGenerationResult;
  metadata: {
    totalDuration: number;
    totalPagesExplored: number;
    totalTestsGenerated: number;
    successRate: number;
    errors: string[];
  };
}

export class ExplorationWorkflow extends Workflow<
  ExplorationWorkflowInput,
  ExplorationWorkflowOutput
> {
  private explorerAgent: ExplorerAgent;

  private plannerAgent: PlannerAgent;

  private generatorAgent: GeneratorAgent;

  private monitoring?: MonitoringService;

  private workflowConfig: ExplorationWorkflowConfig;

  constructor(config: ExplorationWorkflowConfig) {
    super({
      name: 'ExplorationWorkflow',
      description:
        'Complete web exploration workflow with planning, exploration, and test generation',
      version: '1.0.0',
    });

    this.workflowConfig = config;
    this.monitoring = config.monitoring;

    // Initialize agents
    this.explorerAgent = new ExplorerAgent({
      browserbase: config.browserbase,
      stagehand: config.stagehand,
      monitoring: config.monitoring,
      maxConcurrentSessions: config.maxConcurrentExplorations || 5,
      defaultTimeout: config.defaultTimeout || 30000,
    });

    this.plannerAgent = new PlannerAgent({
      monitoring: config.monitoring,
      maxConcurrency: config.maxConcurrentExplorations || 5,
      planningTimeout: config.defaultTimeout || 30000,
    });

    this.generatorAgent = new GeneratorAgent({
      monitoring: config.monitoring,
      outputDirectory: config.outputDirectory || './generated-tests',
      maxConcurrentGenerations: 3,
      cacheEnabled: true,
    });

    this.defineWorkflowSteps();
  }

  /**
   * Define the workflow steps
   */
  private defineWorkflowSteps(): void {
    // Step 1: Initialize workflow context
    this.addStep('initialize', this.initializeWorkflow.bind(this));

    // Step 2: Create exploration plan
    this.addStep('plan', this.createExplorationPlan.bind(this));

    // Step 3: Execute exploration
    this.addStep('explore', this.executeExploration.bind(this));

    // Step 4: Generate tests (optional)
    this.addStep('generate', this.generateTests.bind(this));

    // Step 5: Finalize and cleanup
    this.addStep('finalize', this.finalizeWorkflow.bind(this));

    // Error handling step
    this.addStep('handleError', this.handleWorkflowError.bind(this));
  }

  /**
   * Execute the complete exploration workflow
   */
  async execute(input: ExplorationWorkflowInput): Promise<ExplorationWorkflowOutput> {
    const startTime = new Date();
    const sessionId = uuidv4();
    const spanId = this.monitoring?.startSpan('exploration_workflow', undefined);

    try {
      logger.info('Starting exploration workflow', {
        sessionId,
        targetCount: input.targets.length,
        domain: input.planningContext?.domain,
        objectives: input.planningContext?.objectives,
      });

      // Create workflow context
      const context: any = {
        sessionId,
        input,
        output: {
          sessionId,
          plan: {} as CrawlPlan,
          explorationResults: [],
          metadata: {
            totalDuration: 0,
            totalPagesExplored: 0,
            totalTestsGenerated: 0,
            successRate: 0,
            errors: [],
          },
        },
        metadata: {
          startTime,
          currentStep: 'initialize',
          errors: [],
        },
      };

      // Execute workflow steps
      await this.executeStep('initialize', context);
      await this.executeStep('plan', context);
      await this.executeStep('explore', context);

      if (this.workflowConfig.enableTestGeneration && input.testGenerationOptions) {
        await this.executeStep('generate', context);
      }

      await this.executeStep('finalize', context);

      const output = context.output as ExplorationWorkflowOutput;
      const endTime = new Date();
      output.metadata.totalDuration = endTime.getTime() - startTime.getTime();

      this.monitoring?.recordHistogram('workflow_duration', output.metadata.totalDuration);
      this.monitoring?.recordGauge('workflow_success_rate', output.metadata.successRate);

      logger.info('Exploration workflow completed successfully', {
        sessionId,
        duration: output.metadata.totalDuration,
        pagesExplored: output.metadata.totalPagesExplored,
        testsGenerated: output.metadata.totalTestsGenerated,
        successRate: output.metadata.successRate,
      });

      return output;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Exploration workflow failed', {
        sessionId,
        error: errorMessage,
      });

      this.monitoring?.recordCounter('workflow_errors', 1);

      // Try to handle the error gracefully
      const context: any = {
        sessionId,
        input,
        output: {
          sessionId,
          plan: {} as CrawlPlan,
          explorationResults: [],
          metadata: {
            totalDuration: Date.now() - startTime.getTime(),
            totalPagesExplored: 0,
            totalTestsGenerated: 0,
            successRate: 0,
            errors: [errorMessage],
          },
        },
        metadata: {
          startTime,
          currentStep: 'error',
          errors: [errorMessage],
        },
      };

      await this.executeStep('handleError', context);
      return context.output as ExplorationWorkflowOutput;
    } finally {
      if (spanId) {
        this.monitoring?.endSpan(spanId);
      }
    }
  }

  /**
   * Step 1: Initialize workflow context
   */
  private async initializeWorkflow(context: any): Promise<void> {
    const spanId = this.monitoring?.startSpan('workflow_initialize');

    try {
      logger.debug('Initializing workflow context', {
        sessionId: context.sessionId,
      });

      // Validate input
      await this.validateInput(context.input as ExplorationWorkflowInput);

      // Set up monitoring
      if (this.monitoring) {
        this.monitoring.recordCounter('workflow_started', 1);
      }

      // Initialize custom context properties
      const customContext = context as CustomWorkflowContext;
      customContext.config = {
        browserbase: this.workflowConfig.browserbase,
        stagehand: this.workflowConfig.stagehand,
      };
      customContext.targets = (context.input as ExplorationWorkflowInput).targets;
      customContext.results = [];
      customContext.errors = [];
      customContext.metadata = {
        workflowVersion: '1.0.0',
        agentVersions: {
          explorer: this.explorerAgent.getCapabilities(),
          planner: this.plannerAgent.getCapabilities(),
          generator: this.generatorAgent.getCapabilities(),
        },
      };

      context.metadata.currentStep = 'plan';

      logger.debug('Workflow initialization completed', {
        sessionId: context.sessionId,
        targetCount: customContext.targets.length,
      });
    } catch (error) {
      logger.error('Failed to initialize workflow', {
        sessionId: context.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      if (spanId) {
        this.monitoring?.endSpan(spanId);
      }
    }
  }

  /**
   * Step 2: Create exploration plan
   */
  private async createExplorationPlan(context: any): Promise<void> {
    const spanId = this.monitoring?.startSpan('workflow_plan');

    try {
      const input = context.input as ExplorationWorkflowInput;
      const output = context.output as ExplorationWorkflowOutput;

      logger.debug('Creating exploration plan', {
        sessionId: context.sessionId,
        targetCount: input.targets.length,
      });

      // Create planning context
      const planningContext = input.planningContext || {
        domain: input.targets[0]?.domain || 'unknown',
        objectives: ['comprehensive_exploration'],
        constraints: {},
      };

      // Generate exploration plan
      const plan = await this.plannerAgent.createPlan(input.targets, planningContext);

      output.plan = plan;
      context.metadata.currentStep = 'explore';

      // Log plan details
      logger.info('Exploration plan created', {
        sessionId: context.sessionId,
        planId: plan.id,
        strategy: plan.strategy,
        targetCount: plan.targets.length,
        estimatedDuration: plan.resources.timeout,
        maxConcurrency: plan.resources.maxConcurrency,
      });
    } catch (error) {
      logger.error('Failed to create exploration plan', {
        sessionId: context.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      if (spanId) {
        this.monitoring?.endSpan(spanId);
      }
    }
  }

  /**
   * Step 3: Execute exploration
   */
  private async executeExploration(context: any): Promise<void> {
    const spanId = this.monitoring?.startSpan('workflow_explore');

    try {
      const output = context.output as ExplorationWorkflowOutput;
      const { plan } = output;

      logger.debug('Starting exploration execution', {
        sessionId: context.sessionId,
        planId: plan.id,
        strategy: plan.strategy,
      });

      const explorationResults: ExplorationResult[] = [];
      const { maxConcurrency } = plan.resources;

      // Execute explorations based on strategy
      if (plan.strategy === 'distributed' && maxConcurrency > 1) {
        // Parallel exploration
        explorationResults.push(...(await this.executeParallelExploration(plan)));
      } else {
        // Sequential exploration
        explorationResults.push(...(await this.executeSequentialExploration(plan)));
      }

      // Store results
      output.explorationResults = explorationResults;

      // Calculate metadata
      output.metadata.totalPagesExplored = explorationResults.reduce(
        (sum, result) => sum + result.pagesExplored,
        0
      );

      const successfulExplorations = explorationResults.filter(
        (r) => r.userPaths.length > 0
      ).length;
      output.metadata.successRate =
        explorationResults.length > 0 ? successfulExplorations / explorationResults.length : 0;

      context.metadata.currentStep = this.workflowConfig.enableTestGeneration
        ? 'generate'
        : 'finalize';

      logger.info('Exploration execution completed', {
        sessionId: context.sessionId,
        resultsCount: explorationResults.length,
        pagesExplored: output.metadata.totalPagesExplored,
        successRate: output.metadata.successRate,
      });
    } catch (error) {
      logger.error('Failed to execute exploration', {
        sessionId: context.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      if (spanId) {
        this.monitoring?.endSpan(spanId);
      }
    }
  }

  /**
   * Step 4: Generate tests (optional)
   */
  private async generateTests(context: any): Promise<void> {
    const spanId = this.monitoring?.startSpan('workflow_generate');

    try {
      const input = context.input as ExplorationWorkflowInput;
      const output = context.output as ExplorationWorkflowOutput;

      if (!input.testGenerationOptions) {
        logger.debug('Skipping test generation - no options provided', {
          sessionId: context.sessionId,
        });
        context.metadata.currentStep = 'finalize';
        return;
      }

      logger.debug('Starting test generation', {
        sessionId: context.sessionId,
        resultsCount: output.explorationResults.length,
      });

      // Collect all user paths from exploration results
      const allUserPaths = output.explorationResults.flatMap((result) => result.userPaths);

      if (allUserPaths.length === 0) {
        logger.warn('No user paths found for test generation', {
          sessionId: context.sessionId,
        });
        context.metadata.currentStep = 'finalize';
        return;
      }

      // Create test generation request
      const testGenRequest: TestGenerationRequest = {
        userPaths: allUserPaths,
        framework: input.testGenerationOptions.framework,
        language: input.testGenerationOptions.language,
        options: {
          generatePageObjects: input.testGenerationOptions.generatePageObjects,
          generateFixtures: input.testGenerationOptions.generateFixtures,
          generateHelpers: input.testGenerationOptions.generateHelpers,
          outputDirectory: this.workflowConfig.outputDirectory || './generated-tests',
        },
      };

      // Generate tests
      const testResult = await this.generatorAgent.generateTests(testGenRequest);

      output.testGenerationResult = testResult;
      output.metadata.totalTestsGenerated = testResult.metrics.testsGenerated;

      context.metadata.currentStep = 'finalize';

      logger.info('Test generation completed', {
        sessionId: context.sessionId,
        testsGenerated: testResult.metrics.testsGenerated,
        pageObjectsGenerated: testResult.metrics.pageObjectsGenerated,
        linesOfCode: testResult.metrics.linesOfCode,
        generationTime: testResult.metrics.generationTime,
      });
    } catch (error) {
      logger.error('Failed to generate tests', {
        sessionId: context.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Don't fail the entire workflow for test generation errors
      const output = context.output as ExplorationWorkflowOutput;
      output.metadata.errors.push(
        `Test generation failed: ${error instanceof Error ? error.message : String(error)}`
      );

      context.metadata.currentStep = 'finalize';
    } finally {
      if (spanId) {
        this.monitoring?.endSpan(spanId);
      }
    }
  }

  /**
   * Step 5: Finalize workflow
   */
  private async finalizeWorkflow(context: any): Promise<void> {
    const spanId = this.monitoring?.startSpan('workflow_finalize');

    try {
      const output = context.output as ExplorationWorkflowOutput;

      logger.debug('Finalizing workflow', {
        sessionId: context.sessionId,
      });

      // Add any final metadata
      output.metadata.errors = context.metadata.errors || [];

      // Cleanup agents if needed
      await this.cleanupAgents();

      // Record final metrics
      if (this.monitoring) {
        this.monitoring.recordCounter('workflow_completed', 1, {
          status: 'success',
          pages_explored: output.metadata.totalPagesExplored.toString(),
          tests_generated: output.metadata.totalTestsGenerated.toString(),
        });
      }

      logger.debug('Workflow finalization completed', {
        sessionId: context.sessionId,
        totalErrors: output.metadata.errors.length,
      });
    } catch (error) {
      logger.error('Failed to finalize workflow', {
        sessionId: context.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      if (spanId) {
        this.monitoring?.endSpan(spanId);
      }
    }
  }

  /**
   * Handle workflow errors
   */
  private async handleWorkflowError(context: any): Promise<void> {
    try {
      logger.info('Handling workflow error', {
        sessionId: context.sessionId,
        errors: context.metadata.errors,
      });

      const output = context.output as ExplorationWorkflowOutput;

      // Ensure metadata exists
      if (!output.metadata) {
        output.metadata = {
          totalDuration: 0,
          totalPagesExplored: 0,
          totalTestsGenerated: 0,
          successRate: 0,
          errors: [],
        };
      }

      // Add errors from context
      output.metadata.errors = [
        ...(output.metadata.errors || []),
        ...(context.metadata.errors || []),
      ];

      // Attempt cleanup
      await this.cleanupAgents();

      // Record error metrics
      if (this.monitoring) {
        this.monitoring.recordCounter('workflow_completed', 1, {
          status: 'error',
          error_count: output.metadata.errors.length.toString(),
        });
      }
    } catch (cleanupError) {
      logger.error('Failed to handle workflow error', {
        sessionId: context.sessionId,
        originalErrors: context.metadata.errors,
        cleanupError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      });
    }
  }

  /**
   * Execute parallel exploration
   */
  private async executeParallelExploration(plan: CrawlPlan): Promise<ExplorationResult[]> {
    const { maxConcurrency } = plan.resources;
    const results: ExplorationResult[] = [];

    // Create batches of targets
    const batches: ExplorationTarget[][] = [];
    for (let i = 0; i < plan.targets.length; i += maxConcurrency) {
      batches.push(plan.targets.slice(i, i + maxConcurrency));
    }

    // Process each batch in parallel
    for (const batch of batches) {
      try {
        const batchPromises = batch.map((target) =>
          this.explorerAgent.explore(target).catch((error) => {
            logger.warn(`Exploration failed for target ${target.url}`, {
              error: error instanceof Error ? error.message : String(error),
            });
            return null;
          })
        );

        const batchResults = await Promise.all(batchPromises);

        // Filter out null results (failed explorations)
        const successfulResults = batchResults.filter(
          (result) => result !== null
        ) as ExplorationResult[];
        results.push(...successfulResults);

        // Optimize plan based on current results if we have more batches
        if (batches.indexOf(batch) < batches.length - 1) {
          const completedUrls = results.map((r) => r.target.url);
          const performanceData = {
            avgResponseTime:
              results.reduce((sum, r) => sum + (r.endTime.getTime() - r.startTime.getTime()), 0) /
              results.length,
            totalAttempts: batch.length,
            memoryUsage: process.memoryUsage().heapUsed,
          };

          await this.plannerAgent.optimizePlan(plan.id, performanceData, completedUrls);
        }
      } catch (error) {
        logger.error(`Failed to process exploration batch`, {
          batchSize: batch.length,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Execute sequential exploration
   */
  private async executeSequentialExploration(plan: CrawlPlan): Promise<ExplorationResult[]> {
    const results: ExplorationResult[] = [];

    for (const target of plan.targets) {
      try {
        const result = await this.explorerAgent.explore(target);
        results.push(result);

        // Optimize plan based on current progress
        if (results.length % 5 === 0) {
          // Optimize every 5 completions
          const completedUrls = results.map((r) => r.target.url);
          const performanceData = {
            avgResponseTime:
              results.reduce((sum, r) => sum + (r.endTime.getTime() - r.startTime.getTime()), 0) /
              results.length,
            totalAttempts: results.length,
            memoryUsage: process.memoryUsage().heapUsed,
          };

          await this.plannerAgent.optimizePlan(plan.id, performanceData, completedUrls);
        }
      } catch (error) {
        logger.warn(`Exploration failed for target ${target.url}`, {
          error: error instanceof Error ? error.message : String(error),
        });

        // Continue with next target
        continue;
      }
    }

    return results;
  }

  /**
   * Validate workflow input
   */
  private async validateInput(input: ExplorationWorkflowInput): Promise<void> {
    if (!input.targets || input.targets.length === 0) {
      throw new Error('No exploration targets provided');
    }

    for (const target of input.targets) {
      if (!target.url || !target.domain) {
        throw new Error(`Invalid target: missing URL or domain`);
      }

      if (target.maxPages <= 0 || target.maxDepth <= 0) {
        throw new Error(`Invalid target limits: maxPages and maxDepth must be positive`);
      }
    }

    if (input.testGenerationOptions) {
      const validFrameworks = ['playwright', 'cypress', 'selenium'];
      const validLanguages = ['typescript', 'javascript', 'python', 'java'];

      if (!validFrameworks.includes(input.testGenerationOptions.framework)) {
        throw new Error(`Invalid framework: ${input.testGenerationOptions.framework}`);
      }

      if (!validLanguages.includes(input.testGenerationOptions.language)) {
        throw new Error(`Invalid language: ${input.testGenerationOptions.language}`);
      }
    }
  }

  /**
   * Cleanup agents
   */
  private async cleanupAgents(): Promise<void> {
    try {
      await Promise.all([
        this.explorerAgent.shutdown(),
        // Planner and Generator agents don't require special cleanup in this implementation
      ]);

      logger.debug('Agent cleanup completed');
    } catch (error) {
      logger.warn('Error during agent cleanup', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(_sessionId: string): {
    exists: boolean;
    status?: 'running' | 'completed' | 'failed';
    currentStep?: string;
    progress?: number;
    errors?: string[];
  } {
    // This would typically be implemented with a state store
    // For now, return a placeholder response
    return {
      exists: false,
    };
  }

  /**
   * Cancel a running workflow
   */
  async cancelWorkflow(sessionId: string): Promise<boolean> {
    try {
      logger.info('Cancelling workflow', { sessionId });

      // This would typically involve stopping agents and cleaning up resources
      await this.cleanupAgents();

      return true;
    } catch (error) {
      logger.error('Failed to cancel workflow', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });

      return false;
    }
  }

  /**
   * Get agent metrics
   */
  getAgentMetrics(): {
    explorer: ReturnType<typeof this.explorerAgent.getMetrics>;
    planner: ReturnType<typeof this.plannerAgent.getMetrics>;
    generator: ReturnType<typeof this.generatorAgent.getMetrics>;
  } {
    return {
      explorer: this.explorerAgent.getMetrics(),
      planner: this.plannerAgent.getMetrics(),
      generator: this.generatorAgent.getMetrics(),
    };
  }

  /**
   * Shutdown the workflow engine
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down exploration workflow');

    try {
      await this.cleanupAgents();
      logger.info('Exploration workflow shutdown completed');
    } catch (error) {
      logger.error('Error during workflow shutdown', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
