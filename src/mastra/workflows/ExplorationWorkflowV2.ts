import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { MonitoringService } from '../../monitoring';
import { ExplorerAgent } from '../agents/ExplorerAgent';
import { PlannerAgent } from '../agents/PlannerAgent';
import { GeneratorAgent } from '../agents/GeneratorAgent';
import {
  MastraWorkflow,
  WorkflowDefinition,
  WorkflowContext,
  createWorkflow,
  createStep,
} from './MastraWorkflow';
import {
  ExplorationTarget,
  ExplorationResult,
  CrawlPlan,
  TestGenerationRequest,
  TestGenerationResult,
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

export class ExplorationWorkflowV2 {
  private workflow: MastraWorkflow;
  private explorerAgent: ExplorerAgent;
  private plannerAgent: PlannerAgent;
  private generatorAgent: GeneratorAgent;
  private config: ExplorationWorkflowConfig;
  private monitoring?: MonitoringService;

  constructor(config: ExplorationWorkflowConfig) {
    this.config = config;
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

    // Create workflow definition
    const workflowDefinition = this.createWorkflowDefinition();
    this.workflow = new MastraWorkflow(workflowDefinition, config.monitoring);

    // Set up event handlers
    this.setupEventHandlers();
  }

  /**
   * Create the workflow definition with all steps
   */
  private createWorkflowDefinition(): WorkflowDefinition {
    return createWorkflow({
      name: 'Exploration Workflow',
      description: 'Complete web exploration workflow with planning, exploration, and test generation',
      version: '2.0.0',
      steps: [
        // Step 1: Validate and Initialize
        createStep({
          name: 'Initialize',
          description: 'Validate input and initialize workflow context',
          handler: async (input: ExplorationWorkflowInput, context: WorkflowContext) => {
            logger.debug('Initializing exploration workflow', {
              executionId: context.executionId,
              targetCount: input.targets.length,
            });

            // Validate input
            this.validateInput(input);

            // Initialize workflow state
            const sessionId = uuidv4();
            context.state.set('sessionId', sessionId);
            context.state.set('input', input);
            context.state.set('errors', []);

            // Record metrics
            this.monitoring?.recordCounter('workflow_started', 1);

            return {
              sessionId,
              initialized: true,
              targetCount: input.targets.length,
            };
          },
          retryPolicy: {
            maxAttempts: 3,
            delayMs: 1000,
          },
        }),

        // Step 2: Create Exploration Plan
        createStep({
          name: 'Plan Exploration',
          description: 'Create an optimized exploration plan using the Planner Agent',
          handler: async (_, context: WorkflowContext) => {
            const input = context.state.get('input') as ExplorationWorkflowInput;
            const sessionId = context.state.get('sessionId') as string;

            logger.debug('Creating exploration plan', {
              sessionId,
              targetCount: input.targets.length,
            });

            const planningContext = input.planningContext || {
              domain: input.targets[0]?.domain || 'unknown',
              objectives: ['comprehensive_exploration'],
              constraints: {},
            };

            const plan = await this.plannerAgent.createPlan(input.targets, planningContext);

            context.state.set('plan', plan);

            logger.info('Exploration plan created', {
              sessionId,
              planId: plan.id,
              strategy: plan.strategy,
              targetCount: plan.targets.length,
            });

            return plan;
          },
          retryPolicy: {
            maxAttempts: 3,
            delayMs: 2000,
            backoffMultiplier: 2,
          },
          timeout: 60000, // 1 minute
          onError: async (error, context) => {
            const errors = context.state.get('errors') as string[];
            errors.push(`Planning failed: ${error.message}`);
            logger.error('Failed to create exploration plan', { error: error.message });
          },
        }),

        // Step 3: Execute Exploration
        createStep({
          name: 'Execute Exploration',
          description: 'Execute the exploration plan using Explorer Agent',
          handler: async (plan: CrawlPlan, context: WorkflowContext) => {
            const sessionId = context.state.get('sessionId') as string;

            logger.debug('Starting exploration execution', {
              sessionId,
              planId: plan.id,
              strategy: plan.strategy,
            });

            const explorationResults: ExplorationResult[] = [];
            const { maxConcurrency } = plan.resources;

            // Execute based on strategy
            if (plan.strategy === 'distributed' && maxConcurrency > 1) {
              explorationResults.push(...(await this.executeParallelExploration(plan, sessionId)));
            } else {
              explorationResults.push(...(await this.executeSequentialExploration(plan, sessionId)));
            }

            context.state.set('explorationResults', explorationResults);

            // Calculate metrics
            const totalPagesExplored = explorationResults.reduce(
              (sum, result) => sum + result.pagesExplored,
              0
            );
            const successfulExplorations = explorationResults.filter(
              (r) => r.userPaths.length > 0
            ).length;
            const successRate =
              explorationResults.length > 0
                ? successfulExplorations / explorationResults.length
                : 0;

            context.state.set('totalPagesExplored', totalPagesExplored);
            context.state.set('successRate', successRate);

            logger.info('Exploration execution completed', {
              sessionId,
              resultsCount: explorationResults.length,
              pagesExplored: totalPagesExplored,
              successRate,
            });

            return explorationResults;
          },
          retryPolicy: {
            maxAttempts: 2,
            delayMs: 5000,
          },
          timeout: 300000, // 5 minutes
          onError: async (error, context) => {
            const errors = context.state.get('errors') as string[];
            errors.push(`Exploration failed: ${error.message}`);
            logger.error('Failed to execute exploration', { error: error.message });
          },
        }),

        // Step 4: Generate Tests (Conditional)
        createStep({
          name: 'Generate Tests',
          description: 'Generate test code from exploration results',
          condition: (context: WorkflowContext) => {
            const input = context.state.get('input') as ExplorationWorkflowInput;
            return this.config.enableTestGeneration === true && !!input.testGenerationOptions;
          },
          handler: async (explorationResults: ExplorationResult[], context: WorkflowContext) => {
            const input = context.state.get('input') as ExplorationWorkflowInput;
            const sessionId = context.state.get('sessionId') as string;

            if (!input.testGenerationOptions) {
              logger.debug('Skipping test generation - no options provided', { sessionId });
              return null;
            }

            const allUserPaths = explorationResults.flatMap((result) => result.userPaths);

            if (allUserPaths.length === 0) {
              logger.warn('No user paths found for test generation', { sessionId });
              return null;
            }

            logger.debug('Starting test generation', {
              sessionId,
              pathCount: allUserPaths.length,
            });

            const testGenRequest: TestGenerationRequest = {
              userPaths: allUserPaths,
              framework: input.testGenerationOptions.framework,
              language: input.testGenerationOptions.language,
              options: {
                generatePageObjects: input.testGenerationOptions.generatePageObjects,
                generateFixtures: input.testGenerationOptions.generateFixtures,
                generateHelpers: input.testGenerationOptions.generateHelpers,
                outputDirectory: this.config.outputDirectory || './generated-tests',
              },
            };

            const testResult = await this.generatorAgent.generateTests(testGenRequest);

            context.state.set('testGenerationResult', testResult);
            context.state.set('totalTestsGenerated', testResult.metrics.testsGenerated);

            logger.info('Test generation completed', {
              sessionId,
              testsGenerated: testResult.metrics.testsGenerated,
              linesOfCode: testResult.metrics.linesOfCode,
            });

            return testResult;
          },
          retryPolicy: {
            maxAttempts: 2,
            delayMs: 3000,
          },
          timeout: 120000, // 2 minutes
          onError: async (error, context) => {
            const errors = context.state.get('errors') as string[];
            errors.push(`Test generation failed: ${error.message}`);
            logger.error('Failed to generate tests', { error: error.message });
            // Don't fail the workflow for test generation errors
          },
        }),

        // Step 5: Finalize
        createStep({
          name: 'Finalize',
          description: 'Finalize workflow and prepare output',
          handler: async (_, context: WorkflowContext) => {
            const sessionId = context.state.get('sessionId') as string;
            const plan = context.state.get('plan') as CrawlPlan;
            const explorationResults = context.state.get('explorationResults') as ExplorationResult[];
            const testGenerationResult = context.state.get(
              'testGenerationResult'
            ) as TestGenerationResult | undefined;
            const errors = context.state.get('errors') as string[];

            const output: ExplorationWorkflowOutput = {
              sessionId,
              plan,
              explorationResults: explorationResults || [],
              testGenerationResult,
              metadata: {
                totalDuration: 0, // Will be set by workflow
                totalPagesExplored: context.state.get('totalPagesExplored') || 0,
                totalTestsGenerated: context.state.get('totalTestsGenerated') || 0,
                successRate: context.state.get('successRate') || 0,
                errors,
              },
            };

            context.state.set('final_output', output);

            // Cleanup resources
            await this.cleanupAgents();

            logger.debug('Workflow finalized', {
              sessionId,
              errorCount: errors.length,
            });

            return output;
          },
        }),
      ],
      onStart: async (context: WorkflowContext) => {
        logger.info('Exploration workflow started', {
          executionId: context.executionId,
          workflowId: context.workflowId,
        });
      },
      onComplete: async (context: WorkflowContext) => {
        const output = context.state.get('final_output') as ExplorationWorkflowOutput;
        if (output) {
          output.metadata.totalDuration = Date.now() - context.startTime.getTime();
        }

        this.monitoring?.recordHistogram('workflow_duration', Date.now() - context.startTime.getTime());
        this.monitoring?.recordGauge('workflow_success_rate', output?.metadata.successRate || 0);

        logger.info('Exploration workflow completed', {
          executionId: context.executionId,
          duration: Date.now() - context.startTime.getTime(),
        });
      },
      onError: async (error: Error, context: WorkflowContext) => {
        logger.error('Exploration workflow failed', {
          executionId: context.executionId,
          error: error.message,
        });

        this.monitoring?.recordCounter('workflow_errors', 1);

        // Ensure cleanup happens even on error
        await this.cleanupAgents();
      },
    });
  }

  /**
   * Execute the exploration workflow
   */
  async execute(input: ExplorationWorkflowInput): Promise<ExplorationWorkflowOutput> {
    const result = await this.workflow.execute(input);

    if (result.status === 'failed') {
      throw result.error || new Error('Workflow execution failed');
    }

    return result.output as ExplorationWorkflowOutput;
  }

  /**
   * Validate workflow input
   */
  private validateInput(input: ExplorationWorkflowInput): void {
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
   * Execute parallel exploration
   */
  private async executeParallelExploration(
    plan: CrawlPlan,
    sessionId: string
  ): Promise<ExplorationResult[]> {
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
              sessionId,
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
          sessionId,
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
  private async executeSequentialExploration(
    plan: CrawlPlan,
    sessionId: string
  ): Promise<ExplorationResult[]> {
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
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        });

        // Continue with next target
        continue;
      }
    }

    return results;
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
   * Set up event handlers for workflow events
   */
  private setupEventHandlers(): void {
    this.workflow.on('workflow:started', ({ executionId, workflowId }) => {
      logger.debug('Workflow started event', { executionId, workflowId });
      this.monitoring?.recordCounter('workflow_events', 1, { event: 'started' });
    });

    this.workflow.on('workflow:completed', (result) => {
      logger.debug('Workflow completed event', {
        executionId: result.executionId,
        duration: result.duration,
      });
      this.monitoring?.recordCounter('workflow_events', 1, { event: 'completed' });
    });

    this.workflow.on('workflow:failed', (result) => {
      logger.error('Workflow failed event', {
        executionId: result.executionId,
        error: result.error?.message,
      });
      this.monitoring?.recordCounter('workflow_events', 1, { event: 'failed' });
    });

    this.workflow.on('step:started', ({ executionId, stepId }) => {
      logger.debug('Step started', { executionId, stepId });
    });

    this.workflow.on('step:completed', ({ executionId, stepId, result }) => {
      logger.debug('Step completed', {
        executionId,
        stepId,
        duration: result.duration,
      });
    });

    this.workflow.on('step:failed', ({ executionId, stepId, result }) => {
      logger.warn('Step failed', {
        executionId,
        stepId,
        error: result.error?.message,
        attempts: result.attempts,
      });
    });
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(executionId: string): {
    exists: boolean;
    status?: 'running' | 'completed' | 'failed';
    currentStep?: string;
    progress?: number;
    errors?: string[];
  } {
    const status = this.workflow.getExecutionStatus(executionId);

    if (!status.exists) {
      return { exists: false };
    }

    return {
      exists: true,
      status: 'running',
      currentStep: status.currentStep,
      // Progress calculation would need to be implemented based on step completion
      progress: 0,
      errors: [],
    };
  }

  /**
   * Cancel a running workflow
   */
  async cancelWorkflow(executionId: string): Promise<boolean> {
    return this.workflow.cancel(executionId);
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