# Interaction Executor

The Interaction Executor is responsible for performing actions on detected elements using type-specific strategies. It provides a unified interface for interacting with various element types while handling test data generation, network monitoring, and state tracking.

## Overview

The executor uses the Strategy Pattern to handle different element types with specialized interaction logic. Each element type has its own strategy that knows how to properly interact with that specific type of element.

## Architecture

```
InteractionExecutor
├── Strategy Map (ElementType → Strategy)
├── Test Data Generator
├── Network Monitor
├── State Tracker
└── Screenshot Manager
```

## Interaction Strategies

### Available Strategies

| Element Type | Strategy | Description |
|-------------|----------|-------------|
| text-input | TextInputStrategy | Handles text input fields |
| password-input | TextInputStrategy | Secure text input |
| email-input | TextInputStrategy | Email validation aware |
| checkbox | CheckboxStrategy | Toggle state handling |
| radio | RadioStrategy | Group selection logic |
| select | SelectStrategy | Dropdown selection |
| button | ButtonStrategy | Click with navigation handling |
| link | LinkStrategy | Navigation aware clicking |
| file-upload | FileUploadStrategy | File selection simulation |
| date-picker | DatePickerStrategy | Date selection logic |
| ... | ... | ... |

### Strategy Interface
```typescript
interface InteractionStrategy {
  type: string;
  execute(
    element: InteractiveElement,
    context: InteractionContext
  ): Promise<InteractionResult>;
  validate?(element: InteractiveElement): Promise<boolean>;
}
```

## Usage

### Basic Interaction
```typescript
import { InteractionExecutor } from 'browser-explorer';

const executor = new InteractionExecutor();
executor.setPage(page);

const element: InteractiveElement = {
  type: 'text-input',
  selector: '#username',
  // ... other properties
};

const result = await executor.executeInteraction(element);
console.log(`Interaction ${result.success ? 'succeeded' : 'failed'}`);
```

### With Options
```typescript
const result = await executor.executeInteraction(element, {
  delay: 1000,           // Wait before interaction
  screenshot: true,      // Capture screenshot
  waitForNavigation: true, // Wait for page navigation
  timeout: 30000,        // Custom timeout
  force: true           // Force interaction
});
```

## Test Data Generation

### Automatic Generation
```typescript
// The executor automatically generates appropriate test data
const emailElement = { type: 'email-input', ... };
// Generates: "john.doe@example.com"

const phoneElement = { type: 'tel-input', ... };
// Generates: "+1-555-123-4567"

const dateElement = { type: 'date-picker', ... };
// Generates: "2024-06-15"
```

### Smart Detection
The test data generator analyzes element attributes to determine appropriate data:

```typescript
// Detects from name/id/placeholder/label
<input name="firstName" />        // Generates: "John"
<input placeholder="Enter email" /> // Generates: "user@example.com"
<input id="phone-number" />        // Generates: "555-0123"
```

### Custom Test Data
```typescript
class CustomExecutor extends InteractionExecutor {
  protected async generateTestData(element: InteractiveElement) {
    if (element.selector.includes('custom-field')) {
      return { value: 'custom-value', type: 'custom' };
    }
    return super.generateTestData(element);
  }
}
```

## Interaction Results

### Result Structure
```typescript
interface InteractionResult {
  success: boolean;
  value?: any;              // Value entered/selected
  timing: number;           // Execution time (ms)
  screenshot?: string;      // Screenshot filename
  error?: string;          // Error message if failed
  networkActivity?: NetworkActivity[];
  stateChanges?: StateChange[];
}
```

### Network Monitoring
```typescript
// Automatically captures network activity during interactions
const result = await executor.executeInteraction(submitButton);

result.networkActivity.forEach(activity => {
  console.log(`${activity.method} ${activity.url} - ${activity.status}`);
});
// POST /api/submit - 200
// GET /api/user - 200
```

### State Tracking
```typescript
// Tracks state changes caused by interactions
const result = await executor.executeInteraction(loginButton);

result.stateChanges.forEach(change => {
  console.log(`${change.type}: ${change.before} → ${change.after}`);
});
// url: /login → /dashboard
// storage: {token: null} → {token: "abc123"}
```

## Element-Specific Strategies

### Text Input Strategy
```typescript
// Handles all text-based inputs
- Clears existing value
- Types with realistic delays
- Triggers validation events
- Handles special characters
```

### Select Strategy
```typescript
// Intelligent dropdown handling
- Detects available options
- Skips placeholder options
- Handles dynamic loading
- Supports multi-select
```

