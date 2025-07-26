import { chromium } from 'playwright';
import { SelfAdaptingDetector } from '../src/detectors/SelfAdaptingDetector';
import { AdaptiveInteractionExecutor } from '../src/interactions/AdaptiveInteractionExecutor';
import { logger } from '../src/utils/logger';

/**
 * Example demonstrating self-adapting element detection for UI changes
 */
async function demonstrateSelfAdaptingDetection() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Initialize self-adapting detector
  const detector = new SelfAdaptingDetector();
  await detector.initialize(page);

  // Initialize adaptive interaction executor
  const executor = new AdaptiveInteractionExecutor();
  await executor.initialize(page);

  try {
    // Example 1: Detect elements on a dynamic page
    logger.info('=== Example 1: Initial Element Detection ===');
    
    await page.goto('https://example.com');
    const detectionResult = await detector.detectInteractiveElements(page);
    
    logger.info(`Detected ${detectionResult.totalFound} elements`);
    detectionResult.elements.forEach(element => {
      logger.info(`Found: ${element.type} - ${element.selector} - ${element.text || 'No text'}`);
    });

    // Example 2: Simulate UI change and adapt
    logger.info('\n=== Example 2: Adapting to UI Changes ===');
    
    // Store a button element
    const submitButton = detectionResult.elements.find(el => 
      el.type === 'button' && el.text?.toLowerCase().includes('submit')
    );

    if (submitButton) {
      // Simulate UI change by modifying the page
      await page.evaluate(() => {
        // Change button ID and classes to simulate UI update
        const button = document.querySelector('button');
        if (button) {
          button.id = 'new-submit-btn';
          button.className = 'updated-btn-class';
        }
      });

      // Try to interact with the original element (will fail)
      logger.info('Attempting to interact with original element...');
      const result = await executor.executeInteraction(submitButton);
      
      if (result.success) {
        logger.info('Interaction successful after adaptation!');
        logger.info(`Adapted selector: ${result.adaptedSelector || 'N/A'}`);
      } else {
        logger.error('Interaction failed:', result.error);
      }
    }

    // Example 3: Self-healing test scenario
    logger.info('\n=== Example 3: Self-Healing Test ===');
    
    // Create a test with multiple interactions
    const formElements = detectionResult.elements.filter(el => 
      ['text-input', 'email-input', 'button'].includes(el.type)
    );

    if (formElements.length >= 2) {
      const testResult = await executor.createSelfHealingTest(
        'Login Form Test',
        formElements,
        [
          { elementIndex: 0, action: 'type', data: 'user@example.com' },
          { elementIndex: 1, action: 'type', data: 'password123' },
          { elementIndex: 2, action: 'click' },
        ]
      );

      logger.info('Self-healing test results:', {
        testName: testResult.name,
        healingOccurred: testResult.healingOccurred,
        successfulActions: testResult.executionResults.filter(r => r.success).length,
        totalActions: testResult.executionResults.length,
      });

      if (testResult.healingOccurred) {
        logger.info('Elements were automatically healed during test execution!');
      }
    }

    // Example 4: Get adaptation statistics
    logger.info('\n=== Example 4: Adaptation Statistics ===');
    
    const stats = detector.getAdaptationStats();
    logger.info('Adaptation statistics:', {
      totalAttempts: stats.totalAttempts,
      successRate: stats.totalAttempts > 0 
        ? `${(stats.successfulAdaptations / stats.totalAttempts * 100).toFixed(2)}%`
        : 'N/A',
      strategies: stats.strategiesUsed,
    });

    // Example 5: Batch element validation
    logger.info('\n=== Example 5: Batch Element Validation ===');
    
    const validationPromises = detectionResult.elements.slice(0, 5).map(async element => {
      const adaptedElement = await detector.getAdaptiveElement(page, element);
      return {
        original: element.selector,
        adapted: adaptedElement?.selector || 'Failed to adapt',
        needsAdaptation: element.selector !== adaptedElement?.selector,
      };
    });

    const validationResults = await Promise.all(validationPromises);
    logger.info('Validation results:', validationResults);

  } catch (error) {
    logger.error('Example failed:', error);
  } finally {
    // Clean up
    await detector.cleanup();
    await executor.cleanup();
    await browser.close();
  }
}

// Advanced example: Monitoring UI changes over time
async function monitorUIChanges() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const detector = new SelfAdaptingDetector();
  await detector.initialize(page);

  try {
    await page.goto('https://example.com');

    // Take snapshots over time
    const snapshots = [];
    const interval = 5000; // 5 seconds
    const duration = 30000; // 30 seconds total

    logger.info('Starting UI monitoring...');

    for (let elapsed = 0; elapsed < duration; elapsed += interval) {
      const result = await detector.detectInteractiveElements(page);
      
      snapshots.push({
        timestamp: new Date().toISOString(),
        elementCount: result.totalFound,
        adaptationStats: detector.getAdaptationStats(),
      });

      logger.info(`Snapshot at ${elapsed}ms:`, {
        elements: result.totalFound,
        adaptations: detector.getAdaptationStats().totalAttempts,
      });

      if (elapsed < duration - interval) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }

    // Analyze changes
    logger.info('\n=== UI Change Analysis ===');
    
    const firstSnapshot = snapshots[0];
    const lastSnapshot = snapshots[snapshots.length - 1];
    
    logger.info('UI stability report:', {
      totalSnapshots: snapshots.length,
      initialElements: firstSnapshot.elementCount,
      finalElements: lastSnapshot.elementCount,
      totalAdaptations: lastSnapshot.adaptationStats.totalAttempts,
      adaptationSuccess: lastSnapshot.adaptationStats.successfulAdaptations,
    });

  } finally {
    await detector.cleanup();
    await browser.close();
  }
}

// Run examples
if (require.main === module) {
  (async () => {
    logger.info('Starting self-adapting detection examples...\n');
    
    // Run basic example
    await demonstrateSelfAdaptingDetection();
    
    // Uncomment to run monitoring example
    // await monitorUIChanges();
    
    logger.info('\nExamples completed!');
  })();
}