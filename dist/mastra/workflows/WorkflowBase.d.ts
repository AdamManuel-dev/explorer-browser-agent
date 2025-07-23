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
export declare abstract class Workflow<TInput, TOutput> {
    protected config: WorkflowConfig;
    private steps;
    constructor(config: WorkflowConfig);
    protected addStep(name: string, handler: (context: WorkflowContext) => Promise<void>): void;
    protected executeStep(stepName: string, context: WorkflowContext): Promise<void>;
    abstract execute(input: TInput): Promise<TOutput>;
}
export {};
//# sourceMappingURL=WorkflowBase.d.ts.map