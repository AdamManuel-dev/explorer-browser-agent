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
    input: any;
    output: any;
    metadata: WorkflowMetadata;
}
declare abstract class Workflow<TInput, TOutput> {
    protected config: WorkflowConfig;
    private steps;
    constructor(config: WorkflowConfig);
    protected addStep(name: string, handler: (context: WorkflowContext) => Promise<void>): void;
    protected executeStep(stepName: string, context: WorkflowContext): Promise<void>;
    abstract execute(input: TInput): Promise<TOutput>;
}
import { MonitoringService } from '../../monitoring';
import { ExplorationTarget, ExplorationResult, CrawlPlan, TestGenerationResult, BrowserbaseConfig, StagehandConfig } from '../types';
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
export declare class ExplorationWorkflow extends Workflow<ExplorationWorkflowInput, ExplorationWorkflowOutput> {
    private explorerAgent;
    private plannerAgent;
    private generatorAgent;
    private monitoring?;
    private config;
    constructor(config: ExplorationWorkflowConfig);
    /**
     * Define the workflow steps
     */
    private defineWorkflowSteps;
    /**
     * Execute the complete exploration workflow
     */
    execute(input: ExplorationWorkflowInput): Promise<ExplorationWorkflowOutput>;
    /**
     * Step 1: Initialize workflow context
     */
    private initializeWorkflow;
    /**
     * Step 2: Create exploration plan
     */
    private createExplorationPlan;
    /**
     * Step 3: Execute exploration
     */
    private executeExploration;
    /**
     * Step 4: Generate tests (optional)
     */
    private generateTests;
    /**
     * Step 5: Finalize workflow
     */
    private finalizeWorkflow;
    /**
     * Handle workflow errors
     */
    private handleWorkflowError;
    /**
     * Execute parallel exploration
     */
    private executeParallelExploration;
    /**
     * Execute sequential exploration
     */
    private executeSequentialExploration;
    /**
     * Validate workflow input
     */
    private validateInput;
    /**
     * Cleanup agents
     */
    private cleanupAgents;
    /**
     * Get workflow status
     */
    getWorkflowStatus(_sessionId: string): {
        exists: boolean;
        status?: 'running' | 'completed' | 'failed';
        currentStep?: string;
        progress?: number;
        errors?: string[];
    };
    /**
     * Cancel a running workflow
     */
    cancelWorkflow(sessionId: string): Promise<boolean>;
    /**
     * Get agent metrics
     */
    getAgentMetrics(): {
        explorer: any;
        planner: any;
        generator: any;
    };
    /**
     * Shutdown the workflow engine
     */
    shutdown(): Promise<void>;
}
export {};
//# sourceMappingURL=ExplorationWorkflow.d.ts.map