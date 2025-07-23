import { MonitoringService } from '../monitoring';
import { ConfigManager } from '../config';
import { BrowserbaseConfig, StagehandConfig, ExplorationTarget, ExplorationWorkflowOutput } from './types';
export interface MastraOrchestratorConfig {
    browserbase: BrowserbaseConfig;
    stagehand: StagehandConfig;
    monitoring?: MonitoringService;
    configManager?: ConfigManager;
    maxConcurrentWorkflows?: number;
    outputDirectory?: string;
    enableTestGeneration?: boolean;
    retryAttempts?: number;
    defaultTimeout?: number;
}
export interface ExplorationRequest {
    id?: string;
    name: string;
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
    schedule?: {
        startAt?: Date;
        interval?: string;
        maxRuns?: number;
    };
    notifications?: {
        onComplete?: string[];
        onError?: string[];
    };
}
export interface ExplorationSession {
    id: string;
    request: ExplorationRequest;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    startTime: Date;
    endTime?: Date;
    progress: {
        currentStep: string;
        percentage: number;
        estimatedTimeRemaining?: number;
    };
    results?: ExplorationWorkflowOutput;
    error?: string;
}
export declare class MastraOrchestrator {
    private mastraEngine;
    private workflowEngine;
    private explorationWorkflow;
    private monitoring?;
    private configManager?;
    private config;
    private activeSessions;
    private scheduledSessions;
    constructor(config: MastraOrchestratorConfig);
    /**
     * Initialize the orchestrator
     */
    private initializeOrchestrator;
    /**
     * Start an exploration session
     */
    startExploration(request: ExplorationRequest): Promise<string>;
    /**
     * Get exploration session status
     */
    getExplorationStatus(sessionId: string): ExplorationSession | null;
    /**
     * Cancel an exploration session
     */
    cancelExploration(sessionId: string): Promise<boolean>;
    /**
     * Get all active exploration sessions
     */
    getActiveSessions(): ExplorationSession[];
    /**
     * Get exploration session history
     */
    getSessionHistory(limit?: number): ExplorationSession[];
    /**
     * Get system metrics
     */
    getSystemMetrics(): {
        activeSessions: number;
        completedSessions: number;
        failedSessions: number;
        totalSessions: number;
        averageSessionDuration: number;
        systemHealth: 'healthy' | 'degraded' | 'unhealthy';
        agentMetrics: any;
    };
    /**
     * Generate exploration recommendations
     */
    generateRecommendations(domain: string): Promise<{
        suggestedTargets: ExplorationTarget[];
        strategy: string;
        estimatedDuration: number;
        riskAssessment: {
            level: 'low' | 'medium' | 'high';
            factors: string[];
            mitigations: string[];
        };
    }>;
    /**
     * Execute exploration session
     */
    private executeExploration;
    /**
     * Schedule exploration for later execution
     */
    private scheduleExploration;
    /**
     * Validate exploration request
     */
    private validateExplorationRequest;
    /**
     * Send notifications
     */
    private sendNotifications;
    /**
     * Setup event handlers
     */
    private setupEventHandlers;
    /**
     * Clean up old sessions
     */
    private cleanupOldSessions;
    /**
     * Health check
     */
    healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        details: {
            mastraEngine: boolean;
            workflowEngine: boolean;
            activeSessions: number;
            systemMetrics: any;
        };
    }>;
    /**
     * Graceful shutdown
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=MastraOrchestrator.d.ts.map