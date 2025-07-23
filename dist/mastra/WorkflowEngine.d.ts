interface WorkflowEngineConfig {
    maxConcurrentWorkflows: number;
    retryAttempts: number;
    defaultTimeout: number;
}
export declare class WorkflowEngine {
    private config;
    private workflows;
    private eventHandlers;
    private isStarted;
    constructor(config: WorkflowEngineConfig);
    registerWorkflow(name: string, workflow: unknown): void;
    start(): Promise<void>;
    stop(): Promise<void>;
    on(event: string, handler: Function): void;
    private emit;
}
export {};
//# sourceMappingURL=WorkflowEngine.d.ts.map