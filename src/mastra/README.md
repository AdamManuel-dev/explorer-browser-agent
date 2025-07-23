# Mastra Integration Module

The Mastra module provides AI-powered web exploration and test generation capabilities using Browserbase and Stagehand technologies, orchestrated through the Mastra framework.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    Mastra Orchestrator                           │
├──────────────────────────────────────────────────────────────────┤
│  Session Management  │  Workflow Execution  │  Agent Coordination│
├──────────────────────────────────────────────────────────────────┤
│                    Exploration Workflow                          │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐      │
│  │ Initialize  │  │ Plan         │  │ Execute             │      │
│  │ Context     │  │ Strategy     │  │ Exploration         │      │
│  └─────────────┘  └──────────────┘  └─────────────────────┘      │
│  ┌─────────────┐  ┌──────────────┐                               │
│  │ Generate    │  │ Finalize     │                               │
│  │ Tests       │  │ Results      │                               │
│  └─────────────┘  └──────────────┘                               │
├──────────────────────────────────────────────────────────────────┤
│                        Agent Layer                               │
│ ┌────────────┐ ┌────────────┐ ┌──────────────────────────┐       │
│ │ Explorer   │ │ Planner    │ │ Generator                │       │
│ │ Agent      │ │ Agent      │ │ Agent                    │       │
│ │            │ │            │ │                          │       │
│ │ •Navigate  │ │ •Strategy  │ │ •Test Generation         │       │
│ │ •Interact  │ │ •Optimize  │ │ •Page Objects            │       │
│ │ •Extract   │ │ •Resource  │ │ •Fixtures                │       │
│ │ •Record    │ │ •Priority  │ │ •Helpers                 │       │
│ └────────────┘ └────────────┘ └──────────────────────────┘       │
├──────────────────────────────────────────────────────────────────┤
│                    Technology Layer                              │
│ ┌────────────┐ ┌────────────┐ ┌──────────────────────────┐       │
│ │ Browserbase│ │ Stagehand  │ │ Mastra Framework         │       │
│ │ •Remote    │ │ •AI Guided │ │ •Workflow Engine         │       │
│ │ •Scalable  │ │ •Natural   │ │ •Agent Framework         │       │
│ │ •Managed   │ │ •Context   │ │ •Event System            │       │
│ └────────────┘ └────────────┘ └──────────────────────────┘       │
└──────────────────────────────────────────────────────────────────┘
```

## Components

### MastraOrchestrator

The main orchestrator that manages exploration sessions, coordinates agents, and handles workflow execution.

**Key Features:**
- Session lifecycle management
- Concurrent exploration handling
- Scheduled exploration support
- Real-time progress tracking
- Comprehensive metrics and health monitoring

### ExplorerAgent

AI-powered web exploration agent using Browserbase and Stagehand for intelligent browser automation.

**Capabilities:**
- Natural language-driven navigation
- AI-guided element interaction
- Intelligent content extraction
- Human-like behavior simulation
- Comprehensive screenshot capture

### PlannerAgent

Strategic planning agent that optimizes exploration approaches and resource allocation.

**Capabilities:**
- Intelligent strategy selection
- Resource requirement calculation
- Dynamic plan optimization
- Risk assessment and mitigation
- Performance-based adjustments

### GeneratorAgent

Test generation coordination agent that transforms exploration results into maintainable test suites.

**Capabilities:**
- Multi-framework test generation
- Page Object Model creation
- Fixture and helper generation
- Code quality validation
- Optimization recommendations

### ExplorationWorkflow

Mastra-based workflow that orchestrates the complete exploration lifecycle.

**Workflow Steps:**
1. **Initialize**: Context setup and validation
2. **Plan**: Strategy creation and optimization
3. **Explore**: AI-guided web exploration
4. **Generate**: Test suite creation (optional)
5. **Finalize**: Results processing and cleanup

## Usage

### Basic Setup

```typescript
import { MastraOrchestrator } from './mastra';

