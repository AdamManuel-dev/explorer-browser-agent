import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
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

export interface PlanningEvent {
  id: string;
  type: 'planning_started' | 'targets_analyzed' | 'strategy_selected' | 'optimization_applied' | 'plan_generated' | 'planning_completed' | 'error_occurred' | 'progress_update';
  timestamp: Date;
  data: any;
  progress?: {
    current: number;
    total: number;
    percentage: number;
    message: string;
  };
}

export interface PlanningEventCallback {
  (event: PlanningEvent): void;
}

export class PlannerAgent extends Agent {
  private monitoring?: MonitoringService;

  private configManager?: ConfigManager;

  private config: PlannerAgentConfig;

  private metrics: AgentMetrics;

  private activePlans: Map<string, CrawlPlan> = new Map();

  private planningHistory: Map<string, PlanningContext> = new Map();

  private eventEmitter: EventEmitter = new EventEmitter();

  private streamingCallbacks: Map<string, PlanningEventCallback> = new Map();

  constructor(config: PlannerAgentConfig) {
    super({
      id: 'planner-agent',
      name: 'PlannerAgent',
      instructions: 'Intelligent crawl strategy planning and optimization agent',
      model: openai('gpt-4'),
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
  getCapabilities(): AgentCapabilities {
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
  getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  /**
   * Subscribe to planning events for streaming updates
   */
  onPlanningEvent(callback: PlanningEventCallback): string {
    const subscriptionId = uuidv4();
    this.streamingCallbacks.set(subscriptionId, callback);
    return subscriptionId;
  }

  /**
   * Unsubscribe from planning events
   */
  offPlanningEvent(subscriptionId: string): void {
    this.streamingCallbacks.delete(subscriptionId);
  }

  /**
   * Emit planning event to all subscribers
   */
  private emitPlanningEvent(event: Omit<PlanningEvent, 'id' | 'timestamp'>): void {
    const fullEvent: PlanningEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      ...event,
    };

    // Emit to event emitter
    this.eventEmitter.emit('planning:event', fullEvent);

    // Call all streaming callbacks
    this.streamingCallbacks.forEach((callback) => {
      try {
        callback(fullEvent);
      } catch (error) {
        logger.warn('Error in planning streaming callback', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // Log the event
    logger.debug('Planning event emitted', {
      type: fullEvent.type,
      id: fullEvent.id,
    });
  }

  /**
   * Create an intelligent crawl plan based on targets and context
   */
  async createPlan(
    targets: ExplorationTarget[],
    context: PlanningContext,
    optimization?: PlanOptimization
  ): Promise<CrawlPlan> {
    const startTime = new Date();
    const planId = uuidv4();
    const spanId = this.monitoring?.startSpan('planner_create_plan');

    try {
      logger.info('Creating crawl plan', {
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
      const plan: CrawlPlan = {
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

      logger.info('Created crawl plan successfully', {
        planId,
        strategy,
        targetCount: plan.targets.length,
        estimatedDuration: resources.timeout,
        maxConcurrency: resources.maxConcurrency,
      });

      return plan;
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime.getTime());
      this.monitoring?.recordCounter('plan_creation_errors', 1);

      logger.error('Failed to create crawl plan', {
        planId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    } finally {
      if (spanId) {
        this.monitoring?.endSpan(spanId);
      }
    }
  }

  /**
   * Streaming version of plan creation with real-time updates
   */
  async* createPlanStream(
    targets: ExplorationTarget[],
    context: PlanningContext,
    optimization?: PlanOptimization
  ): AsyncGenerator<PlanningEvent, CrawlPlan> {
    const startTime = new Date();
    const planId = uuidv4();
    const spanId = this.monitoring?.startSpan('planner_create_plan_stream');

    try {
      yield {
        id: uuidv4(),
        type: 'planning_started',
        timestamp: new Date(),
        data: { planId, targetCount: targets.length, domain: context.domain },
        progress: { current: 0, total: 5, percentage: 0, message: 'Starting plan creation...' },
      };

      this.emitPlanningEvent({
        type: 'progress_update',
        data: { message: 'Analyzing targets' },
        progress: { current: 1, total: 5, percentage: 20, message: 'Analyzing targets...' },
      });

      // Analyze targets and determine optimal strategy
      const strategy = await this.determineOptimalStrategy(targets, context);
      
      yield {
        id: uuidv4(),
        type: 'strategy_selected',
        timestamp: new Date(),
        data: { strategy, planId },
        progress: { current: 2, total: 5, percentage: 40, message: 'Strategy selected' },
      };

      this.emitPlanningEvent({
        type: 'progress_update',
        data: { message: 'Calculating resource requirements' },
        progress: { current: 2, total: 5, percentage: 40, message: 'Calculating resources...' },
      });

      // Calculate resource requirements
      const resources = await this.calculateResourceRequirements(targets, strategy, optimization);

      this.emitPlanningEvent({
        type: 'progress_update',
        data: { message: 'Optimizing target order' },
        progress: { current: 3, total: 5, percentage: 60, message: 'Optimizing targets...' },
      });

      // Optimize target order and grouping
      const optimizedTargets = await this.optimizeTargetOrder(targets, context, strategy);

      yield {
        id: uuidv4(),
        type: 'targets_analyzed',
        timestamp: new Date(),
        data: { 
          originalCount: targets.length,
          optimizedCount: optimizedTargets.length,
          strategy,
          resources 
        },
        progress: { current: 4, total: 5, percentage: 80, message: 'Generating plan...' },
      };

      // Apply optimization if provided
      if (optimization) {
        this.emitPlanningEvent({
          type: 'optimization_applied',
          data: { optimization },
        });
      }

      // Create the crawl plan
      const plan: CrawlPlan = {
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

      yield {
        id: uuidv4(),
        type: 'plan_generated',
        timestamp: new Date(),
        data: { plan },
        progress: { current: 5, total: 5, percentage: 100, message: 'Plan completed!' },
      };

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      this.updateMetrics(true, duration);
      this.monitoring?.recordHistogram('plan_creation_duration', duration);
      this.monitoring?.recordGauge('active_plans', this.activePlans.size);

      yield {
        id: uuidv4(),
        type: 'planning_completed',
        timestamp: new Date(),
        data: { 
          planId,
          duration,
          targetCount: plan.targets.length,
          strategy,
          resources 
        },
      };

      logger.info('Created crawl plan successfully via streaming', {
        planId,
        strategy,
        targetCount: plan.targets.length,
        estimatedDuration: resources.timeout,
        maxConcurrency: resources.maxConcurrency,
      });

      return plan;
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime.getTime());
      this.monitoring?.recordCounter('plan_creation_errors', 1);

      yield {
        id: uuidv4(),
        type: 'error_occurred',
        timestamp: new Date(),
        data: { 
          error: error instanceof Error ? error.message : String(error),
          planId 
        },
      };

      logger.error('Failed to create crawl plan via streaming', {
        planId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    } finally {
      if (spanId) {
        this.monitoring?.endSpan(spanId);
      }
    }
  }

  /**
   * Optimize an existing plan based on real-time performance data
   */
  async optimizePlan(
    planId: string,
    performanceData: Record<string, number>,
    completedTargets: string[]
  ): Promise<CrawlPlan> {
    const spanId = this.monitoring?.startSpan('planner_optimize_plan');

    try {
      const plan = this.activePlans.get(planId);
      const context = this.planningHistory.get(planId);

      if (!plan || !context) {
        throw new Error(`Plan ${planId} not found`);
      }

      logger.info('Optimizing crawl plan', {
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
      const remainingTargets = plan.targets.filter(
        (target) => !completedTargets.includes(target.url)
      );

      if (remainingTargets.length === 0) {
        logger.info('All targets completed, no optimization needed', { planId });
        return plan;
      }

      // Adjust strategy based on performance
      const newStrategy = this.adjustStrategy(plan.strategy, analysis);

      // Reorder remaining targets
      const optimizedTargets = await this.optimizeTargetOrder(
        remainingTargets,
        context,
        newStrategy
      );

      // Update resource allocation
      const newResources = await this.adjustResourceAllocation(plan.resources, analysis);

      // Create optimized plan
      const optimizedPlan: CrawlPlan = {
        ...plan,
        targets: [
          ...completedTargets.map((url) => plan.targets.find((t) => t.url === url)!),
          ...optimizedTargets,
        ],
        strategy: newStrategy,
        resources: newResources,
      };

      this.activePlans.set(planId, optimizedPlan);
      this.monitoring?.recordCounter('plan_optimizations', 1);

      logger.info('Plan optimization completed', {
        planId,
        newStrategy,
        remainingTargets: optimizedTargets.length,
        adjustedConcurrency: newResources.maxConcurrency,
      });

      return optimizedPlan;
    } catch (error) {
      logger.error('Failed to optimize plan', {
        planId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      if (spanId) {
        this.monitoring?.endSpan(spanId);
      }
    }
  }

  /**
   * Generate exploration recommendations based on domain analysis
   */
  async generateRecommendations(domain: string): Promise<{
    suggestedTargets: ExplorationTarget[];
    strategy: string;
    estimatedDuration: number;
    riskAssessment: {
      level: 'low' | 'medium' | 'high';
      factors: string[];
      mitigations: string[];
    };
  }> {
    const spanId = this.monitoring?.startSpan('planner_generate_recommendations');

    try {
      logger.info('Generating exploration recommendations', { domain });

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

      logger.info('Generated exploration recommendations', {
        domain,
        targetCount: suggestedTargets.length,
        strategy,
        riskLevel: riskAssessment.level,
      });

      return recommendations;
    } catch (error) {
      logger.error('Failed to generate recommendations', {
        domain,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      if (spanId) {
        this.monitoring?.endSpan(spanId);
      }
    }
  }

  /**
   * Determine optimal crawling strategy based on targets and context
   */
  private async determineOptimalStrategy(
    targets: ExplorationTarget[],
    context: PlanningContext
  ): Promise<'breadth-first' | 'depth-first' | 'priority-based' | 'distributed'> {
    // Analyze target characteristics
    const totalPages = targets.reduce((sum, target) => sum + target.maxPages, 0);
    const maxDepth = Math.max(...targets.map((t) => t.maxDepth));
    const hasTimeConstraints = !!context.constraints.timeLimit;
    // const hasResourceConstraints = !!context.constraints.resourceLimit;

    // Decision logic based on constraints and objectives
    if (totalPages > 1000 || targets.length > 50) {
      return 'distributed'; // Large scale requires distribution
    }

    if (hasTimeConstraints && context.constraints.timeLimit! < 3600000) {
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
  private async calculateResourceRequirements(
    targets: ExplorationTarget[],
    strategy: string,
    optimization?: PlanOptimization
  ): Promise<CrawlPlan['resources']> {
    const totalPages = targets.reduce((sum, target) => sum + target.maxPages, 0);
    const avgDepth = targets.reduce((sum, target) => sum + target.maxDepth, 0) / targets.length;

    // Base calculations
    let maxConcurrency = Math.min(
      this.config.maxConcurrency || 10,
      Math.ceil(targets.length / 2),
      optimization?.parallelization.maxWorkers || 10
    );

    // Adjust based on strategy
    if (strategy === 'distributed') {
      maxConcurrency = Math.max(maxConcurrency, 5);
    } else if (strategy === 'depth-first') {
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
  private async optimizeTargetOrder(
    targets: ExplorationTarget[],
    context: PlanningContext,
    strategy: string
  ): Promise<ExplorationTarget[]> {
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
  private sortByPriority(
    targets: ExplorationTarget[],
    context: PlanningContext
  ): ExplorationTarget[] {
    return targets.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // Priority area bonus
      if (context.constraints.priorityAreas) {
        for (const priority of context.constraints.priorityAreas) {
          if (a.url.includes(priority)) scoreA += 10;
          if (b.url.includes(priority)) scoreB += 10;
        }
      }

      // Authentication penalty (more complex)
      if (a.requireAuth) scoreA -= 2;
      if (b.requireAuth) scoreB -= 2;

      // Size/complexity consideration
      scoreA -= a.maxPages * 0.1;
      scoreB -= b.maxPages * 0.1;

      return scoreB - scoreA; // Higher score first
    });
  }

  /**
   * Group targets for distributed processing
   */
  private groupForDistribution(targets: ExplorationTarget[]): ExplorationTarget[] {
    // Group by domain, then by complexity
    const domainGroups = new Map<string, ExplorationTarget[]>();

    for (const target of targets) {
      const { domain } = target;
      if (!domainGroups.has(domain)) {
        domainGroups.set(domain, []);
      }
      domainGroups.get(domain)!.push(target);
    }

    // Flatten groups, alternating between domains for load balancing
    const result: ExplorationTarget[] = [];
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
  private sortByDomainAndComplexity(targets: ExplorationTarget[]): ExplorationTarget[] {
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
  private calculatePlanPriority(context: PlanningContext): number {
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
    if (
      context.objectives.includes('comprehensive') ||
      context.objectives.includes('exploratory')
    ) {
      priority -= 1;
    }

    return Math.max(1, Math.min(10, priority));
  }

  /**
   * Analyze domain characteristics
   */
  private async analyzeDomain(domain: string): Promise<{
    type: 'ecommerce' | 'blog' | 'corporate' | 'social' | 'unknown';
    complexity: 'low' | 'medium' | 'high';
    technologies: string[];
    commonPaths: string[];
  }> {
    try {
      // This would typically involve actual domain analysis
      // For now, we'll use heuristics based on domain name

      let type: 'ecommerce' | 'blog' | 'corporate' | 'social' | 'unknown' = 'unknown';
      let complexity: 'low' | 'medium' | 'high' = 'medium';

      // Simple heuristics
      if (domain.includes('shop') || domain.includes('store') || domain.includes('buy')) {
        type = 'ecommerce';
        complexity = 'high';
      } else if (domain.includes('blog') || domain.includes('news')) {
        type = 'blog';
        complexity = 'low';
      } else if (
        domain.includes('facebook') ||
        domain.includes('twitter') ||
        domain.includes('social')
      ) {
        type = 'social';
        complexity = 'high';
      } else if (domain.includes('corp') || domain.includes('company')) {
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
    } catch (error) {
      logger.warn('Failed to analyze domain', {
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
  private generateSuggestedTargets(
    domain: string,
    analysis: {
      type: string;
      complexity: string;
      technologies: string[];
      commonPaths: string[];
    }
  ): ExplorationTarget[] {
    const baseUrl = `https://${domain}`;
    const targets: ExplorationTarget[] = [];

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
  private getCommonPathsForType(type: string): string[] {
    const pathMap: Record<string, string[]> = {
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
  private getPatternsForType(type: string): string[] {
    const patternMap: Record<string, string[]> = {
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
  private recommendStrategy(analysis: {
    type: string;
    complexity: string;
    technologies: string[];
    commonPaths: string[];
  }): string {
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
  private estimateExplorationDuration(targets: ExplorationTarget[], strategy: string): number {
    const totalPages = targets.reduce((sum, target) => sum + target.maxPages, 0);
    const baseTimePerPage = 10000; // 10 seconds per page base

    let multiplier = 1;
    if (strategy === 'depth-first') multiplier = 1.3;
    if (strategy === 'distributed') multiplier = 0.7;
    if (strategy === 'priority-based') multiplier = 1.1;

    return totalPages * baseTimePerPage * multiplier;
  }

  /**
   * Assess exploration risk
   */
  private assessExplorationRisk(
    domain: string,
    targets: ExplorationTarget[]
  ): {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    mitigations: string[];
  } {
    const factors: string[] = [];
    const mitigations: string[] = [];
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
    let level: 'low' | 'medium' | 'high' = 'low';
    if (riskScore >= 4) level = 'high';
    else if (riskScore >= 2) level = 'medium';

    return { level, factors, mitigations };
  }

  /**
   * Analyze performance data for optimization
   */
  private analyzePerformanceData(
    performanceData: Record<string, number>,
    completedTargets: string[]
  ): {
    avgResponseTime: number;
    successRate: number;
    errorRate: number;
    bottlenecks: string[];
    recommendations: string[];
  } {
    const avgResponseTime = performanceData.avgResponseTime || 0;
    const successRate = completedTargets.length / (performanceData.totalAttempts || 1);
    const bottlenecks: string[] = [];
    const recommendations: string[] = [];

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
      errorRate: 1 - successRate,
      bottlenecks,
      recommendations,
    };
  }

  /**
   * Adjust strategy based on performance analysis
   */
  private adjustStrategy(
    currentStrategy: string,
    analysis: {
      successRate: number;
      avgResponseTime: number;
      errorRate: number;
      bottlenecks: string[];
    }
  ): 'breadth-first' | 'depth-first' | 'priority-based' | 'distributed' {
    if (analysis.bottlenecks.includes('Slow response times')) {
      return 'breadth-first'; // Better for slow responses
    }

    if (analysis.bottlenecks.includes('High memory usage')) {
      return 'depth-first'; // Uses less concurrent memory
    }

    return currentStrategy as 'breadth-first' | 'depth-first' | 'priority-based' | 'distributed'; // Keep current if no major issues
  }

  /**
   * Adjust resource allocation based on performance
   */
  private async adjustResourceAllocation(
    currentResources: CrawlPlan['resources'],
    analysis: {
      successRate: number;
      avgResponseTime: number;
      errorRate: number;
      bottlenecks: string[];
    }
  ): Promise<CrawlPlan['resources']> {
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
  private updateMetrics(success: boolean, duration: number): void {
    this.metrics.tasksCompleted++;
    if (success) {
      this.metrics.tasksSuccessful++;
    } else {
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
  private setupEventHandlers(): void {
    // this.on('error', (error) => {
    // logger.error('PlannerAgent error', {
    //   error: error.message,
    //   stack: error.stack,
    // });
    // this.monitoring?.recordCounter('agent_errors', 1, { type: 'planner' });
    // });

    // Periodic cleanup of old plans
    setInterval(() => {
      this.cleanupOldPlans();
    }, 300000); // Every 5 minutes
  }

  /**
   * Clean up old plans to prevent memory leaks
   */
  private cleanupOldPlans(): void {
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
  getPlanStatus(planId: string): {
    exists: boolean;
    plan?: CrawlPlan;
    progress?: {
      completed: number;
      total: number;
      status: 'planning' | 'running' | 'completed' | 'failed';
    };
  } {
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
  removePlan(planId: string): boolean {
    const removed = this.activePlans.delete(planId);
    this.planningHistory.delete(planId);

    if (removed) {
      this.monitoring?.recordGauge('active_plans', this.activePlans.size);
      logger.debug('Removed completed plan', { planId });
    }

    return removed;
  }

  /**
   * Get all active plans
   */
  getActivePlans(): CrawlPlan[] {
    return Array.from(this.activePlans.values());
  }
}
