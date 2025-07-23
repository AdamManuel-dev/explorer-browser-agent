# AI Element Detection

The AI Element Detector combines artificial intelligence with traditional DOM analysis to identify and classify interactive elements on web pages. It uses Stagehand AI for intelligent detection and enhances results with pattern-based detection.

## Overview

The detector identifies all interactive elements on a page, classifies them by type, and extracts relevant metadata for testing. It can detect both standard HTML elements and complex custom components.

## Detection Approach

### Dual Detection Strategy

```
1. AI-Powered Detection (Stagehand)
   └── Natural language understanding
   └── Visual element recognition
   └── Context-aware classification

2. Pattern-Based Detection
   └── CSS selector matching
   └── Attribute analysis
   └── DOM structure recognition

3. Result Merging
   └── Deduplication
   └── Confidence scoring
   └── Final classification
```

## Supported Element Types

### Form Elements
- **Text Inputs**: text, password, email, number, tel
- **Textareas**: Multi-line text inputs
- **Checkboxes**: Single and grouped
- **Radio Buttons**: Option groups
- **Select Dropdowns**: Single and multi-select
- **Date/Time Pickers**: Various formats
- **File Uploads**: Single and multiple
- **Range Sliders**: Numeric inputs
- **Color Pickers**: Color selection

### Interactive Elements
- **Buttons**: Submit, button, reset types
- **Links**: Navigation elements
- **Toggle Switches**: On/off controls
- **Tabs**: Navigation components
- **Accordions**: Collapsible sections
- **Modals**: Dialog triggers
- **Dropdowns**: Menu systems
- **Carousels**: Image/content sliders

### Advanced Components
- **Canvas Elements**: Drawing areas
- **Video/Audio Players**: Media controls
- **Rich Text Editors**: WYSIWYG editors
- **Drag-and-Drop**: Sortable lists
- **Virtual Scrolling**: Infinite lists
- **Custom Components**: Role-based detection

## Usage

### Basic Detection
```typescript
import { AIElementDetector } from 'browser-explorer';

const detector = new AIElementDetector();
await detector.initialize(page);

const result = await detector.detectInteractiveElements(page);
console.log(`Found ${result.totalFound} interactive elements`);
```

### Detection Results
```typescript
interface ElementDetectionResult {
  elements: InteractiveElement[];
  totalFound: number;
  detectionTime: number;
  errors: Array<{
    selector: string;
    error: string;
  }>;
}

interface InteractiveElement {
  id: string;
  type: ElementType;
  selector: string;
  xpath?: string;
  text?: string;
  attributes: Record<string, string>;
  isVisible: boolean;
  isEnabled: boolean;
  boundingBox?: BoundingBox;
  metadata?: ElementMetadata;
}
```

## AI Detection Features

### Natural Language Understanding
```typescript
// Stagehand can understand complex instructions
const observations = await stagehand.observe({
  instruction: 'Find all form fields for user registration including name, email, password, and optional profile fields'
});
```

### Visual Recognition
- Identifies elements by visual appearance
- Recognizes common UI patterns
- Handles custom-styled components

### Context Awareness
- Understands element relationships
- Identifies form groups
- Recognizes navigation structures

## Pattern-Based Detection

### Selector Patterns
```typescript
// Example patterns for different element types
const patterns = {
  'text-input': [
    'input[type="text"]',
    'input:not([type])',
    '[contenteditable="true"]'
  ],
  'button': [
    'button',
    'input[type="submit"]',
    'a.button',
    '[role="button"]'
  ]
};
```

### Attribute Analysis
```typescript
// Intelligent type inference from attributes
if (element.type === 'password') return 'password-input';
if (element.name.includes('email')) return 'email-input';
if (element.placeholder.includes('phone')) return 'tel-input';
```

## Metadata Extraction

### Extracted Information
```typescript
interface ElementMetadata {
  label?: string;          // Associated label text
  placeholder?: string;    // Placeholder text
  required?: boolean;      // Required field indicator
  validationRules?: string[]; // Validation constraints
  options?: Array<{        // For select elements
    value: string;
    text: string;
  }>;
}
```

### Label Detection
```typescript
// Multiple strategies for finding labels
1. <label for="elementId">
2. <label>wrapping element</label>
3. aria-label attribute
4. aria-labelledby reference
5. Proximity-based detection
```

## Classification Process

