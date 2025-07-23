# Browser Explorer Documentation

Welcome to the Browser Explorer documentation. This AI-powered web browsing agent automatically explores websites, tests interactive elements, and generates comprehensive Playwright test suites.

## Table of Contents

### Getting Started
- [Installation Guide](./guides/installation.md)
- [Quick Start](./guides/quick-start.md)
- [Configuration](./guides/configuration.md)

### Architecture
- [System Overview](./architecture/overview.md)
- [Component Architecture](./architecture/components.md)
- [Data Flow](./architecture/data-flow.md)

### Features
- [Breadth-First Crawler](./features/crawler.md)
- [AI Element Detection](./features/element-detection.md)
- [Interaction Executor](./features/interaction-executor.md)
- [User Path Recording](./features/path-recording.md)
- [Test Generation](./features/test-generation.md)

### API Reference
- [BrowserAgent](./api/browser-agent.md)
- [BreadthFirstCrawler](./api/crawler.md)
- [AIElementDetector](./api/element-detector.md)
- [InteractionExecutor](./api/interaction-executor.md)

### Development
- [Docker Setup](./guides/docker-setup.md)
- [Testing](./guides/testing.md)
- [Contributing](./guides/contributing.md)

## Overview

Browser Explorer is a sophisticated web automation tool that combines AI-powered element detection with systematic website exploration to automatically generate comprehensive test suites.

### Key Features

- **Intelligent Crawling**: Uses breadth-first search to systematically explore entire websites
- **AI-Powered Detection**: Leverages Stagehand AI to identify and classify interactive elements
- **Comprehensive Testing**: Tests all interactive elements including forms, buttons, dropdowns, and more
- **Path Recording**: Captures complete user interaction sequences with timing and context
- **Test Generation**: Creates maintainable Playwright TypeScript tests with assertions
- **Enterprise Ready**: Includes authentication support, error handling, and scalability features

### Architecture Highlights

The system is built on a modular architecture with clear separation of concerns:

- **Crawling Layer**: Manages website exploration and URL discovery
- **Detection Layer**: Identifies and classifies interactive elements
- **Interaction Layer**: Executes interactions with smart strategies
- **Recording Layer**: Captures user paths and state changes
- **Generation Layer**: Produces clean, maintainable test code

### Quick Example

```typescript
import { CrawlerService } from 'browser-explorer';

// Configure the crawler
const crawler = new CrawlerService({
  startUrl: 'https://example.com',
  maxDepth: 3,
  maxPages: 100,
  respectRobotsTxt: true,
});

// Start crawling and generating tests
await crawler.initialize();
const results = await crawler.crawl();

console.log(`Crawled ${results.pagesVisited} pages`);
console.log(`Generated ${results.testsGenerated} test files`);
```

## Next Steps

- [Installation Guide](./guides/installation.md) - Get started with Browser Explorer
- [Architecture Overview](./architecture/overview.md) - Understand the system design
- [API Reference](./api/browser-agent.md) - Explore the API documentation