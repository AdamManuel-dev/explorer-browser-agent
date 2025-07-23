# Testing Module

The testing module provides comprehensive self-testing and validation capabilities for the Browser Explorer system, ensuring all components function correctly in different environments.

## Components

### SelfTestRunner

A comprehensive testing framework that validates the Browser Explorer system's functionality across all components and integration points.

**Features:**
- **Component Testing**: Individual module validation
- **Integration Testing**: End-to-end workflow validation
- **Performance Testing**: Memory usage, speed, and load testing
- **Browser Testing**: Playwright integration validation
- **Error Recovery**: Resilience and fault tolerance testing
- **Environment Validation**: System requirements verification

## Usage

### Command Line Interface

The self-test runner provides a comprehensive CLI for system validation:

```bash
# Run complete test suite
npm run self-test

# Quick health check
npm run self-test:quick

# Validate system requirements
npm run self-test:validate

# Run specific component tests
browser-explorer-self-test run --components crawler,detector,monitoring

# Run with custom configuration
browser-explorer-self-test run --output ./test-reports --timeout 60000
```

### Programmatic Usage

```typescript
import { SelfTestRunner } from './testing';

const runner = new SelfTestRunner({
  testTimeout: 30000,
  retryAttempts: 2,
  skipBrowserTests: false,
  outputDirectory: './test-reports',
  componentTests: {
    crawler: true,
    detector: true,
    executor: true,
    monitoring: true,
    auth: true,
    stealth: true,
    captcha: true,
    config: true,
  },
});

const report = await runner.runAllTests();
console.log(`Tests completed: ${report.summary.successRate * 100}% success rate`);
```

## Test Categories

### Component Tests

Validate individual system components:

#### Configuration Manager
- Default configuration loading
- Configuration validation
- Schema compliance

#### Monitoring Service
- Metrics recording and retrieval
- Distributed tracing
- Alert generation
- System metrics collection

#### Element Detector
- Element type classification
- Selector generation
- Interactive element identification

#### Interaction Executor
- Strategy availability
- Interaction validation
- Execution capability

#### Authentication Manager
- Strategy registration
- Credential validation
- Session management

#### Session Manager
- Session persistence
- Cross-domain support
- Encryption/decryption

#### Stealth Mode
- User agent generation
- Fingerprint spoofing
- Behavior simulation

#### CAPTCHA Handler
- Detection patterns
- Solving strategies
- Service integration

### Browser Tests

Validate browser-dependent functionality:

#### Basic Crawling
```typescript
// Tests actual browser automation
const crawler = new BreadthFirstCrawler(browser);
const result = await crawler.crawl({
  startUrl: 'http://localhost:3000',
  maxDepth: 2,
  maxPages: 10,
});

// Validates:
// - Browser initialization
// - Page navigation
// - Element detection
// - URL extraction
// - Result aggregation
```

#### Element Detection
```typescript
// Tests real DOM interaction
const detector = new AIElementDetector();
const elements = await detector.detectElements(page);

// Validates:
// - DOM querying
// - Element classification
// - Selector generation
// - Interaction capability assessment
```

#### User Path Recording
```typescript
// Tests interaction recording
const recorder = new UserPathRecorder();
recorder.startRecording(page, 'test-recording');

await page.fill('#input', 'test');
await page.click('#button');

const path = await recorder.stopRecording();

// Validates:
// - Event capture
// - Timing accuracy
// - Screenshot generation
// - Path serialization
```

### Integration Tests

End-to-end workflow validation:

#### Complete Workflow
- Full exploration cycle
- Configuration loading
- Authentication handling
- Content crawling
- Test generation
- Result reporting

#### Authentication Workflow
- Multi-strategy authentication
- Session persistence
- Cross-browser restoration
- Error handling

#### Performance Workflow
- Resource utilization
- Memory management
- Concurrent operations
- Scalability testing

### Performance Tests

System performance and resource validation:

#### Memory Usage
```typescript
// Tests memory consumption patterns
const initialMemory = process.memoryUsage().heapUsed;

// Perform memory-intensive operations
await runLargeScaleCrawl();

const finalMemory = process.memoryUsage().heapUsed;
const memoryIncrease = finalMemory - initialMemory;

// Validates:
// - Memory leak detection
// - Resource cleanup
// - Garbage collection effectiveness
// - Memory usage thresholds
```

#### Crawl Performance
- Response time measurement
- Throughput analysis
- Resource utilization
- Scalability limits

#### Generation Performance
- Test creation speed
- File output efficiency
- Code quality metrics
- Resource consumption

#### Concurrent Operations
```typescript
// Tests system under concurrent load
const operations = Array.from({ length: 10 }, (_, i) =>
  monitoring.timeFunction(`concurrent_op_${i}`, async () => {
    return await performOperation();
  })
);

const results = await Promise.all(operations);

// Validates:
// - Concurrent execution capability
// - Resource contention handling
// - Performance degradation under load
// - Error isolation
```

## Configuration

### Test Configuration

```typescript
interface SelfTestConfig {
  testTimeout: number; // Maximum time per test
  retryAttempts: number; // Retry failed tests
  skipBrowserTests: boolean; // Skip browser-dependent tests
  outputDirectory: string; // Test report output
  
  testEndpoints: {
    enabled: boolean;
    urls: string[]; // External endpoints to test
  };
  
  componentTests: {
    crawler: boolean;
    detector: boolean;
    executor: boolean;
    recorder: boolean;
    generator: boolean;
    monitoring: boolean;
    auth: boolean;
    stealth: boolean;
    captcha: boolean;
    config: boolean;
  };
  
  performanceThresholds: {
    maxCrawlTime: number; // Maximum crawl time (ms)
    maxGenerationTime: number; // Maximum generation time (ms)
    maxMemoryUsage: number; // Maximum memory usage (bytes)
    minSuccessRate: number; // Minimum success rate (0-1)
  };
}
```