const orchestrator = new MastraOrchestrator({
  browserbase: {
    apiKey: process.env.BROWSERBASE_API_KEY!,
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    region: 'us-east-1',
  },
  stagehand: {
    modelName: 'gpt-4',
    enableCaching: true,
    headless: true,
  },
  monitoring: monitoringService,
  maxConcurrentWorkflows: 5,
  enableTestGeneration: true,
  outputDirectory: './generated-tests',
});
```

### Simple Exploration

```typescript
const sessionId = await orchestrator.startExploration({
  name: 'E-commerce Site Exploration',
  targets: [
    {
      url: 'https://shop.example.com',
      domain: 'shop.example.com',
      maxDepth: 3,
      maxPages: 50,
      patterns: ['product', 'cart', 'checkout'],
      requireAuth: false,
    },
  ],
  planningContext: {
    domain: 'shop.example.com',
    objectives: ['comprehensive_exploration', 'user_flows'],
    constraints: {
      timeLimit: 3600000, // 1 hour
      priorityAreas: ['checkout', 'product-detail'],
    },
  },
});

// Monitor progress
const status = orchestrator.getExplorationStatus(sessionId);
console.log(`Progress: ${status?.progress.percentage}%`);
```

### Advanced Exploration with Test Generation

```typescript
const sessionId = await orchestrator.startExploration({
  name: 'Complete E-commerce Testing Suite',
  targets: [
    {
      url: 'https://shop.example.com',
      domain: 'shop.example.com',
      maxDepth: 4,
      maxPages: 100,
      patterns: ['product', 'cart', 'checkout', 'account'],
      excludePatterns: ['admin', 'internal'],
      requireAuth: true,
      authStrategy: 'basic',
    },
    {
      url: 'https://shop.example.com/api',
      domain: 'shop.example.com',
      maxDepth: 2,
      maxPages: 20,
      patterns: ['api', 'endpoint'],
    },
  ],
  planningContext: {
    domain: 'shop.example.com',
    objectives: ['comprehensive_exploration', 'test_coverage', 'performance_analysis'],
    constraints: {
      timeLimit: 7200000, // 2 hours
      resourceLimit: 2048, // 2GB
      priorityAreas: ['checkout-flow', 'product-catalog', 'user-account'],
      excludedAreas: ['admin-panel', 'internal-tools'],
    },
  },
  testGenerationOptions: {
    framework: 'playwright',
    language: 'typescript',
    generatePageObjects: true,
    generateFixtures: true,
    generateHelpers: true,
  },
  notifications: {
    onComplete: ['team@company.com'],
    onError: ['alerts@company.com'],
  },
});
```

### Scheduled Exploration

```typescript
const sessionId = await orchestrator.startExploration({
  name: 'Daily Site Health Check',
  targets: [...targets],
  schedule: {
    startAt: new Date(Date.now() + 3600000), // Start in 1 hour
    interval: '0 2 * * *', // Daily at 2 AM (cron format - future feature)
    maxRuns: 30, // Run for 30 days
  },
  testGenerationOptions: {
    framework: 'playwright',
    language: 'typescript',
    generatePageObjects: true,
    generateFixtures: false,
    generateHelpers: true,
  },
});
```

### Monitoring and Management

```typescript
// Get system metrics
const metrics = orchestrator.getSystemMetrics();
console.log(`System Health: ${metrics.systemHealth}`);
console.log(`Active Sessions: ${metrics.activeSessions}`);
console.log(`Success Rate: ${(metrics.completedSessions / metrics.totalSessions * 100).toFixed(1)}%`);

// Get active sessions
const activeSessions = orchestrator.getActiveSessions();
for (const session of activeSessions) {
  console.log(`${session.id}: ${session.progress.currentStep} (${session.progress.percentage}%)`);
}

// Get session history
const history = orchestrator.getSessionHistory(10);
for (const session of history) {
  const duration = session.endTime ? 
    session.endTime.getTime() - session.startTime.getTime() : 0;
  console.log(`${session.request.name}: ${session.status} (${duration}ms)`);
}

