import { Agent } from '@mastra/core/agent';
import { Page } from 'playwright';
import { MonitoringService } from '../../monitoring';
import { StealthMode } from '../../stealth';
import { CaptchaHandler } from '../../captcha';
import { MultiStrategyAuthManager } from '../../auth';
import { BrowserbaseConfig, StagehandConfig, ExplorationTarget, ExplorationResult, ExplorationStep, ElementInfo, AgentCapabilities, AgentMetrics } from '../types';
export interface ExplorerAgentConfig {
    browserbase: BrowserbaseConfig;
    stagehand: StagehandConfig;
    monitoring?: MonitoringService;
    stealth?: StealthMode;
    captchaHandler?: CaptchaHandler;
    authManager?: MultiStrategyAuthManager;
    maxConcurrentSessions?: number;
    defaultTimeout?: number;
    screenshotQuality?: number;
}
export declare class ExplorerAgent extends Agent {
    private browserbase;
    private stagehand;
    private monitoring?;
    private stealth?;
    private captchaHandler?;
    private authManager?;
    private sessions;
    private activePaths;
    private config;
    private metrics;
    constructor(config: ExplorerAgentConfig);
    /**
     * Get agent capabilities
     */
    getCapabilities(): AgentCapabilities;
    /**
     * Get current agent metrics
     */
    getMetrics(): AgentMetrics;
    /**
     * Explore a target website using AI-guided navigation
     */
    explore(target: ExplorationTarget): Promise<ExplorationResult>;
    /**
     * Extract elements from a page using AI-powered detection
     */
    extractElements(page: Page, selectors?: string[]): Promise<ElementInfo[]>;
    /**
     * Perform AI-guided interaction with an element
     */
    interactWithElement(page: Page, instruction: string): Promise<ExplorationStep>;
    /**
     * Navigate to a URL with error handling and monitoring
     */
    navigateToUrl(page: Page, url: string): Promise<ExplorationStep>;
    /**
     * Create a new Browserbase session
     */
    private createBrowserbaseSession;
    /**
     * Initialize Stagehand with a Browserbase session
     */
    private initializeStagehand;
    /**
     * Perform AI-guided exploration of a target
     */
    private performAIGuidedExploration;
    /**
     * Handle authentication for the target
     */
    private handleAuthentication;
    /**
     * Analyze an element to extract detailed information
     */
    private analyzeElement;
    /**
     * Take a screenshot of the current page
     */
    private takeScreenshot;
    /**
     * Filter elements based on target patterns
     */
    private filterElementsByPatterns;
    /**
     * Check if a URL is relevant for exploration
     */
    private isRelevantUrl;
    /**
     * Infer step type from instruction
     */
    private inferStepType;
    /**
     * Clean up a browser session
     */
    private cleanupSession;
    /**
     * Update agent metrics
     */
    private updateMetrics;
    /**
     * Set up event handlers for monitoring and logging
     */
    private setupEventHandlers;
    /**
     * Graceful shutdown
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=ExplorerAgent.d.ts.map