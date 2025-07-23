import { Agent } from '@mastra/core';
import { MonitoringService } from '../../monitoring';
import { ConfigManager } from '../../config';
import { ExplorationTarget, CrawlPlan, AgentCapabilities, AgentMetrics } from '../types';
export interface PlannerAgentConfig {
    monitoring?: MonitoringService;
    configManager?: ConfigManager;
    defaultStrategy?: 'breadth-first' | 'depth-first' | 'priority-based' | 'distributed';
    maxConcurrency?: number;
    planningTimeout?: number;
}
export interface PlanningContext {
    domain: string;
    objectives: string[];
    constraints: {
        timeLimit?: number;
        resourceLimit?: number;
        priorityAreas?: string[];
        excludedAreas?: string[];
    };
    previousResults?: {
        successfulPaths: string[];
        failedPaths: string[];
        performanceMetrics: Record<string, number>;
    };
}
export interface PlanOptimization {
    parallelization: {
        enabled: boolean;
        maxWorkers: number;
        balancingStrategy: 'round-robin' | 'least-loaded' | 'priority-based';
    };
    resourceAllocation: {
        memoryPerWorker: number;
        timeoutPerTask: number;
        retryAttempts: number;
    };
    prioritization: {
        highPriorityPatterns: string[];
        lowPriorityPatterns: string[];
        dynamicPrioritization: boolean;
    };
}
export declare class PlannerAgent extends Agent {
    private monitoring?;
    private configManager?;
    private config;
    private metrics;
    private activePlans;
    private planningHistory;
    constructor(config: PlannerAgentConfig);
    /**
     * Get agent capabilities
     */
    getCapabilities(): AgentCapabilities;
    /**
     * Get current agent metrics
     */
    getMetrics(): AgentMetrics;
    /**
     * Create an intelligent crawl plan based on targets and context
     */
    createPlan(targets: ExplorationTarget[], context: PlanningContext, optimization?: PlanOptimization): Promise<CrawlPlan>;
    /**
     * Optimize an existing plan based on real-time performance data
     */
    optimizePlan(planId: string, performanceData: Record<string, number>, completedTargets: string[]): Promise<CrawlPlan>;
    /**
     * Generate exploration recommendations based on domain analysis
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
     * Determine optimal crawling strategy based on targets and context
     */
    private determineOptimalStrategy;
    /**
     * Calculate resource requirements for the crawl plan
     */
    private calculateResourceRequirements;
    /**
     * Optimize the order of targets for exploration
     */
    private optimizeTargetOrder;
    /**
     * Sort targets by priority based on context
     */
    private sortByPriority;
    /**
     * Group targets for distributed processing
     */
    private groupForDistribution;
    /**
     * Sort targets by domain and complexity
     */
    private sortByDomainAndComplexity;
    /**
     * Calculate plan priority based on context
     */
    private calculatePlanPriority;
    /**
     * Analyze domain characteristics
     */
    private analyzeDomain;
    /**
     * Generate suggested targets based on domain analysis
     */
    private generateSuggestedTargets;
    /**
     * Get common paths for different site types
     */
    private getCommonPathsForType;
    /**
     * Get relevant patterns for different site types
     */
    private getPatternsForType;
    /**
     * Recommend strategy based on domain analysis
     */
    private recommendStrategy;
    /**
     * Estimate exploration duration
     */
    private estimateExplorationDuration;
    /**
     * Assess exploration risk
     */
    private assessExplorationRisk;
    /**
     * Analyze performance data for optimization
     */
    private analyzePerformanceData;
    /**
     * Adjust strategy based on performance analysis
     */
    private adjustStrategy;
    /**
     * Adjust resource allocation based on performance
     */
    private adjustResourceAllocation;
    /**
     * Update agent metrics
     */
    private updateMetrics;
    /**
     * Set up event handlers
     */
    private setupEventHandlers;
    /**
     * Clean up old plans to prevent memory leaks
     */
    private cleanupOldPlans;
    /**
     * Get plan status
     */
    getPlanStatus(planId: string): {
        exists: boolean;
        plan?: CrawlPlan;
        progress?: {
            completed: number;
            total: number;
            status: 'planning' | 'running' | 'completed' | 'failed';
        };
    };
    /**
     * Remove a completed plan
     */
    removePlan(planId: string): boolean;
    /**
     * Get all active plans
     */
    getActivePlans(): CrawlPlan[];
}
//# sourceMappingURL=PlannerAgent.d.ts.map