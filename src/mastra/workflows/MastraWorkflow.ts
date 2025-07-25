import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { MonitoringService } from '../../monitoring';

export interface WorkflowStep<TInput = any, TOutput = any> {
  id: string;
  name: string;
  description?: string;
  handler: (input: TInput, context: WorkflowContext) => Promise<TOutput>;
  retryPolicy?: {
    maxAttempts: number;
    delayMs: number;
    backoffMultiplier?: number;
  };
  timeout?: number;
  condition?: (context: WorkflowContext) => boolean;
  onError?: (error: Error, context: WorkflowContext) => Promise<void>;
  onSuccess?: (output: TOutput, context: WorkflowContext) => Promise<void>;
}

export interface WorkflowContext {
  workflowId: string;
  executionId: string;
  input: any;
  state: Map<string, any>;
  metadata: Map<string, any>;
  errors: Error[];
  startTime: Date;
  currentStep?: string;
  previousStepOutput?: any;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  steps: WorkflowStep[];
  onStart?: (context: WorkflowContext) => Promise<void>;
  onComplete?: (context: WorkflowContext) => Promise<void>;
  onError?: (error: Error, context: WorkflowContext) => Promise<void>;
}

export interface WorkflowExecutionResult {
  executionId: string;
  workflowId: string;
  status: 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime: Date;
  duration: number;
  output?: any;
  error?: Error;
  stepResults: Map<string, StepExecutionResult>;
}

export interface StepExecutionResult {
  stepId: string;
  status: 'completed' | 'failed' | 'skipped';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  output?: any;
  error?: Error;
  attempts: number;
}

export class MastraWorkflow extends EventEmitter {
  private definition: WorkflowDefinition;
  private monitoring?: MonitoringService;
  private activeExecutions: Map<string, WorkflowContext> = new Map();

  constructor(definition: WorkflowDefinition, monitoring?: MonitoringService) {
    super();
    this.definition = definition;
    this.monitoring = monitoring;
  }

