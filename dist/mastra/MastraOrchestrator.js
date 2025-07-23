"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MastraOrchestrator = void 0;
const core_1 = require("@mastra/core");
class WorkflowEngine {
    config;
    workflows = new Map();
    eventHandlers = new Map();
    isStarted = false;
    constructor(config) {
        this.config = config;
    }
    registerWorkflow(name, workflow) {
        this.workflows.set(name, workflow);
    }
    async start() {
        this.isStarted = true;
    }
    async stop() {
        this.isStarted = false;
    }
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }
    emit(event, ...args) {
        const handlers = this.eventHandlers.get(event) || [];
        handlers.forEach(handler => handler(...args));
    }
}
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
const PlannerAgent_1 = require("./agents/PlannerAgent");
const ExplorationWorkflow_1 = require("./workflows/ExplorationWorkflow");
class MastraOrchestrator {
    mastraEngine;
    workflowEngine;
    explorationWorkflow;
    monitoring;
    configManager;
    config;
    activeSessions = new Map();
    scheduledSessions = new Map();
    constructor(config) {
        this.config = config;
        this.monitoring = config.monitoring;
        this.configManager = config.configManager;
        // Initialize Mastra engine
        this.mastraEngine = new core_1.MastraEngine({
            name: 'BrowserExplorer',
            version: '1.0.0',
            description: 'AI-powered web exploration and test generation platform',
        });
        // Initialize workflow engine
        this.workflowEngine = new WorkflowEngine({
            maxConcurrentWorkflows: config.maxConcurrentWorkflows || 5,
            retryAttempts: config.retryAttempts || 3,
            defaultTimeout: config.defaultTimeout || 300000, // 5 minutes
        });
        // Initialize exploration workflow
        this.explorationWorkflow = new ExplorationWorkflow_1.ExplorationWorkflow({
            browserbase: config.browserbase,
            stagehand: config.stagehand,
            monitoring: config.monitoring,
            maxConcurrentExplorations: config.maxConcurrentWorkflows || 5,
            defaultTimeout: config.defaultTimeout || 30000,
            enableTestGeneration: config.enableTestGeneration || true,
            outputDirectory: config.outputDirectory || './generated-tests',
        });
        this.setupEventHandlers();
        this.initializeOrchestrator();
    }
    /**
     * Initialize the orchestrator
     */
    async initializeOrchestrator() {
        try {
            logger_1.logger.info('Initializing Mastra orchestrator');
            // Register workflow with the workflow engine
            this.workflowEngine.registerWorkflow('exploration', this.explorationWorkflow);
            // Start the engines
            await this.mastraEngine.start();
            await this.workflowEngine.start();
            logger_1.logger.info('Mastra orchestrator initialized successfully');
            // Record initialization metric
            this.monitoring?.recordCounter('orchestrator_initialized', 1);
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize Mastra orchestrator', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    /**
     * Start an exploration session
     */
    async startExploration(request) {
        const sessionId = request.id || (0, uuid_1.v4)();
        const startTime = new Date();
        const spanId = this.monitoring?.startSpan('orchestrator_start_exploration');
        try {
            logger_1.logger.info('Starting exploration session', {
                sessionId,
                name: request.name,
                targetCount: request.targets.length,
            });
            // Validate request
            this.validateExplorationRequest(request);
            // Check concurrency limits
            const runningSessions = Array.from(this.activeSessions.values()).filter((session) => session.status === 'running').length;
            if (runningSessions >= (this.config.maxConcurrentWorkflows || 5)) {
                throw new Error('Maximum concurrent explorations limit reached');
            }
            // Create session
            const session = {
                id: sessionId,
                request,
                status: 'pending',
                startTime,
                progress: {
                    currentStep: 'initializing',
                    percentage: 0,
                },
            };
            this.activeSessions.set(sessionId, session);
            // Handle scheduling if specified
            if (request.schedule?.startAt && request.schedule.startAt > new Date()) {
                await this.scheduleExploration(session);
                return sessionId;
            }
            // Start exploration immediately
            this.executeExploration(session);
            this.monitoring?.recordCounter('explorations_started', 1);
            logger_1.logger.info('Exploration session started', {
                sessionId,
                status: session.status,
            });
            return sessionId;
        }
        catch (error) {
            logger_1.logger.error('Failed to start exploration session', {
                sessionId,
                error: error instanceof Error ? error.message : String(error),
            });
            this.monitoring?.recordCounter('exploration_start_errors', 1);
            throw error;
        }
        finally {
            if (spanId) {
                this.monitoring?.endSpan(spanId);
            }
        }
    }
    /**
     * Get exploration session status
     */
    getExplorationStatus(sessionId) {
        return this.activeSessions.get(sessionId) || null;
    }
    /**
     * Cancel an exploration session
     */
    async cancelExploration(sessionId) {
        const spanId = this.monitoring?.startSpan('orchestrator_cancel_exploration');
        try {
            const session = this.activeSessions.get(sessionId);
            if (!session) {
                logger_1.logger.warn('Attempted to cancel non-existent session', { sessionId });
                return false;
            }
            if (session.status === 'completed' || session.status === 'failed') {
                logger_1.logger.warn('Attempted to cancel already finished session', {
                    sessionId,
                    status: session.status,
                });
                return false;
            }
            logger_1.logger.info('Cancelling exploration session', {
                sessionId,
                currentStatus: session.status,
            });
            // Cancel scheduled session if applicable
            const scheduledTimeout = this.scheduledSessions.get(sessionId);
            if (scheduledTimeout) {
                clearTimeout(scheduledTimeout);
                this.scheduledSessions.delete(sessionId);
            }
            // Cancel running workflow
            if (session.status === 'running') {
                await this.explorationWorkflow.cancelWorkflow(sessionId);
            }
            // Update session status
            session.status = 'cancelled';
            session.endTime = new Date();
            this.monitoring?.recordCounter('explorations_cancelled', 1);
            logger_1.logger.info('Exploration session cancelled', { sessionId });
            return true;
        }
        catch (error) {
            logger_1.logger.error('Failed to cancel exploration session', {
                sessionId,
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
        finally {
            if (spanId) {
                this.monitoring?.endSpan(spanId);
            }
        }
    }
    /**
     * Get all active exploration sessions
     */
    getActiveSessions() {
        return Array.from(this.activeSessions.values()).filter((session) => session.status === 'pending' || session.status === 'running');
    }
    /**
     * Get exploration session history
     */
    getSessionHistory(limit = 50) {
        return Array.from(this.activeSessions.values())
            .filter((session) => session.status === 'completed' ||
            session.status === 'failed' ||
            session.status === 'cancelled')
            .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
            .slice(0, limit);
    }
    /**
     * Get system metrics
     */
    getSystemMetrics() {
        const sessions = Array.from(this.activeSessions.values());
        const activeSessions = sessions.filter((s) => s.status === 'running').length;
        const completedSessions = sessions.filter((s) => s.status === 'completed').length;
        const failedSessions = sessions.filter((s) => s.status === 'failed').length;
        const totalSessions = sessions.length;
        // Calculate average duration for completed sessions
        const completedSessionsWithDuration = sessions.filter((s) => s.status === 'completed' && s.endTime);
        const averageSessionDuration = completedSessionsWithDuration.length > 0
            ? completedSessionsWithDuration.reduce((sum, s) => sum + (s.endTime.getTime() - s.startTime.getTime()), 0) / completedSessionsWithDuration.length
            : 0;
        // Determine system health
        const successRate = totalSessions > 0 ? completedSessions / totalSessions : 1;
        let systemHealth = 'healthy';
        if (successRate < 0.5) {
            systemHealth = 'unhealthy';
        }
        else if (successRate < 0.8) {
            systemHealth = 'degraded';
        }
        // Get agent metrics
        const agentMetrics = this.explorationWorkflow.getAgentMetrics();
        return {
            activeSessions,
            completedSessions,
            failedSessions,
            totalSessions,
            averageSessionDuration,
            systemHealth,
            agentMetrics,
        };
    }
    /**
     * Generate exploration recommendations
     */
    async generateRecommendations(domain) {
        try {
            logger_1.logger.debug('Generating exploration recommendations', { domain });
            // This would use the PlannerAgent to generate recommendations
            // For now, we'll create a basic implementation
            const plannerAgent = new PlannerAgent_1.PlannerAgent({
                monitoring: this.monitoring,
                configManager: this.configManager,
            });
            const recommendations = await plannerAgent.generateRecommendations(domain);
            this.monitoring?.recordCounter('recommendations_generated', 1);
            return recommendations;
        }
        catch (error) {
            logger_1.logger.error('Failed to generate recommendations', {
                domain,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    /**
     * Execute exploration session
     */
    async executeExploration(session) {
        try {
            session.status = 'running';
            session.progress = {
                currentStep: 'starting',
                percentage: 5,
            };
            logger_1.logger.debug('Executing exploration session', {
                sessionId: session.id,
                name: session.request.name,
            });
            // Prepare workflow input
            const workflowInput = {
                targets: session.request.targets,
                planningContext: session.request.planningContext,
                testGenerationOptions: session.request.testGenerationOptions,
            };
            // Execute workflow
            const result = await this.explorationWorkflow.execute(workflowInput);
            // Update session with results
            session.status = 'completed';
            session.endTime = new Date();
            session.results = result;
            session.progress = {
                currentStep: 'completed',
                percentage: 100,
            };
            // Send notifications if configured
            if (session.request.notifications?.onComplete) {
                await this.sendNotifications(session.request.notifications.onComplete, 'exploration_completed', session);
            }
            this.monitoring?.recordCounter('explorations_completed', 1, { status: 'success' });
            logger_1.logger.info('Exploration session completed successfully', {
                sessionId: session.id,
                duration: session.endTime.getTime() - session.startTime.getTime(),
                pagesExplored: result.metadata.totalPagesExplored,
                testsGenerated: result.metadata.totalTestsGenerated,
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            session.status = 'failed';
            session.endTime = new Date();
            session.error = errorMessage;
            session.progress = {
                currentStep: 'failed',
                percentage: 0,
            };
            // Send error notifications if configured
            if (session.request.notifications?.onError) {
                await this.sendNotifications(session.request.notifications.onError, 'exploration_failed', session);
            }
            this.monitoring?.recordCounter('explorations_completed', 1, { status: 'error' });
            logger_1.logger.error('Exploration session failed', {
                sessionId: session.id,
                error: errorMessage,
            });
        }
    }
    /**
     * Schedule exploration for later execution
     */
    async scheduleExploration(session) {
        const delay = session.request.schedule.startAt.getTime() - Date.now();
        logger_1.logger.info('Scheduling exploration session', {
            sessionId: session.id,
            startAt: session.request.schedule.startAt,
            delayMs: delay,
        });
        const timeout = setTimeout(() => {
            this.scheduledSessions.delete(session.id);
            this.executeExploration(session);
        }, delay);
        this.scheduledSessions.set(session.id, timeout);
        session.status = 'pending';
    }
    /**
     * Validate exploration request
     */
    validateExplorationRequest(request) {
        if (!request.name || request.name.trim().length === 0) {
            throw new Error('Exploration name is required');
        }
        if (!request.targets || request.targets.length === 0) {
            throw new Error('At least one exploration target is required');
        }
        for (const target of request.targets) {
            if (!target.url || !target.domain) {
                throw new Error('Each target must have a URL and domain');
            }
            if (target.maxPages <= 0 || target.maxDepth <= 0) {
                throw new Error('Target limits must be positive numbers');
            }
        }
        if (request.testGenerationOptions) {
            const validFrameworks = ['playwright', 'cypress', 'selenium'];
            const validLanguages = ['typescript', 'javascript', 'python', 'java'];
            if (!validFrameworks.includes(request.testGenerationOptions.framework)) {
                throw new Error(`Invalid framework: ${request.testGenerationOptions.framework}`);
            }
            if (!validLanguages.includes(request.testGenerationOptions.language)) {
                throw new Error(`Invalid language: ${request.testGenerationOptions.language}`);
            }
        }
    }
    /**
     * Send notifications
     */
    async sendNotifications(recipients, eventType, session) {
        try {
            logger_1.logger.debug('Sending notifications', {
                recipients: recipients.length,
                eventType,
                sessionId: session.id,
            });
            // This would integrate with actual notification services
            // For now, we'll just log the notification
            for (const recipient of recipients) {
                logger_1.logger.info(`Notification sent`, {
                    recipient,
                    eventType,
                    sessionId: session.id,
                    sessionName: session.request.name,
                    status: session.status,
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to send notifications', {
                eventType,
                sessionId: session.id,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        // Handle workflow engine events
        this.workflowEngine.on('workflow:started', (workflowId) => {
            logger_1.logger.debug('Workflow started', { workflowId });
            this.monitoring?.recordCounter('workflows_started', 1);
        });
        this.workflowEngine.on('workflow:completed', (workflowId) => {
            logger_1.logger.debug('Workflow completed', { workflowId });
            this.monitoring?.recordCounter('workflows_completed', 1);
        });
        this.workflowEngine.on('workflow:failed', (workflowId, error) => {
            logger_1.logger.error('Workflow failed', {
                workflowId,
                error: error.message,
            });
            this.monitoring?.recordCounter('workflow_errors', 1);
        });
        // Handle process events
        process.on('SIGTERM', () => {
            logger_1.logger.info('Received SIGTERM, shutting down gracefully');
            this.shutdown();
        });
        process.on('SIGINT', () => {
            logger_1.logger.info('Received SIGINT, shutting down gracefully');
            this.shutdown();
        });
        // Periodic cleanup
        setInterval(() => {
            this.cleanupOldSessions();
        }, 300000); // Every 5 minutes
    }
    /**
     * Clean up old sessions
     */
    cleanupOldSessions() {
        const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
        let cleanedCount = 0;
        for (const [sessionId, session] of this.activeSessions.entries()) {
            if (session.endTime && session.endTime.getTime() < cutoffTime) {
                this.activeSessions.delete(sessionId);
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) {
            logger_1.logger.debug('Cleaned up old sessions', { count: cleanedCount });
            this.monitoring?.recordGauge('active_sessions', this.activeSessions.size);
        }
    }
    /**
     * Health check
     */
    async healthCheck() {
        try {
            const systemMetrics = this.getSystemMetrics();
            const details = {
                mastraEngine: true, // Would check actual engine status
                workflowEngine: true, // Would check actual engine status
                activeSessions: systemMetrics.activeSessions,
                systemMetrics,
            };
            return {
                status: systemMetrics.systemHealth,
                details,
            };
        }
        catch (error) {
            logger_1.logger.error('Health check failed', {
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                status: 'unhealthy',
                details: {
                    mastraEngine: false,
                    workflowEngine: false,
                    activeSessions: 0,
                    systemMetrics: null,
                },
            };
        }
    }
    /**
     * Graceful shutdown
     */
    async shutdown() {
        logger_1.logger.info('Shutting down Mastra orchestrator');
        try {
            // Cancel all scheduled sessions
            for (const [sessionId, timeout] of this.scheduledSessions.entries()) {
                clearTimeout(timeout);
                const session = this.activeSessions.get(sessionId);
                if (session) {
                    session.status = 'cancelled';
                    session.endTime = new Date();
                }
            }
            this.scheduledSessions.clear();
            // Cancel all running sessions
            const runningSessions = Array.from(this.activeSessions.values()).filter((session) => session.status === 'running');
            for (const session of runningSessions) {
                await this.cancelExploration(session.id);
            }
            // Shutdown workflow
            await this.explorationWorkflow.shutdown();
            // Shutdown engines
            await this.workflowEngine.stop();
            await this.mastraEngine.stop();
            logger_1.logger.info('Mastra orchestrator shutdown completed');
        }
        catch (error) {
            logger_1.logger.error('Error during orchestrator shutdown', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
exports.MastraOrchestrator = MastraOrchestrator;
//# sourceMappingURL=MastraOrchestrator.js.map