### AI-Assisted Classification
```typescript
const classification = await detector.classifyWithAI(element);
// Returns:
{
  element: InteractiveElement,
  confidence: 0.95,
  suggestedType: 'email-input',
  reasoning: 'Element has email validation and @ symbol in placeholder'
}
```

### Confidence Thresholds
- **High (> 0.8)**: Use AI classification
- **Medium (0.5-0.8)**: Combine with patterns
- **Low (< 0.5)**: Fallback to patterns

## Advanced Features

### Custom Element Detection
```typescript
class CustomDetector extends AIElementDetector {
  protected additionalPatterns(): Map<ElementType, string[]> {
    const patterns = super.additionalPatterns();
    patterns.set('custom-date', ['my-date-picker']);
    return patterns;
  }
}
```

### Filtering Results
```typescript
const result = await detector.detectInteractiveElements(page);

// Filter visible elements only
const visibleElements = result.elements.filter(el => el.isVisible);

// Filter by type
const buttons = result.elements.filter(el => el.type === 'button');

// Filter by selector pattern
const customElements = result.elements.filter(el => 
  el.selector.includes('data-testid')
);
```

### Performance Optimization
```typescript
const detector = new AIElementDetector({
  maxConcurrent: 10,      // Parallel detection
  timeout: 30000,         // Detection timeout
  cacheResults: true,     // Cache for re-detection
  skipInvisible: true     // Ignore hidden elements
});
```

## Integration Examples

### With Crawler
```typescript
const crawler = new BreadthFirstCrawler(config);
const detector = new AIElementDetector();

crawler.onPageLoad = async (page) => {
  await detector.initialize(page);
  const elements = await detector.detectInteractiveElements(page);
  // Process detected elements
};
```

### With Interaction Executor
```typescript
const elements = await detector.detectInteractiveElements(page);
const executor = new InteractionExecutor();

for (const element of elements.elements) {
  const result = await executor.executeInteraction(element);
  console.log(`Tested ${element.type}: ${result.success}`);
}
```

## Best Practices

### 1. Initialize Once
```typescript
// Initialize detector once per page
await detector.initialize(page);
// Can run multiple detections
const result1 = await detector.detectInteractiveElements(page);
const result2 = await detector.detectInteractiveElements(page); // Reuses initialization
```

### 2. Handle Dynamic Content
```typescript
// Wait for dynamic content to load
await page.waitForLoadState('networkidle');
const elements = await detector.detectInteractiveElements(page);

// Or detect after specific actions
await page.click('#load-more');
await page.waitForTimeout(1000);
const newElements = await detector.detectInteractiveElements(page);
```

### 3. Error Handling
```typescript
const result = await detector.detectInteractiveElements(page);

if (result.errors.length > 0) {
  console.warn('Detection errors:', result.errors);
  // Continue with successfully detected elements
}
```

## Troubleshooting

### Common Issues

1. **Missing Elements**
   - Check if elements are dynamically loaded
   - Verify elements are visible
   - Ensure proper wait conditions

2. **Incorrect Classification**
   - Review element attributes
   - Check confidence scores
   - Add custom patterns if needed

3. **Performance Issues**
   - Reduce concurrent detection
   - Skip invisible elements
   - Use selector filtering

### Debug Mode
```typescript
const detector = new AIElementDetector({
  debug: true  // Enables detailed logging
});

// Logs will include:
// - Detection strategies used
// - Elements found by each method
// - Classification decisions
// - Performance metrics
```

## Examples

### Form Detection
```typescript
// Detect all form elements on a registration page
const result = await detector.detectInteractiveElements(page);
const formElements = result.elements.filter(el => 
  ['text-input', 'email-input', 'password-input', 'checkbox', 'button']
    .includes(el.type)
);
```

### Navigation Detection
```typescript
// Detect navigation elements
const navElements = result.elements.filter(el =>
  el.type === 'link' && 
  (el.selector.includes('nav') || el.attributes.role === 'navigation')
);
```

### Custom Component Detection
```typescript
// Detect React/Vue/Angular components
const customComponents = result.elements.filter(el =>
  el.attributes['data-component'] || 
  el.selector.includes('[class*="component"]')
);
```

## Next Steps

- [Interaction Executor](./interaction-executor.md) - How to interact with detected elements
- [Test Generation](./test-generation.md) - Converting detections to tests
- [API Reference](../api/element-detector.md) - Detailed API documentation