  /**
   * Execute the workflow with the given input
   */
  async execute(input: any): Promise<WorkflowExecutionResult> {
    const executionId = uuidv4();
    const startTime = new Date();
    const spanId = this.monitoring?.startSpan('workflow_execution', undefined);

    const context: WorkflowContext = {
      workflowId: this.definition.id,
      executionId,
      input,
      state: new Map(),
      metadata: new Map(),
      errors: [],
      startTime,
    };

    this.activeExecutions.set(executionId, context);
    const stepResults = new Map<string, StepExecutionResult>();

    try {
      logger.info('Starting workflow execution', {
        workflowId: this.definition.id,
        executionId,
        workflowName: this.definition.name,
      });

      this.emit('workflow:started', { executionId, workflowId: this.definition.id });

      // Execute onStart hook if defined
      if (this.definition.onStart) {
        await this.definition.onStart(context);
      }

      // Execute steps sequentially
      for (const step of this.definition.steps) {
        const stepResult = await this.executeStep(step, context);
        stepResults.set(step.id, stepResult);

        if (stepResult.status === 'failed' && !step.onError) {
          // If step failed and no error handler, fail the workflow
          throw stepResult.error || new Error(`Step ${step.id} failed`);
        }

        // Store step output in context for next steps
        context.previousStepOutput = stepResult.output;
        context.state.set(step.id, stepResult.output);
      }

      // Execute onComplete hook if defined
      if (this.definition.onComplete) {
        await this.definition.onComplete(context);
      }

      const endTime = new Date();
      const result: WorkflowExecutionResult = {
        executionId,
        workflowId: this.definition.id,
        status: 'completed',
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        output: context.state.get('final_output') || context.previousStepOutput,
        stepResults,
      };

      this.emit('workflow:completed', result);
      this.monitoring?.recordCounter('workflow_completed', 1, { status: 'success' });

      logger.info('Workflow execution completed', {
        workflowId: this.definition.id,
        executionId,
        duration: result.duration,
      });

      return result;
    } catch (error) {
      const endTime = new Date();
      const workflowError = error instanceof Error ? error : new Error(String(error));

      // Execute onError hook if defined
      if (this.definition.onError) {
        await this.definition.onError(workflowError, context);
      }

      const result: WorkflowExecutionResult = {
        executionId,
        workflowId: this.definition.id,
        status: 'failed',
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        error: workflowError,
        stepResults,
      };

      this.emit('workflow:failed', result);
      this.monitoring?.recordCounter('workflow_completed', 1, { status: 'error' });

      logger.error('Workflow execution failed', {
        workflowId: this.definition.id,
        executionId,
        error: workflowError.message,
      });

      throw workflowError;
    } finally {
      this.activeExecutions.delete(executionId);
      if (spanId) {
        this.monitoring?.endSpan(spanId);
      }
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<StepExecutionResult> {
    const startTime = new Date();
    const spanId = this.monitoring?.startSpan('workflow_step', undefined);
    context.currentStep = step.id;

    try {
      logger.debug('Executing workflow step', {
        workflowId: context.workflowId,
        executionId: context.executionId,
        stepId: step.id,
        stepName: step.name,
      });

      this.emit('step:started', { executionId: context.executionId, stepId: step.id });

      // Check condition if defined
      if (step.condition && !step.condition(context)) {
        logger.debug('Step condition not met, skipping', {
          stepId: step.id,
        });

        return {
          stepId: step.id,
          status: 'skipped',
          startTime,
          attempts: 0,
        };
      }

      // Execute step with retry logic
      const retryPolicy = step.retryPolicy || { maxAttempts: 1, delayMs: 0 };
      let lastError: Error | undefined;
      let attempts = 0;

      for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt++) {
        attempts = attempt;

        try {
          // Create step input from context
          const stepInput = this.prepareStepInput(step, context);

          // Execute step handler with timeout
          const output = await this.executeWithTimeout(
            step.handler(stepInput, context),
            step.timeout || 30000 // Default 30s timeout
          );

          // Execute onSuccess hook if defined
          if (step.onSuccess) {
            await step.onSuccess(output, context);
          }

          const endTime = new Date();
          const result: StepExecutionResult = {
            stepId: step.id,
            status: 'completed',
            startTime,
            endTime,
            duration: endTime.getTime() - startTime.getTime(),
            output,
            attempts,
          };

          this.emit('step:completed', {
            executionId: context.executionId,
            stepId: step.id,
            result,
          });

          logger.debug('Workflow step completed', {
            stepId: step.id,
            duration: result.duration,
            attempts,
          });

          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          logger.warn('Step execution failed', {
            stepId: step.id,
            attempt,
            maxAttempts: retryPolicy.maxAttempts,
            error: lastError.message,
          });

          if (attempt < retryPolicy.maxAttempts) {
            // Calculate delay with backoff
            const delay =
              retryPolicy.delayMs * Math.pow(retryPolicy.backoffMultiplier || 1, attempt - 1);
            await this.delay(delay);
          }
        }
      }

      // All attempts failed
      if (step.onError && lastError) {
        await step.onError(lastError, context);
      }

      const endTime = new Date();
      const result: StepExecutionResult = {
        stepId: step.id,
        status: 'failed',
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        error: lastError,
        attempts,
      };

      this.emit('step:failed', {
        executionId: context.executionId,
        stepId: step.id,
        result,
      });

      return result;
    } finally {
      if (spanId) {
        this.monitoring?.endSpan(spanId);
      }
    }
  }

  /**
   * Prepare input for a step based on context
   */
  private prepareStepInput(step: WorkflowStep, context: WorkflowContext): any {
    // By default, pass the previous step's output
    // Steps can override this by accessing context directly
    return context.previousStepOutput || context.input;
  }

  /**
   * Execute a promise with timeout
   */
  private async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Cancel a running workflow execution
   */
  async cancel(executionId: string): Promise<boolean> {
    const context = this.activeExecutions.get(executionId);

    if (!context) {
      logger.warn('Attempted to cancel non-existent execution', { executionId });
      return false;
    }

    logger.info('Cancelling workflow execution', {
      workflowId: context.workflowId,
      executionId,
    });

    this.emit('workflow:cancelled', { executionId, workflowId: context.workflowId });
    this.activeExecutions.delete(executionId);

    return true;
  }

  /**
   * Get the status of a workflow execution
   */
  getExecutionStatus(executionId: string): { exists: boolean; currentStep?: string } {
    const context = this.activeExecutions.get(executionId);

    if (!context) {
      return { exists: false };
    }

    return {
      exists: true,
      currentStep: context.currentStep,
    };
  }

  /**
   * Get workflow definition
   */
  getDefinition(): WorkflowDefinition {
    return this.definition;
  }

  /**
   * Get active executions count
   */
  getActiveExecutionsCount(): number {
    return this.activeExecutions.size;
  }
}

/**
 * Helper function to create a workflow step
 */
export function createStep<TInput = any, TOutput = any>(
  config: Omit<WorkflowStep<TInput, TOutput>, 'id'>
): WorkflowStep<TInput, TOutput> {
  return {
    id: config.name.toLowerCase().replace(/\s+/g, '_'),
    ...config,
  };
}

/**
 * Helper function to create a workflow definition
 */
export function createWorkflow(config: Omit<WorkflowDefinition, 'id'>): WorkflowDefinition {
  return {
    id: config.name.toLowerCase().replace(/\s+/g, '_'),
    ...config,
  };
}