### Environment Requirements

The self-test runner validates system requirements:

```typescript
// Node.js version check
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
assert(majorVersion >= 16, 'Node.js 16+ required');

// Memory availability
const totalMemory = os.totalmem();
const freeMemory = os.freemem();
assert(totalMemory >= 4 * 1024 * 1024 * 1024, '4GB+ RAM recommended');

// Playwright browsers
const browser = await chromium.launch();
assert(browser, 'Playwright browsers must be installed');

// File system permissions
const testFile = path.join(process.cwd(), '.test-permission');
fs.writeFileSync(testFile, 'test');
fs.unlinkSync(testFile);
```

## Test Reports

### Report Structure

```typescript
interface SelfTestReport {
  timestamp: Date;
  environment: {
    nodeVersion: string;
    platform: string;
    architecture: string;
    memoryTotal: number;
    memoryUsed: number;
  };
  configuration: SelfTestConfig;
  results: TestResult[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    totalDuration: number;
    successRate: number;
    overallHealth: 'healthy' | 'degraded' | 'unhealthy';
  };
  recommendations: string[];
}
```

### Individual Test Results

```typescript
interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
  details?: Record<string, any>;
  metrics?: Record<string, number>;
}
```

### Health Assessment

The system determines overall health based on:

- **Healthy**: All critical tests pass, success rate ≥ 80%
- **Degraded**: Some non-critical tests fail, success rate 50-80%
- **Unhealthy**: Critical tests fail, success rate < 50%

## CLI Commands

### Full Test Suite

```bash
# Run all tests with default configuration
browser-explorer-self-test run

# Custom configuration
browser-explorer-self-test run \
  --output ./reports \
  --timeout 45000 \
  --retries 3 \
  --components crawler,monitoring,auth
```

### Quick Health Check

```bash
# Fast system validation
browser-explorer-self-test quick

# With verbose output
browser-explorer-self-test quick --verbose
```

### System Validation

```bash
# Check system requirements
browser-explorer-self-test validate

# Validate specific components
browser-explorer-self-test components
```

### Available Options

- `--output, -o`: Output directory for reports
- `--skip-browser`: Skip browser-dependent tests
- `--timeout`: Test timeout in milliseconds
- `--retries`: Number of retry attempts
- `--components`: Comma-separated list of components to test
- `--performance-only`: Run only performance tests
- `--quick`: Run quick subset of tests
- `--verbose`: Enable verbose logging

## Integration with CI/CD

### GitHub Actions

```yaml
- name: Run Self-Test Validation
  run: npm run self-test:validate

- name: Run Quick Health Check
  run: npm run self-test:quick

- name: Run Full Test Suite
  run: npm run self-test
  env:
    NODE_OPTIONS: --max-old-space-size=4096
```

### Docker Integration

```dockerfile
# Add self-test validation to Docker health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD npm run self-test:quick || exit 1
```

### Monitoring Integration

```typescript
// Integrate with monitoring service
const monitoring = new MonitoringService();
const runner = new SelfTestRunner({
  monitoring: monitoring, // Enable test metrics collection
});

const report = await runner.runAllTests();

// Report test results as metrics
monitoring.recordGauge('self_test_success_rate', report.summary.successRate);
monitoring.recordCounter('self_test_runs_total', 1, {
  status: report.summary.overallHealth
});
```

## Best Practices

1. **Regular Testing**: Run self-tests regularly in CI/CD pipelines
2. **Environment Validation**: Always validate system requirements before deployment
3. **Performance Monitoring**: Track test performance over time to detect regressions
4. **Error Analysis**: Investigate test failures promptly to maintain system health
5. **Resource Management**: Monitor resource usage during tests to prevent conflicts
6. **Timeout Configuration**: Set appropriate timeouts based on system capabilities

## Troubleshooting

### Common Issues

#### Browser Tests Failing
```bash
# Install Playwright browsers
npx playwright install chromium

# Check browser availability
browser-explorer-self-test validate
```

#### Memory Issues
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Run with reduced test scope
browser-explorer-self-test run --skip-browser --quick
```

#### Permission Errors
```bash
# Check file system permissions
ls -la $(pwd)

# Run with appropriate permissions
sudo browser-explorer-self-test run --output /tmp/reports
```

#### Network Timeouts
```bash
# Increase timeout for network operations
browser-explorer-self-test run --timeout 60000
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=browser-explorer:* browser-explorer-self-test run --verbose

# Run single component test
browser-explorer-self-test run --components config --verbose
```

## Custom Test Extensions

### Adding Custom Tests

```typescript
class CustomSelfTestRunner extends SelfTestRunner {
  async runCustomTests(): Promise<void> {
    await this.runSingleTest('Custom Database Test', async () => {
      // Custom test implementation
      const connection = await connectToDatabase();
      await connection.query('SELECT 1');
      return { connectionTime: Date.now() };
    });
  }
}
```

### Custom Validation

```typescript
// Add custom system requirements
const customValidation = {
  checkDatabaseConnection: async () => {
    try {
      await connectToDatabase();
      return { success: true, details: 'Database accessible' };
    } catch (error) {
      return { success: false, details: error.message };
    }
  }
};

runner.addCustomValidation(customValidation);
```