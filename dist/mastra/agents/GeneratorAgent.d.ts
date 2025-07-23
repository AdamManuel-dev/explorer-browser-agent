import { Agent } from '@mastra/core/agent';
import { MonitoringService } from '../../monitoring';
import { TestGenerationRequest, TestGenerationResult, AgentCapabilities, AgentMetrics } from '../types';
import { UserPath } from '../../types/recording';
export interface GeneratorAgentConfig {
    monitoring?: MonitoringService;
    outputDirectory?: string;
    defaultFramework?: 'playwright' | 'cypress' | 'selenium';
    defaultLanguage?: 'typescript' | 'javascript' | 'python' | 'java';
    maxConcurrentGenerations?: number;
    cacheEnabled?: boolean;
    qualityThresholds?: {
        minLintScore: number;
        minTestCoverage: number;
        maxComplexity: number;
    };
}
export interface GenerationJob {
    id: string;
    request: TestGenerationRequest;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    startTime: Date;
    endTime?: Date;
    result?: TestGenerationResult;
    error?: string;
}
export interface GenerationTemplate {
    id: string;
    name: string;
    framework: string;
    language: string;
    templates: {
        test: string;
        pageObject: string;
        fixture: string;
        helper: string;
        config: string;
    };
    customHandlers?: Record<string, Function>;
}
export declare class GeneratorAgent extends Agent {
    private monitoring?;
    private testGenerator;
    private pageObjectGenerator;
    private testFileWriter;
    private testValidator;
    private config;
    private metrics;
    private activeJobs;
    private templates;
    private generationCache;
    constructor(config: GeneratorAgentConfig);
    /**
     * Get agent capabilities
     */
    getCapabilities(): AgentCapabilities;
    /**
     * Get current agent metrics
     */
    getMetrics(): AgentMetrics;
    /**
     * Generate tests from user paths with intelligent optimization
     */
    generateTests(request: TestGenerationRequest): Promise<TestGenerationResult>;
    /**
     * Get generation job status
     */
    getJobStatus(jobId: string): GenerationJob | null;
    /**
     * Cancel a running generation job
     */
    cancelJob(jobId: string): Promise<boolean>;
    /**
     * Register a custom generation template
     */
    registerTemplate(template: GenerationTemplate): void;
    /**
     * Optimize test generation for better maintainability
     */
    optimizeGeneration(userPaths: UserPath[]): Promise<{
        recommendations: string[];
        optimizations: {
            pageObjectConsolidation: string[];
            duplicateTestElimination: string[];
            helperExtractions: string[];
        };
        estimatedImprovement: {
            maintainability: number;
            performance: number;
            coverage: number;
        };
    }>;
    /**
     * Analyze user paths to identify patterns and optimization opportunities
     */
    private analyzeUserPaths;
    /**
     * Generate page object files
     */
    private generatePageObjects;
    /**
     * Generate test fixture files
     */
    private generateFixtures;
    /**
     * Generate helper utility files
     */
    private generateHelpers;
    /**
     * Generate main test files
     */
    private generateTestFiles;
    /**
     * Generate configuration files
     */
    private generateConfigFiles;
    /**
     * Validate generated code quality
     */
    private validateGeneratedCode;
    /**
     * Write generated files to disk
     */
    private writeFilesToDisk;
    /**
     * Generate cache key for request
     */
    private generateCacheKey;
    /**
     * Calculate generation metrics
     */
    private calculateGenerationMetrics;
    /**
     * Assess code quality
     */
    private assessCodeQuality;
    /**
     * Group paths by domain
     */
    private groupPathsByDomain;
    /**
     * Generate page object name from domain
     */
    private generatePageObjectName;
    /**
     * Get file extension for language
     */
    private getFileExtension;
    /**
     * Extract test data from user paths
     */
    private extractTestData;
    /**
     * Generate fixture content
     */
    private generateFixtureContent;
    /**
     * Generate user fixtures
     */
    private generateUserFixtures;
    /**
     * Find common operations in user paths
     */
    private findCommonOperations;
    /**
     * Check if authentication helper is needed
     */
    private needsAuthHelper;
    /**
     * Generate authentication helper
     */
    private generateAuthHelper;
    /**
     * Generate navigation helper
     */
    private generateNavigationHelper;
    /**
     * Check if form helper is needed
     */
    private needsFormHelper;
    /**
     * Generate form helper
     */
    private generateFormHelper;
    /**
     * Generate custom helper
     */
    private generateCustomHelper;
    /**
     * Generate helper template
     */
    private generateHelperTemplate;
    /**
     * Generate custom helper content
     */
    private generateCustomHelperContent;
    /**
     * Group paths into test suites
     */
    private groupPathsIntoTestSuites;
    /**
     * Find duplicate patterns
     */
    private findDuplicatePatterns;
    /**
     * Generate Playwright config
     */
    private generatePlaywrightConfig;
    /**
     * Generate Cypress config
     */
    private generateCypressConfig;
    /**
     * Generate package config
     */
    private generatePackageConfig;
    /**
     * Get framework dependencies
     */
    private getFrameworkDependencies;
    /**
     * Load default templates
     */
    private loadDefaultTemplates;
    /**
     * Update agent metrics
     */
    private updateMetrics;
    /**
     * Set up event handlers
     */
    private setupEventHandlers;
    /**
     * Clean up old jobs
     */
    private cleanupOldJobs;
    /**
     * Get all active jobs
     */
    getActiveJobs(): GenerationJob[];
    /**
     * Clear cache
     */
    clearCache(): void;
}
//# sourceMappingURL=GeneratorAgent.d.ts.map