// Health check
const health = await orchestrator.healthCheck();
console.log(`Overall Status: ${health.status}`);
console.log(`Mastra Engine: ${health.details.mastraEngine ? 'OK' : 'ERROR'}`);
console.log(`Workflow Engine: ${health.details.workflowEngine ? 'OK' : 'ERROR'}`);
```

## Agent Capabilities

### ExplorerAgent Capabilities

```typescript
const explorerCapabilities = await explorerAgent.getCapabilities();
console.log('Explorer Agent can:', {
  navigate: explorerCapabilities.canNavigate,
  interact: explorerCapabilities.canInteract,
  extract: explorerCapabilities.canExtract,
  handleAuth: explorerCapabilities.canHandleAuth,
  handleCaptcha: explorerCapabilities.canHandleCaptcha,
  takeScreenshots: explorerCapabilities.canTakeScreenshots,
  supportedBrowsers: explorerCapabilities.supportedBrowsers,
});

// Direct agent usage
const explorationResult = await explorerAgent.explore({
  url: 'https://example.com',
  domain: 'example.com',
  maxDepth: 3,
  maxPages: 25,
  patterns: ['product', 'service'],
});

console.log(`Explored ${explorationResult.pagesExplored} pages`);
console.log(`Found ${explorationResult.elementsFound} elements`);
console.log(`Recorded ${explorationResult.interactionsRecorded} interactions`);
```

### PlannerAgent Strategic Planning

```typescript
// Generate recommendations
const recommendations = await plannerAgent.generateRecommendations('ecommerce-site.com');
console.log('Recommended Strategy:', recommendations.strategy);
console.log('Estimated Duration:', recommendations.estimatedDuration / 1000 / 60, 'minutes');
console.log('Risk Level:', recommendations.riskAssessment.level);
console.log('Risk Factors:', recommendations.riskAssessment.factors);

// Create detailed plan
const plan = await plannerAgent.createPlan(
  targets,
  {
    domain: 'ecommerce-site.com',
    objectives: ['comprehensive', 'performance'],
    constraints: {
      timeLimit: 3600000,
      priorityAreas: ['checkout', 'product-search'],
    },
  }
);

console.log(`Plan Strategy: ${plan.strategy}`);
console.log(`Max Concurrency: ${plan.resources.maxConcurrency}`);
console.log(`Estimated Duration: ${plan.resources.timeout / 1000}s`);
```

### GeneratorAgent Test Creation

```typescript
// Generate tests with optimization
const generationResult = await generatorAgent.generateTests({
  userPaths: explorationResults.flatMap(r => r.userPaths),
  framework: 'playwright',
  language: 'typescript',
  options: {
    generatePageObjects: true,
    generateFixtures: true,
    generateHelpers: true,
    outputDirectory: './tests/generated',
  },
});

console.log(`Generated ${generationResult.metrics.testsGenerated} tests`);
console.log(`Created ${generationResult.metrics.pageObjectsGenerated} page objects`);
console.log(`Total lines of code: ${generationResult.metrics.linesOfCode}`);
console.log(`Code quality score: ${generationResult.quality.lintScore}/100`);

// Get optimization recommendations
const optimization = await generatorAgent.optimizeGeneration(userPaths);
console.log('Optimization Recommendations:', optimization.recommendations);
console.log('Estimated Maintainability Improvement:', 
  (optimization.estimatedImprovement.maintainability * 100).toFixed(1) + '%');
```

## Configuration

### Complete Configuration Example

```typescript
interface MastraOrchestratorConfig {
  // Browserbase configuration
  browserbase: {
    apiKey: string;
    projectId: string;
    region?: 'us-east-1' | 'us-west-2' | 'eu-west-1';
  };

  // Stagehand AI configuration
  stagehand: {
    modelName?: string; // Default: 'gpt-4'
    modelClientOptions?: Record<string, any>;
    enableCaching?: boolean; // Default: true
    headless?: boolean; // Default: true
    logger?: (message: string, level?: string) => void;
  };

