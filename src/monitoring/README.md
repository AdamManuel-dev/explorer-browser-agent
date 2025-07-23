# Monitoring Module

The monitoring module provides comprehensive metrics collection, distributed tracing, alerting, and performance monitoring for the Browser Explorer system.

## Components

### MonitoringService

A comprehensive monitoring service that collects metrics, traces operations, and provides health monitoring capabilities.

**Features:**
- **Metrics Collection**: Counters, gauges, histograms, and timers
- **Distributed Tracing**: Span-based operation tracking
- **System Metrics**: CPU, memory, and network monitoring
- **Alerting**: Configurable thresholds and notifications
- **Reporting**: Automated health reports and summaries
- **Multiple Export Formats**: Prometheus, JSON, console output

## Core Concepts

### Metrics Types

#### Counters
Track cumulative values that only increase:
```typescript
monitoring.recordCounter('pages_crawled_total', 1, { status: 'success' });
monitoring.recordCounter('errors_total', 1, { error_type: 'network' });
```

#### Gauges
Track values that can go up or down:
```typescript
monitoring.recordGauge('active_crawlers', 5);
monitoring.recordGauge('memory_usage_bytes', process.memoryUsage().heapUsed);
```

#### Histograms
Track distributions of values:
```typescript
monitoring.recordHistogram('response_time_ms', 250, [100, 500, 1000, 5000]);
```

#### Timers
Track operation durations:
```typescript
monitoring.recordTimer('page_load_time', 1250, { url: 'example.com' });
```

### Distributed Tracing

Track operations across multiple components:
```typescript
const spanId = monitoring.startSpan('crawl_website', undefined, {
  url: 'https://example.com',
  depth: 2,
});

monitoring.addSpanLog(spanId, 'info', 'Starting page analysis');
monitoring.addSpanTag(spanId, 'pages_found', 15);

monitoring.finishSpan(spanId, { success: true });
```

## Usage

### Basic Setup

```typescript
import { MonitoringService } from './monitoring';

const monitoring = new MonitoringService({
  enabled: true,
  metricsCollection: {
    enabled: true,
    flushInterval: 30000, // 30 seconds
    maxMetrics: 10000,
    exportFormat: 'prometheus',
  },
  tracing: {
    enabled: true,
    samplingRate: 0.1, // 10% sampling
    maxSpans: 1000,
  },
  alerting: {
    enabled: true,
    thresholds: {
      errorRate: 0.05, // 5%
      responseTime: 5000, // 5 seconds
      memoryUsage: 0.8, // 80%
    },
  },
});

await monitoring.initialize();
```

### Metrics Collection

```typescript
// Application metrics
monitoring.recordCounter('requests_total', 1, { 
  method: 'GET', 
  status: '200' 
});

monitoring.recordGauge('queue_size', 42);

monitoring.recordHistogram('request_duration_ms', 150, 
  [50, 100, 250, 500, 1000]
);

// Crawl-specific metrics
monitoring.trackPageRequest('https://example.com', true, 250, 1024);
monitoring.trackCaptchaSolved('recaptcha', true, 5000);
monitoring.trackAuthenticationAttempt('oauth', true);
```

### Timing Operations

```typescript
// Manual timing
const endTimer = monitoring.startTimer('database_query');
await performDatabaseQuery();
endTimer();

// Automatic timing with function wrapper
const result = await monitoring.timeFunction(
  'complex_operation',
  async () => {
    return await performComplexOperation();
  },
  { operation_type: 'data_processing' }
);
```

### Distributed Tracing

```typescript
// Parent operation
const crawlSpanId = monitoring.startSpan('crawl_website', undefined, {
  url: 'https://example.com',
  max_depth: 3,
});

// Child operations
const pageSpanId = monitoring.startSpan('process_page', crawlSpanId, {
  page_url: 'https://example.com/about',
});

monitoring.addSpanLog(pageSpanId, 'info', 'Extracting page content');
monitoring.addSpanTag(pageSpanId, 'links_found', 25);

monitoring.finishSpan(pageSpanId);
monitoring.finishSpan(crawlSpanId, { pages_processed: 50 });
```

## Configuration

### Metrics Configuration

```typescript
const metricsConfig = {
  enabled: true,
  flushInterval: 30000, // Flush every 30 seconds
  maxMetrics: 10000, // Max metrics in memory
  exportFormat: 'prometheus', // 'prometheus', 'json', 'console'
};
```

### Tracing Configuration

```typescript
const tracingConfig = {
  enabled: true,
  samplingRate: 0.1, // Sample 10% of operations
  maxSpans: 1000, // Max spans in memory
  exportEndpoint: 'http://jaeger:14268/api/traces',
};
```

### Alerting Configuration

```typescript
const alertingConfig = {
  enabled: true,
  thresholds: {
    errorRate: 0.05, // Alert if error rate > 5%
    responseTime: 5000, // Alert if avg response time > 5s
    memoryUsage: 0.8, // Alert if memory usage > 80%
    crawlFailureRate: 0.1, // Alert if crawl failure rate > 10%
  },
  webhookUrl: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK',
};
```

## System Metrics

### Automatic Collection

The monitoring service automatically collects system metrics:

```typescript
const systemMetrics = await monitoring.collectSystemMetrics();

console.log({
  cpu: systemMetrics.cpu.usage,
  memory: {
    used: systemMetrics.memory.used,
    total: systemMetrics.memory.total,
    heapUsed: systemMetrics.memory.heapUsed,
  },
  process: {
    uptime: systemMetrics.process.uptime,
    pid: systemMetrics.process.pid,
  },
});
```

