# Architecture Overview

Browser Explorer is built on a layered architecture that separates concerns and enables modular development. This document provides a high-level overview of the system architecture.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                         │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐       │
│  │   CLI       │  │   API       │  │  Web UI      │       │
│  │  Interface  │  │  Server     │  │  (Future)    │       │
│  └─────────────┘  └─────────────┘  └──────────────┘       │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                   Service Layer                             │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐       │
│  │  Crawler    │  │  Detector   │  │  Generator   │       │
│  │  Service    │  │  Service    │  │  Service     │       │
│  └─────────────┘  └─────────────┘  └──────────────┘       │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                   Core Components                           │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐       │
│  │  Browser    │  │   AI        │  │  Interaction │       │
│  │  Agent      │  │  Detector   │  │  Executor    │       │
│  └─────────────┘  └─────────────┘  └──────────────┘       │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                   Infrastructure Layer                      │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐       │
│  │  PostgreSQL │  │   Redis     │  │  File System │       │
│  │  Database   │  │   Queue     │  │  Storage     │       │
│  └─────────────┘  └─────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Browser Agent
The foundation of the system, providing low-level browser automation capabilities using Playwright.

**Responsibilities:**
- Browser lifecycle management
- Page navigation
- Screenshot capture
- Network monitoring
- Cookie and storage management

### 2. Breadth-First Crawler
Implements systematic website exploration using a queue-based BFS algorithm.

**Features:**
- URL normalization and deduplication
- Robots.txt compliance
- Domain boundary enforcement
- Distributed crawling support
- Error recovery and retry logic

### 3. AI Element Detector
Uses Stagehand AI to intelligently identify and classify interactive elements.

**Capabilities:**
- AI-powered element discovery
- Traditional selector-based detection
- Element classification and validation
- Metadata extraction
- Custom component recognition

### 4. Interaction Executor
Executes interactions on detected elements using type-specific strategies.

**Strategy Pattern Implementation:**
- Text input strategies
- Form element strategies
- Navigation strategies
- Complex component strategies
- Custom interaction handlers

### 5. Test Generator
Converts recorded interactions into maintainable Playwright tests.

**Features:**
- TypeScript code generation
- Page Object Model creation
- Assertion generation
- Test data management
- File organization

## Data Flow

```
User Configuration
    ↓
URL Discovery (BFS Queue)
    ↓
Page Loading (Browser Agent)
    ↓
Element Detection (AI + Selectors)
    ↓
Element Classification
    ↓
Interaction Execution
    ↓
Path Recording
    ↓
Test Generation
    ↓
File Output
```

## Key Design Patterns

### 1. Strategy Pattern
Used extensively in the interaction layer to handle different element types with specific strategies.

```typescript
interface InteractionStrategy {
  execute(element: Element, context: Context): Promise<Result>;
}

class TextInputStrategy implements InteractionStrategy { }
class ButtonStrategy implements InteractionStrategy { }
```

### 2. Factory Pattern
Used for creating appropriate strategies and test data generators.

```typescript
class StrategyFactory {
  createStrategy(elementType: ElementType): InteractionStrategy
}
```

### 3. Observer Pattern
Used for monitoring browser events and network activity.

```typescript
class NetworkMonitor {
  on('request', handler)
  on('response', handler)
}
```

### 4. Command Pattern
Used for queuing and executing crawl operations.

```typescript
interface CrawlCommand {
  execute(): Promise<void>
  undo(): Promise<void>
}
```

## Scalability Considerations

### Horizontal Scaling
- Redis-based distributed queue for crawl coordination
- Stateless worker nodes
- Load balancing across multiple browser instances

### Vertical Scaling
- Browser pool management
- Memory optimization
- Resource recycling

### Performance Optimizations
- Parallel page processing
- Intelligent caching
- Network request batching
- Lazy loading of resources

## Security Architecture

### Authentication
- Multi-strategy authentication support
- Session persistence and management
- Secure credential storage

### Data Protection
- Encryption at rest and in transit
- PII detection and masking
- Audit logging

### Anti-Bot Measures
- User agent rotation
- Request throttling
- Human-like interaction delays
- Fingerprint randomization

## Extensibility Points

### 1. Custom Element Detectors
```typescript
interface ElementDetector {
  detect(page: Page): Promise<Element[]>
}
```

### 2. Custom Interaction Strategies
```typescript
class CustomStrategy implements InteractionStrategy {
  // Implementation
}
```

### 3. Test Framework Adapters
```typescript
interface TestGenerator {
  generate(path: UserPath): Promise<TestFile>
}
```

### 4. Storage Backends
```typescript
interface StorageAdapter {
  save(data: any): Promise<void>
  load(id: string): Promise<any>
}
```

## Next Steps

- [Component Architecture](./components.md) - Detailed component documentation
- [Data Flow](./data-flow.md) - Understanding data movement
- [API Reference](../api/browser-agent.md) - API documentation