  // System configuration
  monitoring?: MonitoringService;
  configManager?: ConfigManager;
  maxConcurrentWorkflows?: number; // Default: 5
  outputDirectory?: string; // Default: './generated-tests'
  enableTestGeneration?: boolean; // Default: true
  retryAttempts?: number; // Default: 3
  defaultTimeout?: number; // Default: 30000ms
}
```

### Environment Variables

```bash
# Browserbase Configuration
BROWSERBASE_API_KEY=your_browserbase_api_key
BROWSERBASE_PROJECT_ID=your_project_id
BROWSERBASE_REGION=us-east-1

# Stagehand Configuration
STAGEHAND_MODEL=gpt-4
STAGEHAND_API_KEY=your_openai_api_key

# System Configuration
MAX_CONCURRENT_WORKFLOWS=5
DEFAULT_TIMEOUT=30000
OUTPUT_DIRECTORY=./generated-tests
ENABLE_TEST_GENERATION=true

# Monitoring Configuration
MONITORING_ENABLED=true
METRICS_ENDPOINT=http://localhost:9090
```

## Integration Examples

### With Express.js API

```typescript
import express from 'express';
import { MastraOrchestrator } from './mastra';

const app = express();
const orchestrator = new MastraOrchestrator(config);

// Start exploration endpoint
app.post('/api/explore', async (req, res) => {
  try {
    const sessionId = await orchestrator.startExploration(req.body);
    res.json({ sessionId, status: 'started' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get exploration status
app.get('/api/explore/:sessionId', (req, res) => {
  const status = orchestrator.getExplorationStatus(req.params.sessionId);
  if (!status) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(status);
});

// Cancel exploration
app.delete('/api/explore/:sessionId', async (req, res) => {
  const cancelled = await orchestrator.cancelExploration(req.params.sessionId);
  res.json({ cancelled });
});

// System metrics
app.get('/api/metrics', (req, res) => {
  const metrics = orchestrator.getSystemMetrics();
  res.json(metrics);
});

// Health check
app.get('/api/health', async (req, res) => {
  const health = await orchestrator.healthCheck();
  res.json(health);
});
```

### With CLI Interface

```typescript
import { Command } from 'commander';
import { MastraOrchestrator } from './mastra';

const program = new Command();
const orchestrator = new MastraOrchestrator(config);

program
  .command('explore')
  .description('Start a web exploration')
  .option('-u, --url <url>', 'Target URL to explore')
  .option('-d, --depth <number>', 'Maximum exploration depth', '3')
  .option('-p, --pages <number>', 'Maximum pages to explore', '50')
  .option('--generate-tests', 'Generate tests after exploration')
  .option('--framework <framework>', 'Test framework to use', 'playwright')
  .option('--language <language>', 'Programming language for tests', 'typescript')
  .action(async (options) => {
    try {
      const sessionId = await orchestrator.startExploration({
        name: `CLI Exploration of ${options.url}`,
        targets: [{
          url: options.url,
          domain: new URL(options.url).hostname,
          maxDepth: parseInt(options.depth),
          maxPages: parseInt(options.pages),
        }],
        ...(options.generateTests && {
          testGenerationOptions: {
            framework: options.framework,
            language: options.language,
            generatePageObjects: true,
            generateFixtures: true,
            generateHelpers: true,
          },
        }),
      });

      console.log(`Exploration started: ${sessionId}`);
      
      // Monitor progress
      const interval = setInterval(() => {
        const status = orchestrator.getExplorationStatus(sessionId);
        if (!status) return;

        console.log(`Progress: ${status.progress.currentStep} (${status.progress.percentage}%)`);
        
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(interval);
          console.log(`Final Status: ${status.status}`);
          if (status.results) {
            console.log(`Pages Explored: ${status.results.metadata.totalPagesExplored}`);
            console.log(`Tests Generated: ${status.results.metadata.totalTestsGenerated}`);
          }
          process.exit(status.status === 'completed' ? 0 : 1);
        }
      }, 2000);

    } catch (error) {
      console.error('Exploration failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show system status and metrics')
  .action(async () => {
    const metrics = orchestrator.getSystemMetrics();
    const health = await orchestrator.healthCheck();
    
    console.log('System Status:', health.status);
    console.log('Active Sessions:', metrics.activeSessions);
    console.log('Total Sessions:', metrics.totalSessions);
    console.log('Success Rate:', (metrics.completedSessions / metrics.totalSessions * 100).toFixed(1) + '%');
    console.log('Average Duration:', (metrics.averageSessionDuration / 1000).toFixed(1) + 's');
  });

program.parse();
```

### With Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Build TypeScript
RUN npm run build

# Install Playwright browsers
RUN npx playwright install chromium

# Set environment variables
ENV NODE_ENV=production
ENV OUTPUT_DIRECTORY=/app/generated-tests
ENV MAX_CONCURRENT_WORKFLOWS=3

# Create output directory
RUN mkdir -p /app/generated-tests

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start application
CMD ["node", "dist/index.js"]
```

## Best Practices

### 1. Resource Management

```typescript
// Configure appropriate concurrency limits
const orchestrator = new MastraOrchestrator({
  maxConcurrentWorkflows: 3, // Don't overwhelm the system
  browserbase: {
    // Use different regions for better performance
    region: 'us-east-1', // Closest to your application
  },
  stagehand: {
    enableCaching: true, // Reduce API calls
    headless: true, // Better performance
  },
});
```

### 2. Error Handling and Resilience

```typescript
// Implement proper error handling
try {
  const sessionId = await orchestrator.startExploration(request);
  
  // Monitor session progress with timeout
  const timeout = setTimeout(() => {
    orchestrator.cancelExploration(sessionId);
    console.error('Exploration timed out');
  }, 3600000); // 1 hour timeout

  const checkStatus = async () => {
    const status = orchestrator.getExplorationStatus(sessionId);
    if (status?.status === 'completed') {
      clearTimeout(timeout);
      return status.results;
    } else if (status?.status === 'failed') {
      clearTimeout(timeout);
      throw new Error(status.error);
    }
    
    // Continue monitoring
    setTimeout(checkStatus, 5000);
  };

  checkStatus();

} catch (error) {
  logger.error('Exploration failed', { error: error.message });
  // Implement retry logic or fallback strategies
}
```

### 3. Performance Optimization

```typescript
// Optimize exploration targets
const optimizedTargets = targets.map(target => ({
  ...target,
  // Limit scope for better performance
  maxDepth: Math.min(target.maxDepth, 4),
  maxPages: Math.min(target.maxPages, 100),
  
  // Use specific patterns to focus exploration
  patterns: ['product', 'checkout', 'cart'], // Instead of exploring everything
  excludePatterns: ['admin', 'internal', 'debug'],
  
  // Configure selectors for better element detection
  selectors: {
    include: ['[data-testid]', '[aria-label]', 'button', 'a', 'input'],
    exclude: ['.advertisement', '.cookie-banner', '.popup'],
  },
}));
```

### 4. Test Generation Best Practices

```typescript
// Configure test generation for maintainability
const testGenerationOptions = {
  framework: 'playwright',
  language: 'typescript',
  generatePageObjects: true, // Essential for maintainability
  generateFixtures: true, // Reusable test data
  generateHelpers: true, // Common operations
};

// Post-generation optimization
const optimization = await generatorAgent.optimizeGeneration(userPaths);
if (optimization.estimatedImprovement.maintainability > 0.2) {
  console.log('Consider applying these optimizations:', optimization.recommendations);
}
```

### 5. Monitoring and Observability

```typescript
// Set up comprehensive monitoring
const monitoring = new MonitoringService({
  metrics: {
    exploration: ['session_duration', 'pages_per_session', 'success_rate'],
    generation: ['tests_generated', 'code_quality_score', 'generation_time'],
    system: ['memory_usage', 'cpu_usage', 'active_sessions'],
  },
  alerting: {
    failureRate: { threshold: 0.1, window: '5m' },
    responseTime: { threshold: 30000, window: '1m' },
    memoryUsage: { threshold: 0.8, window: '1m' },
  },
});

// Regular health checks
setInterval(async () => {
  const health = await orchestrator.healthCheck();
  if (health.status !== 'healthy') {
    logger.warn('System health degraded', health.details);
    // Implement corrective actions
  }
}, 60000);
```

## Troubleshooting

### Common Issues

#### 1. Browserbase Connection Errors
```typescript
// Check API credentials and project configuration
const testConnection = async () => {
  try {
    // This would test the Browserbase connection
    console.log('Browserbase connection: OK');
  } catch (error) {
    console.error('Browserbase connection failed:', error.message);
    // Check API key, project ID, and network connectivity
  }
};
```

#### 2. Stagehand AI Model Issues
```typescript
// Configure fallback models
const stagehandConfig = {
  modelName: 'gpt-4',
  modelClientOptions: {
    fallbackModels: ['gpt-3.5-turbo', 'claude-3-sonnet'],
    maxRetries: 3,
    timeout: 30000,
  },
};
```

#### 3. High Memory Usage
```typescript
// Monitor and manage memory usage
const monitorMemory = () => {
  const usage = process.memoryUsage();
  if (usage.heapUsed > 1024 * 1024 * 1024) { // 1GB
    logger.warn('High memory usage detected', { usage });
    // Reduce concurrent sessions
    orchestrator.config.maxConcurrentWorkflows = Math.max(1, 
      orchestrator.config.maxConcurrentWorkflows - 1
    );
  }
};

setInterval(monitorMemory, 30000);
```

#### 4. Test Generation Failures
```typescript
// Implement robust error handling for test generation
const generateTestsWithFallback = async (userPaths) => {
  try {
    return await generatorAgent.generateTests({
      userPaths,
      framework: 'playwright',
      language: 'typescript',
      options: { generatePageObjects: true, generateFixtures: true, generateHelpers: true },
    });
  } catch (error) {
    logger.warn('Full test generation failed, trying minimal generation', { error: error.message });
    
    // Fallback to minimal generation
    return await generatorAgent.generateTests({
      userPaths,
      framework: 'playwright',
      language: 'typescript',
      options: { generatePageObjects: false, generateFixtures: false, generateHelpers: false },
    });
  }
};
```

### Debug Mode

```typescript
// Enable debug logging
const orchestrator = new MastraOrchestrator({
  ...config,
  stagehand: {
    ...config.stagehand,
    logger: (message, level) => {
      if (process.env.DEBUG) {
        console.log(`[${level?.toUpperCase() || 'INFO'}] ${message}`);
      }
    },
  },
});

// Run with debug enabled
// DEBUG=* node dist/index.js
```

## Future Enhancements

### Planned Features

1. **Advanced Scheduling**: Cron-based scheduling with complex patterns
2. **Multi-Model Support**: Support for different AI models and providers
3. **Visual Testing**: Screenshot comparison and visual regression testing
4. **API Testing**: REST/GraphQL API exploration and test generation
5. **Performance Testing**: Load testing scenario generation
6. **Accessibility Testing**: WCAG compliance checking and reporting
7. **Cross-Browser Testing**: Multi-browser exploration and testing
8. **Mobile Testing**: Mobile browser and app testing support
9. **Cloud Integration**: Enhanced cloud provider integrations
10. **Machine Learning**: Predictive analytics for exploration optimization

### Extension Points

The Mastra integration is designed to be extensible:

- **Custom Agents**: Implement specialized agents for specific domains
- **Workflow Steps**: Add custom steps to the exploration workflow  
- **Test Generators**: Support additional testing frameworks and languages
- **Notification Channels**: Integrate with various communication platforms
- **Storage Backends**: Support different storage solutions for results
- **Authentication Providers**: Add support for various auth mechanisms

This comprehensive Mastra integration provides a robust, scalable foundation for AI-powered web exploration and test generation, leveraging the latest technologies and best practices in the field.