## Reporting

### Health Reports

```typescript
const report = await monitoring.generateReport();

console.log({
  timestamp: report.timestamp,
  systemHealth: report.summary.overallHealth,
  crawlMetrics: {
    totalRequests: report.crawlMetrics.totalRequests,
    successRate: (report.crawlMetrics.successfulRequests / report.crawlMetrics.totalRequests),
    avgResponseTime: report.crawlMetrics.averageResponseTime,
  },
  alerts: report.alerts,
  recommendations: report.recommendations,
});
```

### Custom Reports

```typescript
// Generate custom performance report
const performanceData = {
  crawlingMetrics: monitoring.getMetrics('crawl_'),
  responseTimeMetrics: monitoring.getMetrics('response_time'),
  errorMetrics: monitoring.getMetrics('error_'),
};

const customReport = {
  period: '24h',
  metrics: performanceData,
  summary: {
    totalOperations: calculateTotalOperations(performanceData),
    avgPerformance: calculateAveragePerformance(performanceData),
    errorRate: calculateErrorRate(performanceData),
  },
};
```

## Export Formats

### Prometheus Format

```typescript
const monitoring = new MonitoringService({
  metricsCollection: {
    exportFormat: 'prometheus',
  },
});

// Metrics exported in Prometheus format:
// crawl_requests_total{status="success"} 1500
// crawl_response_time_seconds_bucket{le="0.1"} 100
// crawl_memory_usage_bytes 134217728
```

### JSON Format

```typescript
const monitoring = new MonitoringService({
  metricsCollection: {
    exportFormat: 'json',
  },
});

// Metrics exported as JSON:
/*
{
  "crawl_requests_total": [
    {"value": 1500, "labels": {"status": "success"}, "timestamp": "2023-..."}
  ],
  "response_time_histogram": [
    {"value": 250, "buckets": [100, 500, 1000], "timestamp": "2023-..."}
  ]
}
*/
```

### Console Format

```typescript
const monitoring = new MonitoringService({
  metricsCollection: {
    exportFormat: 'console',
  },
});

// Metrics printed to console:
// crawl_requests_total: 1500 (counter)
// response_time_avg: 250ms (gauge)
// memory_usage: 128MB (gauge)
```

## Integration Examples

### With Crawling

```typescript
const crawler = new BreadthFirstCrawler(browser);

// Enable monitoring for crawler
const result = await crawler.crawl({
  startUrl: 'https://example.com',
  maxDepth: 2,
  maxPages: 100,
  monitoring: monitoring, // Pass monitoring instance
});

// Crawler automatically reports metrics:
// - pages_crawled_total
// - crawl_duration_ms
// - crawl_errors_total
// - bytes_downloaded_total
```

### With Testing

```typescript
const testGenerator = new TestGenerator({
  framework: 'playwright',
  monitoring: monitoring,
});

// Test generation metrics automatically tracked:
// - tests_generated_total
// - generation_duration_ms
// - files_created_total
```

### With Authentication

```typescript
const authManager = new MultiStrategyAuthManager({
  monitoring: monitoring,
});

// Authentication metrics automatically tracked:
// - auth_attempts_total
// - auth_success_rate
// - auth_duration_ms
```

## Best Practices

1. **Sampling**: Use appropriate sampling rates for high-volume operations
2. **Labels**: Use consistent label naming and avoid high-cardinality labels
3. **Aggregation**: Aggregate metrics at appropriate intervals
4. **Storage**: Configure appropriate retention policies for metrics data
5. **Alerting**: Set meaningful thresholds based on baseline measurements
6. **Performance**: Monitor the monitoring system's own resource usage

## Troubleshooting

### High Memory Usage

```typescript
// Reduce metrics retention
const monitoring = new MonitoringService({
  metricsCollection: {
    maxMetrics: 1000, // Reduce from default
    flushInterval: 10000, // Flush more frequently
  },
});
```

### Missing Metrics

```typescript
// Check if monitoring is enabled
if (!monitoring.config.enabled) {
  console.log('Monitoring is disabled');
}

// Verify metrics are being recorded
const metrics = monitoring.getMetrics();
console.log('Recorded metrics:', Object.keys(metrics));
```

### Trace Performance Impact

```typescript
// Reduce tracing overhead
const monitoring = new MonitoringService({
  tracing: {
    enabled: true,
    samplingRate: 0.01, // Sample only 1% of operations
  },
});
```

## Advanced Usage

### Custom Metrics Exporter

```typescript
class CustomMetricsExporter {
  async export(metrics: Record<string, Metric[]>) {
    // Send metrics to custom endpoint
    await fetch('https://your-metrics-api.com/metrics', {
      method: 'POST',
      body: JSON.stringify(metrics),
    });
  }
}

// Register custom exporter
monitoring.registerExporter(new CustomMetricsExporter());
```

### Metric Aggregation

```typescript
// Aggregate metrics over time windows
const aggregator = new MetricsAggregator({
  windows: ['1m', '5m', '1h', '24h'],
  functions: ['sum', 'avg', 'max', 'p95', 'p99'],
});

const aggregatedMetrics = aggregator.aggregate(
  monitoring.getMetrics('response_time'),
  '5m'
);
```