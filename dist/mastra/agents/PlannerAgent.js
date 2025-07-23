"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlannerAgent = void 0;
const core_1 = require("@mastra/core");
const uuid_1 = require("uuid");
const logger_1 = require("../../utils/logger");
class PlannerAgent extends core_1.Agent {
    monitoring;
    configManager;
    config;
    metrics;
    activePlans = new Map();
    planningHistory = new Map();
    constructor(config) {
        super({
            name: 'PlannerAgent',
            description: 'Intelligent crawl strategy planning and optimization agent',
            version: '1.0.0',
        });
        this.config = config;
        this.monitoring = config.monitoring;
        this.configManager = config.configManager;
        this.metrics = {
            tasksCompleted: 0,
            tasksSuccessful: 0,
            tasksFailed: 0,
            averageTaskDuration: 0,
            totalRuntime: 0,
            memoryUsage: 0,
            cpuUsage: 0,
            lastActivity: new Date(),
        };
        this.setupEventHandlers();
    }
    /**
     * Get agent capabilities
     */
    getCapabilities() {
        return {
            canNavigate: false,
            canInteract: false,
            canExtract: false,
            canGenerateTests: false,
            canHandleAuth: false,
            canHandleCaptcha: false,
            canTakeScreenshots: false,
            supportedBrowsers: [], // Planning agent doesn't directly use browsers
        };
    }
    /**
     * Get current agent metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * Create an intelligent crawl plan based on targets and context
     */
    async createPlan(targets, context, optimization) {
        const startTime = new Date();
        const planId = (0, uuid_1.v4)();
        const spanId = this.monitoring?.startSpan('planner_create_plan');
        try {
            logger_1.logger.info('Creating crawl plan', {
                planId,
                targetCount: targets.length,
                domain: context.domain,
                objectives: context.objectives,
            });
            // Analyze targets and determine optimal strategy
            const strategy = await this.determineOptimalStrategy(targets, context);
            // Calculate resource requirements
            const resources = await this.calculateResourceRequirements(targets, strategy, optimization);
            // Optimize target order and grouping
            const optimizedTargets = await this.optimizeTargetOrder(targets, context, strategy);
            // Create the crawl plan
            const plan = {
                id: planId,
                name: `Crawl Plan for ${context.domain}`,
                targets: optimizedTargets,
                strategy,
                priority: this.calculatePlanPriority(context),
                resources,
                notifications: {
                    onComplete: [`${context.domain}@notifications`],
                    onError: [`${context.domain}@alerts`],
                },
            };
            // Store plan and context for future optimization
            this.activePlans.set(planId, plan);
            this.planningHistory.set(planId, context);
            const endTime = new Date();
            const duration = endTime.getTime() - startTime.getTime();
            this.updateMetrics(true, duration);
            this.monitoring?.recordHistogram('plan_creation_duration', duration);
            this.monitoring?.recordGauge('active_plans', this.activePlans.size);
            logger_1.logger.info('Created crawl plan successfully', {
                planId,
                strategy,
                targetCount: plan.targets.length,
                estimatedDuration: resources.timeout,
                maxConcurrency: resources.maxConcurrency,
            });
            return plan;
        }
        catch (error) {
            this.updateMetrics(false, Date.now() - startTime.getTime());
            this.monitoring?.recordCounter('plan_creation_errors', 1);
            logger_1.logger.error('Failed to create crawl plan', {
                planId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
        finally {
            if (spanId) {
                this.monitoring?.endSpan(spanId);
            }
        }
    }
    /**
     * Optimize an existing plan based on real-time performance data
     */
    async optimizePlan(planId, performanceData, completedTargets) {
        const spanId = this.monitoring?.startSpan('planner_optimize_plan');
        try {
            const plan = this.activePlans.get(planId);
            const context = this.planningHistory.get(planId);
            if (!plan || !context) {
                throw new Error(`Plan ${planId} not found`);
            }
            logger_1.logger.info('Optimizing crawl plan', {
                planId,
                completedTargets: completedTargets.length,
                totalTargets: plan.targets.length,
            });
            // Analyze performance data
            const analysis = this.analyzePerformanceData(performanceData, completedTargets);
            // Update context with new performance data
            context.previousResults = {
                successfulPaths: completedTargets,
                failedPaths: [], // Would need to be provided
                performanceMetrics: performanceData,
            };
            // Re-optimize remaining targets
            const remainingTargets = plan.targets.filter((target) => !completedTargets.includes(target.url));
            if (remainingTargets.length === 0) {
                logger_1.logger.info('All targets completed, no optimization needed', { planId });
                return plan;
            }
            // Adjust strategy based on performance
            const newStrategy = this.adjustStrategy(plan.strategy, analysis);
            // Reorder remaining targets
            const optimizedTargets = await this.optimizeTargetOrder(remainingTargets, context, newStrategy);
            // Update resource allocation
            const newResources = await this.adjustResourceAllocation(plan.resources, analysis);
            // Create optimized plan
            const optimizedPlan = {
                ...plan,
                targets: [
                    ...completedTargets.map((url) => plan.targets.find((t) => t.url === url)),
                    ...optimizedTargets,
                ],
                strategy: newStrategy,
                resources: newResources,
            };
            this.activePlans.set(planId, optimizedPlan);
            this.monitoring?.recordCounter('plan_optimizations', 1);
            logger_1.logger.info('Plan optimization completed', {
                planId,
                newStrategy,
                remainingTargets: optimizedTargets.length,
                adjustedConcurrency: newResources.maxConcurrency,
            });
            return optimizedPlan;
        }
        catch (error) {
            logger_1.logger.error('Failed to optimize plan', {
                planId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
        finally {
            if (spanId) {
                this.monitoring?.endSpan(spanId);
            }
        }
    }
    /**
     * Generate exploration recommendations based on domain analysis
     */
    async generateRecommendations(domain) {
        const spanId = this.monitoring?.startSpan('planner_generate_recommendations');
        try {
            logger_1.logger.info('Generating exploration recommendations', { domain });
            // Analyze domain characteristics
            const domainAnalysis = await this.analyzeDomain(domain);
            // Generate suggested targets based on common patterns
            const suggestedTargets = this.generateSuggestedTargets(domain, domainAnalysis);
            // Recommend strategy based on domain type
            const strategy = this.recommendStrategy(domainAnalysis);
            // Estimate exploration duration
            const estimatedDuration = this.estimateExplorationDuration(suggestedTargets, strategy);
            // Perform risk assessment
            const riskAssessment = this.assessExplorationRisk(domain, suggestedTargets);
            const recommendations = {
                suggestedTargets,
                strategy,
                estimatedDuration,
                riskAssessment,
            };
            this.monitoring?.recordCounter('recommendations_generated', 1);
            logger_1.logger.info('Generated exploration recommendations', {
                domain,
                targetCount: suggestedTargets.length,
                strategy,
                riskLevel: riskAssessment.level,
            });
            return recommendations;
        }
        catch (error) {
            logger_1.logger.error('Failed to generate recommendations', {
                domain,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
        finally {
            if (spanId) {
                this.monitoring?.endSpan(spanId);
            }
        }
    }
    /**
     * Determine optimal crawling strategy based on targets and context
     */
    async determineOptimalStrategy(targets, context) {
        // Analyze target characteristics
        const totalPages = targets.reduce((sum, target) => sum + target.maxPages, 0);
        const maxDepth = Math.max(...targets.map((t) => t.maxDepth));
        const hasTimeConstraints = !!context.constraints.timeLimit;
        // const hasResourceConstraints = !!context.constraints.resourceLimit;
        // Decision logic based on constraints and objectives
        if (totalPages > 1000 || targets.length > 50) {
            return 'distributed'; // Large scale requires distribution
        }
        if (hasTimeConstraints && context.constraints.timeLimit < 3600000) {
            // < 1 hour
            return 'breadth-first'; // Faster overall discovery
        }
        if (maxDepth > 5 && context.objectives.includes('comprehensive')) {
            return 'depth-first'; // Deep exploration needed
        }
        if (context.constraints.priorityAreas?.length) {
            return 'priority-based'; // Has specific priority areas
        }
        return this.config.defaultStrategy || 'breadth-first';
    }
    /**
     * Calculate resource requirements for the crawl plan
     */
    async calculateResourceRequirements(targets, strategy, optimization) {
        const totalPages = targets.reduce((sum, target) => sum + target.maxPages, 0);
        const avgDepth = targets.reduce((sum, target) => sum + target.maxDepth, 0) / targets.length;
        // Base calculations
        let maxConcurrency = Math.min(this.config.maxConcurrency || 10, Math.ceil(targets.length / 2), optimization?.parallelization.maxWorkers || 10);
        // Adjust based on strategy
        if (strategy === 'distributed') {
            maxConcurrency = Math.max(maxConcurrency, 5);
        }
        else if (strategy === 'depth-first') {
            maxConcurrency = Math.min(maxConcurrency, 3); // Limit for depth-first
        }
        // Calculate timeout based on complexity
        const baseTimeoutPerPage = 30000; // 30 seconds per page
        const depthMultiplier = 1 + (avgDepth - 1) * 0.2;
        const timeout = totalPages * baseTimeoutPerPage * depthMultiplier;
        // Memory estimation (rough calculation)
        const maxMemory = maxConcurrency * 200 * 1024 * 1024; // 200MB per concurrent session
        return {
            maxConcurrency,
            maxMemory,
            timeout: Math.min(timeout, 7200000), // Cap at 2 hours
        };
    }
    /**
     * Optimize the order of targets for exploration
     */
    async optimizeTargetOrder(targets, context, strategy) {
        if (strategy === 'priority-based') {
            return this.sortByPriority(targets, context);
        }
        if (strategy === 'distributed') {
            return this.groupForDistribution(targets);
        }
        // For breadth-first and depth-first, maintain original order but optimize within domains
        return this.sortByDomainAndComplexity(targets);
    }
    /**
     * Sort targets by priority based on context
     */
    sortByPriority(targets, context) {
        return targets.sort((a, b) => {
            let scoreA = 0;
            let scoreB = 0;
            // Priority area bonus
            if (context.constraints.priorityAreas) {
                for (const priority of context.constraints.priorityAreas) {
                    if (a.url.includes(priority))
                        scoreA += 10;
                    if (b.url.includes(priority))
                        scoreB += 10;
                }
            }
            // Authentication penalty (more complex)
            if (a.requireAuth)
                scoreA -= 2;
            if (b.requireAuth)
                scoreB -= 2;
            // Size/complexity consideration
            scoreA -= a.maxPages * 0.1;
            scoreB -= b.maxPages * 0.1;
            return scoreB - scoreA; // Higher score first
        });
    }
    /**
     * Group targets for distributed processing
     */
    groupForDistribution(targets) {
        // Group by domain, then by complexity
        const domainGroups = new Map();
        for (const target of targets) {
            const { domain } = target;
            if (!domainGroups.has(domain)) {
                domainGroups.set(domain, []);
            }
            domainGroups.get(domain).push(target);
        }
        // Flatten groups, alternating between domains for load balancing
        const result = [];
        const iterators = Array.from(domainGroups.values()).map((group) => group[Symbol.iterator]());
        let hasMore = true;
        while (hasMore) {
            hasMore = false;
            for (const iterator of iterators) {
                const next = iterator.next();
                if (!next.done) {
                    result.push(next.value);
                    hasMore = true;
                }
            }
        }
        return result;
    }
    /**
     * Sort targets by domain and complexity
     */
    sortByDomainAndComplexity(targets) {
        return targets.sort((a, b) => {
            // First by domain (group same domains together)
            if (a.domain !== b.domain) {
                return a.domain.localeCompare(b.domain);
            }
            // Then by complexity (simpler first)
            const complexityA = a.maxPages * a.maxDepth + (a.requireAuth ? 100 : 0);
            const complexityB = b.maxPages * b.maxDepth + (b.requireAuth ? 100 : 0);
            return complexityA - complexityB;
        });
    }
    /**
     * Calculate plan priority based on context
     */
    calculatePlanPriority(context) {
        let priority = 5; // Base priority
        // Increase for urgent objectives
        if (context.objectives.includes('urgent') || context.objectives.includes('critical')) {
            priority += 3;
        }
        // Increase for time constraints
        if (context.constraints.timeLimit && context.constraints.timeLimit < 3600000) {
            priority += 2;
        }
        // Decrease for comprehensive/exploratory objectives
        if (context.objectives.includes('comprehensive') ||
            context.objectives.includes('exploratory')) {
            priority -= 1;
        }
        return Math.max(1, Math.min(10, priority));
    }
    /**
     * Analyze domain characteristics
     */
    async analyzeDomain(domain) {
        try {
            // This would typically involve actual domain analysis
            // For now, we'll use heuristics based on domain name
            let type = 'unknown';
            let complexity = 'medium';
            // Simple heuristics
            if (domain.includes('shop') || domain.includes('store') || domain.includes('buy')) {
                type = 'ecommerce';
                complexity = 'high';
            }
            else if (domain.includes('blog') || domain.includes('news')) {
                type = 'blog';
                complexity = 'low';
            }
            else if (domain.includes('facebook') ||
                domain.includes('twitter') ||
                domain.includes('social')) {
                type = 'social';
                complexity = 'high';
            }
            else if (domain.includes('corp') || domain.includes('company')) {
                type = 'corporate';
                complexity = 'medium';
            }
            const commonPaths = this.getCommonPathsForType(type);
            return {
                type,
                complexity,
                technologies: [], // Would be detected through actual analysis
                commonPaths,
            };
        }
        catch (error) {
            logger_1.logger.warn('Failed to analyze domain', {
                domain,
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                type: 'unknown',
                complexity: 'medium',
                technologies: [],
                commonPaths: ['/', '/about', '/contact'],
            };
        }
    }
    /**
     * Generate suggested targets based on domain analysis
     */
    generateSuggestedTargets(domain, analysis) {
        const baseUrl = `https://${domain}`;
        const targets = [];
        // Add common paths based on site type
        for (const path of analysis.commonPaths) {
            targets.push({
                url: `${baseUrl}${path}`,
                domain,
                maxDepth: analysis.complexity === 'high' ? 4 : 3,
                maxPages: analysis.complexity === 'high' ? 50 : 20,
                patterns: this.getPatternsForType(analysis.type),
            });
        }
        return targets;
    }
    /**
     * Get common paths for different site types
     */
    getCommonPathsForType(type) {
        const pathMap = {
            ecommerce: ['/', '/products', '/categories', '/cart', '/checkout', '/account'],
            blog: ['/', '/posts', '/categories', '/tags', '/about', '/contact'],
            corporate: ['/', '/about', '/services', '/products', '/contact', '/careers'],
            social: ['/', '/profile', '/feed', '/messages', '/settings'],
            unknown: ['/', '/about', '/contact', '/services'],
        };
        return pathMap[type] || pathMap.unknown;
    }
    /**
     * Get relevant patterns for different site types
     */
    getPatternsForType(type) {
        const patternMap = {
            ecommerce: ['product', 'cart', 'buy', 'checkout', 'price'],
            blog: ['post', 'article', 'read', 'comment', 'category'],
            corporate: ['service', 'solution', 'team', 'contact', 'about'],
            social: ['profile', 'message', 'friend', 'follow', 'post'],
            unknown: ['link', 'button', 'form', 'menu'],
        };
        return patternMap[type] || patternMap.unknown;
    }
    /**
     * Recommend strategy based on domain analysis
     */
    recommendStrategy(analysis) {
        if (analysis.complexity === 'high') {
            return 'distributed';
        }
        if (analysis.type === 'blog' || analysis.type === 'corporate') {
            return 'breadth-first';
        }
        if (analysis.type === 'ecommerce') {
            return 'priority-based';
        }
        return 'breadth-first';
    }
    /**
     * Estimate exploration duration
     */
    estimateExplorationDuration(targets, strategy) {
        const totalPages = targets.reduce((sum, target) => sum + target.maxPages, 0);
        const baseTimePerPage = 10000; // 10 seconds per page base
        let multiplier = 1;
        if (strategy === 'depth-first')
            multiplier = 1.3;
        if (strategy === 'distributed')
            multiplier = 0.7;
        if (strategy === 'priority-based')
            multiplier = 1.1;
        return totalPages * baseTimePerPage * multiplier;
    }
    /**
     * Assess exploration risk
     */
    assessExplorationRisk(domain, targets) {
        const factors = [];
        const mitigations = [];
        let riskScore = 0;
        // Check for authentication requirements
        if (targets.some((t) => t.requireAuth)) {
            factors.push('Authentication required');
            mitigations.push('Ensure valid credentials are configured');
            riskScore += 2;
        }
        // Check for large scale
        const totalPages = targets.reduce((sum, t) => sum + t.maxPages, 0);
        if (totalPages > 500) {
            factors.push('Large scale exploration');
            mitigations.push('Use distributed strategy and monitor resource usage');
            riskScore += 1;
        }
        // Check for deep exploration
        if (targets.some((t) => t.maxDepth > 5)) {
            factors.push('Deep exploration required');
            mitigations.push('Set appropriate timeouts and monitor progress');
            riskScore += 1;
        }
        // Determine overall risk level
        let level = 'low';
        if (riskScore >= 4)
            level = 'high';
        else if (riskScore >= 2)
            level = 'medium';
        return { level, factors, mitigations };
    }
    /**
     * Analyze performance data for optimization
     */
    analyzePerformanceData(performanceData, completedTargets) {
        const avgResponseTime = performanceData.avgResponseTime || 0;
        const successRate = completedTargets.length / (performanceData.totalAttempts || 1);
        const bottlenecks = [];
        const recommendations = [];
        if (avgResponseTime > 30000) {
            bottlenecks.push('Slow response times');
            recommendations.push('Reduce concurrency or increase timeouts');
        }
        if (successRate < 0.8) {
            bottlenecks.push('Low success rate');
            recommendations.push('Review error patterns and adjust strategy');
        }
        if (performanceData.memoryUsage > 1024 * 1024 * 1024) {
            // > 1GB
            bottlenecks.push('High memory usage');
            recommendations.push('Reduce concurrent sessions');
        }
        return {
            avgResponseTime,
            successRate,
            bottlenecks,
            recommendations,
        };
    }
    /**
     * Adjust strategy based on performance analysis
     */
    adjustStrategy(currentStrategy, analysis) {
        if (analysis.bottlenecks.includes('Slow response times')) {
            return 'breadth-first'; // Better for slow responses
        }
        if (analysis.bottlenecks.includes('High memory usage')) {
            return 'depth-first'; // Uses less concurrent memory
        }
        return currentStrategy; // Keep current if no major issues
    }
    /**
     * Adjust resource allocation based on performance
     */
    async adjustResourceAllocation(currentResources, analysis) {
        let { maxConcurrency, maxMemory, timeout } = currentResources;
        // Adjust based on bottlenecks
        if (analysis.bottlenecks.includes('High memory usage')) {
            maxConcurrency = Math.max(1, Math.floor(maxConcurrency * 0.7));
            maxMemory = Math.floor(maxMemory * 0.8);
        }
        if (analysis.bottlenecks.includes('Slow response times')) {
            timeout = Math.floor(timeout * 1.3);
            maxConcurrency = Math.max(1, Math.floor(maxConcurrency * 0.8));
        }
        if (analysis.successRate > 0.9 && analysis.avgResponseTime < 10000) {
            // Performance is good, we can be more aggressive
            maxConcurrency = Math.min(maxConcurrency + 2, 20);
        }
        return { maxConcurrency, maxMemory, timeout };
    }
    /**
     * Update agent metrics
     */
    updateMetrics(success, duration) {
        this.metrics.tasksCompleted++;
        if (success) {
            this.metrics.tasksSuccessful++;
        }
        else {
            this.metrics.tasksFailed++;
        }
        this.metrics.averageTaskDuration =
            (this.metrics.averageTaskDuration * (this.metrics.tasksCompleted - 1) + duration) /
                this.metrics.tasksCompleted;
        this.metrics.totalRuntime += duration;
        this.metrics.lastActivity = new Date();
        const memUsage = process.memoryUsage();
        this.metrics.memoryUsage = memUsage.heapUsed;
    }
    /**
     * Set up event handlers
     */
    setupEventHandlers() {
        this.on('error', (error) => {
            logger_1.logger.error('PlannerAgent error', {
                error: error.message,
                stack: error.stack,
            });
            this.monitoring?.recordCounter('agent_errors', 1, { type: 'planner' });
        });
        // Periodic cleanup of old plans
        setInterval(() => {
            this.cleanupOldPlans();
        }, 300000); // Every 5 minutes
    }
    /**
     * Clean up old plans to prevent memory leaks
     */
    cleanupOldPlans() {
        // const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
        for (const [planId] of this.activePlans.entries()) {
            // Remove plans older than 24 hours (would need timestamp tracking)
            // This is simplified - in reality, you'd track plan creation time
            if (this.activePlans.size > 100) {
                // Arbitrary limit
                this.activePlans.delete(planId);
                this.planningHistory.delete(planId);
                break;
            }
        }
    }
    /**
     * Get plan status
     */
    getPlanStatus(planId) {
        const plan = this.activePlans.get(planId);
        if (!plan) {
            return { exists: false };
        }
        return {
            exists: true,
            plan,
            progress: {
                completed: 0, // Would track actual progress
                total: plan.targets.length,
                status: 'running', // Would track actual status
            },
        };
    }
    /**
     * Remove a completed plan
     */
    removePlan(planId) {
        const removed = this.activePlans.delete(planId);
        this.planningHistory.delete(planId);
        if (removed) {
            this.monitoring?.recordGauge('active_plans', this.activePlans.size);
            logger_1.logger.debug('Removed completed plan', { planId });
        }
        return removed;
    }
    /**
     * Get all active plans
     */
    getActivePlans() {
        return Array.from(this.activePlans.values());
    }
}
exports.PlannerAgent = PlannerAgent;
//# sourceMappingURL=PlannerAgent.js.map