interface WorkflowConfig {
  name: string;
  description: string;
  version: string;
}

interface WorkflowMetadata {
  startTime: Date;
  currentStep: string;
  errors: string[];
}

interface WorkflowContext {
  sessionId: string;
  input: unknown;
  output: unknown;
  metadata: WorkflowMetadata;
}

export abstract class Workflow<TInput, TOutput> {
  protected config: WorkflowConfig;

  private steps: Map<string, (context: WorkflowContext) => Promise<void>> = new Map();

  constructor(config: WorkflowConfig) {
    this.config = config;
  }

  protected addStep(name: string, handler: (context: WorkflowContext) => Promise<void>): void {
    this.steps.set(name, handler);
  }

  protected async executeStep(stepName: string, context: WorkflowContext): Promise<void> {
    const step = this.steps.get(stepName);
    if (!step) {
      throw new Error(`Step '${stepName}' not found`);
    }
    context.metadata.currentStep = stepName;
    await step(context);
  }

  abstract execute(input: TInput): Promise<TOutput>;
}
