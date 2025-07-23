import { UserPath, InteractionStep, Assertion } from '../types/recording';
import { logger } from '../utils/logger';

export class PathOptimizer {
  /**
   * Optimizes a recorded path by removing redundant steps and improving assertions
   */
  optimize(path: UserPath): UserPath {
    logger.info('Optimizing user path', { 
      originalSteps: path.steps.length,
      originalAssertions: path.assertions.length 
    });

    const optimizedPath = { ...path };
    
    // Optimize steps
    optimizedPath.steps = this.optimizeSteps(path.steps);
    
    // Optimize assertions
    optimizedPath.assertions = this.optimizeAssertions(path.assertions);
    
    // Remove duplicate assertions
    optimizedPath.assertions = this.deduplicateAssertions(optimizedPath.assertions);

    logger.info('Path optimization complete', {
      optimizedSteps: optimizedPath.steps.length,
      optimizedAssertions: optimizedPath.assertions.length,
      stepsRemoved: path.steps.length - optimizedPath.steps.length,
      assertionsRemoved: path.assertions.length - optimizedPath.assertions.length,
    });

    return optimizedPath;
  }

  private optimizeSteps(steps: InteractionStep[]): InteractionStep[] {
    const optimized: InteractionStep[] = [];
    
    for (let i = 0; i < steps.length; i++) {
      const current = steps[i];
      const next = steps[i + 1];
      
      // Skip redundant waits
      if (current.type === 'wait' && next?.type === 'wait') {
        // Combine consecutive waits
        next.value = (current.value || 0) + (next.value || 0);
        next.action = `Wait for ${next.value}ms`;
        continue;
      }
      
      // Skip redundant screenshots
      if (current.type === 'screenshot' && next?.type === 'screenshot') {
        // Keep only the last screenshot
        continue;
      }
      
      // Remove unsuccessful interactions that were retried
      if (current.error && next && !next.error && 
          current.element?.selector === next.element?.selector) {
        // Skip the failed attempt
        next.retries = (current.retries || 0) + 1;
        continue;
      }
      
      // Merge rapid consecutive typing
      if (current.type === 'type' && next?.type === 'type' &&
          current.element?.selector === next.element?.selector &&
          next.timestamp - current.timestamp < 1000) {
        // Combine the values
        next.value = current.value + next.value;
        next.action = `Type "${next.value}"`;
        continue;
      }
      
      optimized.push(current);
    }
    
    return optimized;
  }

  private optimizeAssertions(assertions: Assertion[]): Assertion[] {
    const optimized: Assertion[] = [];
    const seen = new Set<string>();
    
    for (const assertion of assertions) {
      const key = this.getAssertionKey(assertion);
      
      // Skip duplicate assertions
      if (seen.has(key)) {
        continue;
      }
      
      // Skip redundant visibility assertions for elements we interacted with
      if (assertion.type === 'visible' && assertion.expected === true) {
        // This is often redundant as interaction implies visibility
        continue;
      }
      
      seen.add(key);
      optimized.push(assertion);
    }
    
    return optimized;
  }

  private deduplicateAssertions(assertions: Assertion[]): Assertion[] {
    const uniqueMap = new Map<string, Assertion>();
    
    for (const assertion of assertions) {
      const key = `${assertion.type}-${assertion.target}-${assertion.operator}`;
      
      // Keep the most specific assertion
      const existing = uniqueMap.get(key);
      if (!existing || this.isMoreSpecific(assertion, existing)) {
        uniqueMap.set(key, assertion);
      }
    }
    
    return Array.from(uniqueMap.values());
  }

  private getAssertionKey(assertion: Assertion): string {
    return `${assertion.type}-${assertion.target}-${assertion.expected}-${assertion.operator}`;
  }

  private isMoreSpecific(a: Assertion, b: Assertion): boolean {
    // Equals is more specific than contains
    if (a.operator === 'equals' && b.operator === 'contains') return true;
    if (a.operator === 'contains' && b.operator === 'equals') return false;
    
    // Longer expected values are usually more specific
    const aLength = String(a.expected).length;
    const bLength = String(b.expected).length;
    
    return aLength > bLength;
  }

  /**
   * Identifies critical steps that must not be removed
   */
  identifyCriticalSteps(path: UserPath): Set<string> {
    const critical = new Set<string>();
    
    for (const step of path.steps) {
      // Navigation steps are critical
      if (step.type === 'navigation') {
        critical.add(step.id);
      }
      
      // Form submissions are critical
      if (step.element?.type === 'button' && 
          (step.element.text?.toLowerCase().includes('submit') ||
           step.element.text?.toLowerCase().includes('save'))) {
        critical.add(step.id);
      }
      
      // Steps that cause state changes are critical
      if (step.stateChanges.length > 0) {
        critical.add(step.id);
      }
      
      // Login/authentication steps are critical
      if (step.element?.selector.includes('password') ||
          step.element?.selector.includes('login')) {
        critical.add(step.id);
      }
    }
    
    return critical;
  }

  /**
   * Groups related steps together for better test organization
   */
  groupSteps(path: UserPath): InteractionStep[][] {
    const groups: InteractionStep[][] = [];
    let currentGroup: InteractionStep[] = [];
    
    for (const step of path.steps) {
      // Start new group on navigation
      if (step.type === 'navigation' && currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }
      
      currentGroup.push(step);
      
      // End group on form submission
      if (step.element?.type === 'button' && 
          step.element.text?.toLowerCase().includes('submit')) {
        groups.push(currentGroup);
        currentGroup = [];
      }
    }
    
    // Add remaining steps
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  }
}