### File Upload Strategy
```typescript
// Simulates file selection
- Creates test files if needed
- Handles multiple files
- Validates file types
- Manages file paths
```

### Button Strategy
```typescript
// Smart click handling
- Waits for navigation if needed
- Handles loading states
- Manages popups/modals
- Tracks side effects
```

## Advanced Features

### Parallel Execution
```typescript
const elements = await detector.detectInteractiveElements(page);
const executor = new InteractionExecutor();

// Execute interactions in parallel where safe
const results = await Promise.all(
  elements
    .filter(el => el.type === 'checkbox')
    .map(el => executor.executeInteraction(el))
);
```

### Conditional Interactions
```typescript
const executor = new InteractionExecutor();

// Only interact if element meets conditions
if (await executor.canInteract(element)) {
  const result = await executor.executeInteraction(element);
}
```

### Custom Strategies
```typescript
class CustomStrategy implements InteractionStrategy {
  type = 'custom-element';
  
  async execute(element, context) {
    const { page } = context;
    // Custom interaction logic
    await page.evaluate((sel) => {
      document.querySelector(sel).customMethod();
    }, element.selector);
    
    return { success: true, value: 'custom-interaction' };
  }
}

// Register custom strategy
executor.registerStrategy('custom-element', new CustomStrategy());
```

## Error Handling

### Retry Logic
```typescript
const executor = new InteractionExecutor({
  maxRetries: 3,
  retryDelay: 1000
});

// Automatically retries failed interactions
const result = await executor.executeInteraction(element);
```

### Error Types
```typescript
try {
  await executor.executeInteraction(element);
} catch (error) {
  if (error instanceof ElementNotFoundError) {
    // Element no longer exists
  } else if (error instanceof TimeoutError) {
    // Interaction timed out
  } else if (error instanceof ValidationError) {
    // Element validation failed
  }
}
```

## Best Practices

### 1. Set Page Context
```typescript
// Always set the page before interactions
const executor = new InteractionExecutor();
executor.setPage(page);
```

### 2. Wait for Elements
```typescript
// Ensure elements are ready
await page.waitForSelector(element.selector);
const result = await executor.executeInteraction(element);
```

### 3. Handle Navigation
```typescript
// For actions that cause navigation
const result = await executor.executeInteraction(submitButton, {
  waitForNavigation: true
});
```

### 4. Capture Evidence
```typescript
// Enable screenshots for debugging
const result = await executor.executeInteraction(element, {
  screenshot: true
});
console.log(`Screenshot saved: ${result.screenshot}`);
```

## Integration Examples

### With Element Detector
```typescript
const detector = new AIElementDetector();
const executor = new InteractionExecutor();

const elements = await detector.detectInteractiveElements(page);
executor.setPage(page);

for (const element of elements.elements) {
  try {
    const result = await executor.executeInteraction(element);
    console.log(`✓ ${element.type} - ${element.selector}`);
  } catch (error) {
    console.log(`✗ ${element.type} - ${error.message}`);
  }
}
```

### With Path Recorder
```typescript
const executor = new InteractionExecutor();
const recorder = new UserPathRecorder();

recorder.startRecording();

const result = await executor.executeInteraction(element);
recorder.recordInteraction(element, result);

const path = recorder.stopRecording();
```

## Performance Considerations

### Resource Management
```typescript
// Cleanup after batch interactions
const executor = new InteractionExecutor();

try {
  // Perform interactions
} finally {
  await executor.cleanup();
}
```

### Optimization Tips
1. Reuse executor instances
2. Batch similar interactions
3. Disable screenshots in production
4. Use appropriate timeouts
5. Implement caching for test data

## Troubleshooting

### Common Issues

1. **Element Not Interactable**
   ```typescript
   // Ensure element is visible and enabled
   await element.scrollIntoViewIfNeeded();
   await page.waitForSelector(selector, { state: 'visible' });
   ```

2. **Timing Issues**
   ```typescript
   // Add delays for dynamic content
   const result = await executor.executeInteraction(element, {
     delay: 2000
   });
   ```

3. **Navigation Failures**
   ```typescript
   // Handle navigation timeouts
   const result = await executor.executeInteraction(link, {
     waitForNavigation: true,
     timeout: 60000
   });
   ```

## Next Steps

- [User Path Recording](./path-recording.md) - Recording interaction sequences
- [Test Generation](./test-generation.md) - Converting interactions to tests
- [API Reference](../api/interaction-executor.md) - Detailed API documentation