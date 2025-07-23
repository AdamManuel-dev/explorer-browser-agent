# Breadth-First Crawler

The Breadth-First Crawler is the core component responsible for systematic website exploration. It implements a queue-based BFS algorithm to discover and visit pages in a controlled, efficient manner.

## Overview

The crawler explores websites level by level, ensuring complete coverage of accessible pages while respecting configured boundaries and limitations.

## Key Features

### 1. Queue-Based BFS Algorithm
```typescript
// Conceptual flow
Start with initial URL at depth 0
While queue is not empty and within limits:
  Process all URLs at current depth
  Discover child URLs
  Add child URLs to queue at depth + 1
```

### 2. URL Normalization
Ensures consistent URL handling and prevents duplicate visits:
- Removes URL fragments (`#section`)
- Strips `www` prefix
- Removes trailing slashes
- Sorts query parameters
- Handles protocol normalization

### 3. Robots.txt Compliance
```typescript
const crawler = new BreadthFirstCrawler({
  respectRobotsTxt: true,
  userAgent: 'BrowserExplorer/1.0'
});
```

### 4. Domain Boundary Control
```typescript
const crawler = new BreadthFirstCrawler({
  allowedDomains: ['example.com', 'docs.example.com'],
  // Won't crawl external links
});
```

## Configuration

### Basic Configuration
```typescript
interface CrawlConfiguration {
  startUrl: string;           // Starting point for crawl
  maxDepth: number;           // Maximum depth to explore
  maxPages: number;           // Maximum pages to visit
  crawlDelay: number;         // Delay between requests (ms)
  allowedDomains: string[];   // Domains to crawl
  respectRobotsTxt: boolean;  // Honor robots.txt
  userAgent: string;          // User agent string
  customHeaders?: Record<string, string>;
  parallelWorkers?: number;   // Concurrent crawlers
}
```

### Example Configuration
```typescript
const config: CrawlConfiguration = {
  startUrl: 'https://example.com',
  maxDepth: 3,
  maxPages: 100,
  crawlDelay: 1000,
  allowedDomains: ['example.com'],
  respectRobotsTxt: true,
  userAgent: 'BrowserExplorer/1.0',
  parallelWorkers: 5
};
```

## Usage

### Basic Usage
```typescript
import { BreadthFirstCrawler } from 'browser-explorer';

const crawler = new BreadthFirstCrawler(config);
const result = await crawler.crawl();

console.log(`Visited ${result.pagesVisited} pages`);
console.log(`Found ${result.urls.length} unique URLs`);
```

### With Custom Page Handler
```typescript
const crawler = new BreadthFirstCrawler(config);

// Override the crawlPage method
crawler.crawlPage = async (url: string) => {
  // Custom page processing logic
  const page = await browser.newPage();
  await page.goto(url);
  
  // Extract URLs
  const urls = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href]'))
      .map(a => a.href);
  });
  
  await page.close();
  return urls;
};

const result = await crawler.crawl();
```

## Crawl Results

### Result Structure
```typescript
interface CrawlResult {
  pagesVisited: number;
  urls: string[];
  errors: CrawlError[];
  duration: number;
  crawlTree: Map<string, CrawlNode[]>;
}

interface CrawlError {
  url: string;
  error: string;
  timestamp: Date;
}

interface CrawlNode {
  url: string;
  depth: number;
  parentUrl?: string;
  discoveredAt: Date;
}
```

### Analyzing Results
```typescript
const result = await crawler.crawl();

// Get all pages at specific depth
const depthTwoPages = Array.from(result.crawlTree.values())
  .flat()
  .filter(node => node.depth === 2);

// Find broken links
const brokenLinks = result.errors
  .filter(err => err.error.includes('404'));

// Build site structure
const siteStructure = buildTreeFromCrawlResult(result.crawlTree);
```

## Advanced Features

### 1. Parallel Crawling
```typescript
const crawler = new BreadthFirstCrawler({
  ...config,
  parallelWorkers: 10  // Process 10 pages concurrently
});
```

### 2. Custom URL Filters
```typescript
class CustomCrawler extends BreadthFirstCrawler {
  protected isValidUrl(url: string): boolean {
    // Skip PDF files
    if (url.endsWith('.pdf')) return false;
    
    // Skip image files
    if (/\.(jpg|png|gif|svg)$/i.test(url)) return false;
    
    return super.isValidUrl(url);
  }
}
```

### 3. Progress Monitoring
```typescript
const crawler = new BreadthFirstCrawler(config);

crawler.on('pageVisited', (url, depth) => {
  console.log(`Visited: ${url} (depth: ${depth})`);
});

crawler.on('error', (url, error) => {
  console.error(`Error at ${url}:`, error);
});
```

### 4. State Persistence
```typescript
// Save crawl state
const state = crawler.getState();
await saveToDatabase(state);

// Resume from saved state
const savedState = await loadFromDatabase();
crawler.setState(savedState);
await crawler.resume();
```

## Performance Optimization

### 1. Memory Management
- Automatic deduplication of URLs
- Efficient queue management
- Periodic memory cleanup

### 2. Network Optimization
- Connection pooling
- Request batching
- Smart retry logic

### 3. Caching
- Robots.txt caching
- URL normalization cache
- Response caching (optional)

## Error Handling

### Retry Logic
```typescript
const crawler = new BreadthFirstCrawler({
  ...config,
  retryAttempts: 3,
  retryDelay: 1000,
  retryMultiplier: 2  // Exponential backoff
});
```

### Error Types
- Network errors (timeout, connection refused)
- HTTP errors (404, 500)
- Parsing errors
- Robot.txt violations
- Domain boundary violations

## Integration Points

### With Browser Agent
```typescript
const crawlerService = new CrawlerService(config);
await crawlerService.initialize();
const result = await crawlerService.crawl();
```

### With Element Detector
```typescript
crawler.onPageLoad = async (page) => {
  const detector = new AIElementDetector();
  const elements = await detector.detectInteractiveElements(page);
  // Process elements
};
```

## Best Practices

1. **Set Reasonable Limits**
   - Don't crawl entire large websites
   - Use appropriate crawl delays
   - Respect server resources

2. **Handle Errors Gracefully**
   - Implement retry logic
   - Log errors for analysis
   - Continue crawling after errors

3. **Monitor Performance**
   - Track memory usage
   - Monitor crawl speed
   - Analyze error patterns

4. **Respect Website Policies**
   - Always check robots.txt
   - Use appropriate user agents
   - Implement rate limiting

## Examples

### Crawling with Authentication
```typescript
const crawler = new BreadthFirstCrawler(config);

// Add authentication cookies
crawler.beforeCrawl = async (browser) => {
  const page = await browser.newPage();
  await page.goto('https://example.com/login');
  // Perform login
  const cookies = await page.cookies();
  await browser.setCookies(cookies);
};
```

### Focused Crawling
```typescript
const crawler = new BreadthFirstCrawler({
  ...config,
  urlFilter: (url) => {
    // Only crawl product pages
    return url.includes('/products/');
  }
});
```

## Troubleshooting

### Common Issues

1. **Slow Crawling**
   - Increase parallel workers
   - Reduce crawl delay
   - Check network latency

2. **Memory Issues**
   - Reduce max pages
   - Enable periodic cleanup
   - Use streaming for large sites

3. **Missing Pages**
   - Check robots.txt rules
   - Verify domain boundaries
   - Look for JavaScript-rendered content

## Next Steps

- [AI Element Detection](./element-detection.md) - How elements are identified
- [Interaction Executor](./interaction-executor.md) - How elements are tested
- [API Reference](../api/crawler.md) - Detailed API documentation