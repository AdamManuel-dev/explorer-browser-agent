import { logger } from '../utils/logger';
import { 
  TestStep as GenTestStep, 
  TestAssertion,
  GenerationOptions 
} from '../types/generation';
import { ElementType, InteractiveElement } from '../types/elements';

export interface NaturalLanguageTestSpec {
  description: string;
  actions: string[];
  assertions: string[];
  setup?: string;
  cleanup?: string;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface ProcessedTestSpec {
  name: string;
  description: string;
  steps: ProcessedTestStep[];
  assertions: ProcessedTestAssertion[];
  setup?: ProcessedTestStep[];
  cleanup?: ProcessedTestStep[];
  metadata: {
    complexity: 'simple' | 'medium' | 'complex';
    estimatedTime: number; // minutes
    tags: string[];
    priority: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface ProcessedTestStep {
  type: 'navigate' | 'click' | 'type' | 'select' | 'wait' | 'scroll' | 'hover' | 'drag' | 'custom';
  description: string;
  target: {
    selector?: string;
    text?: string;
    type?: ElementType;
    position?: { x: number; y: number };
  };
  data?: any;
  options?: {
    timeout?: number;
    waitFor?: string;
    retry?: boolean;
  };
  naturalLanguage: string;
}

export interface ProcessedTestAssertion {
  type: 'visible' | 'hidden' | 'enabled' | 'disabled' | 'contains' | 'equals' | 'count' | 'url' | 'custom';
  description: string;
  target?: {
    selector?: string;
    text?: string;
    type?: ElementType;
  };
  expected: any;
  message?: string;
  naturalLanguage: string;
}

export class NaturalLanguageTestProcessor {
  private actionPatterns: Map<RegExp, string>;
  private assertionPatterns: Map<RegExp, string>;
  private elementPatterns: Map<RegExp, ElementType>;

  constructor() {
    this.initializePatterns();
  }

  /**
   * Process natural language test specification into executable test spec
   */
  async processTestSpec(nlSpec: NaturalLanguageTestSpec): Promise<ProcessedTestSpec> {
    logger.info('Processing natural language test specification', {
      description: nlSpec.description,
      actionsCount: nlSpec.actions.length,
      assertionsCount: nlSpec.assertions.length,
    });

    const steps = await this.processActions(nlSpec.actions);
    const assertions = await this.processAssertions(nlSpec.assertions);
    const setup = nlSpec.setup ? await this.processActions([nlSpec.setup]) : undefined;
    const cleanup = nlSpec.cleanup ? await this.processActions([nlSpec.cleanup]) : undefined;

    const complexity = this.determineComplexity(steps, assertions);
    const estimatedTime = this.estimateTestTime(steps, assertions);

    return {
      name: this.generateTestName(nlSpec.description),
      description: nlSpec.description,
      steps,
      assertions,
      setup,
      cleanup,
      metadata: {
        complexity,
        estimatedTime,
        tags: nlSpec.tags || [],
        priority: nlSpec.priority || 'medium',
      },
    };
  }

  /**
   * Process multiple natural language test specifications
   */
  async processMultipleSpecs(nlSpecs: NaturalLanguageTestSpec[]): Promise<ProcessedTestSpec[]> {
    const results: ProcessedTestSpec[] = [];

    for (const spec of nlSpecs) {
      try {
        if (!spec || !spec.description) {
          logger.warn('Skipping invalid test specification');
          continue;
        }
        const processed = await this.processTestSpec(spec);
        results.push(processed);
      } catch (error) {
        logger.error('Failed to process test specification', {
          description: spec?.description || 'unknown',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Process natural language actions into test steps
   */
  private async processActions(actions: string[]): Promise<ProcessedTestStep[]> {
    const steps: ProcessedTestStep[] = [];

    for (const action of actions) {
      const step = this.parseAction(action);
      if (step) {
        steps.push(step);
      } else {
        logger.warn('Could not parse action', { action });
        // Create a custom step for unparseable actions
        steps.push({
          type: 'custom',
          description: `Custom action: ${action}`,
          target: {},
          naturalLanguage: action,
        });
      }
    }

    return steps;
  }

  /**
   * Process natural language assertions into test assertions
   */
  private async processAssertions(assertions: string[]): Promise<ProcessedTestAssertion[]> {
    const processedAssertions: ProcessedTestAssertion[] = [];

    for (const assertion of assertions) {
      const processed = this.parseAssertion(assertion);
      if (processed) {
        processedAssertions.push(processed);
      } else {
        logger.warn('Could not parse assertion', { assertion });
        // Create a custom assertion for unparseable assertions
        processedAssertions.push({
          type: 'custom',
          description: `Custom assertion: ${assertion}`,
          expected: true,
          naturalLanguage: assertion,
        });
      }
    }

    return processedAssertions;
  }

  /**
   * Initialize pattern matching for actions and assertions
   */
  private initializePatterns(): void {
    // Action patterns
    this.actionPatterns = new Map([
      [/^navigate to (.+)$/i, 'navigate'],
      [/^go to (.+)$/i, 'navigate'],
      [/^open (.+)$/i, 'navigate'],
      [/^click (?:on )?(.+)$/i, 'click'],
      [/^press (.+)$/i, 'click'],
      [/^tap (.+)$/i, 'click'],
      [/^type \"([^\"]+)\" (?:in|into) (.+)$/i, 'type'],
      [/^enter \"([^\"]+)\" (?:in|into) (.+)$/i, 'type'],
      [/^fill (.+) with \"([^\"]+)\"$/i, 'type'],
      [/^fill (.+) with (.+)$/i, 'type'],
      [/^select \"([^\"]+)\" from (.+)$/i, 'select'],
      [/^choose \"([^\"]+)\" from (.+)$/i, 'select'],
      [/^wait for (.+) to (?:appear|be visible)$/i, 'wait'],
      [/^wait for (.+)$/i, 'wait'],
      [/^scroll to (.+)$/i, 'scroll'],
      [/^hover (?:over )?(.+)$/i, 'hover'],
      [/^drag (.+) to (.+)$/i, 'drag'],
    ]);

    // Assertion patterns
    this.assertionPatterns = new Map([
      [/^(.+) should be visible$/i, 'visible'],
      [/^(.+) should appear$/i, 'visible'],
      [/^(.+) should be hidden$/i, 'hidden'],
      [/^(.+) should not be visible$/i, 'hidden'],
      [/^(.+) should be enabled$/i, 'enabled'],
      [/^(.+) should be disabled$/i, 'disabled'],
      [/^(.+) should contain \"([^\"]+)\"$/i, 'contains'],
      [/^(.+) should have text \"([^\"]+)\"$/i, 'equals'],
      [/^(.+) should equal \"([^\"]+)\"$/i, 'equals'],
      [/^page should contain \"([^\"]+)\"$/i, 'contains'],
      [/^url should be \"([^\"]+)\"$/i, 'url'],
      [/^url should contain \"([^\"]+)\"$/i, 'url'],
      [/^there should be (\d+) (.+)$/i, 'count'],
      [/^(.+) should contain (\d+) (.+)$/i, 'count'],
    ]);

    // Element type patterns (order matters - more specific first)
    this.elementPatterns = new Map([
      [/password/i, 'password-input'],
      [/email/i, 'email-input'],
      [/number/i, 'number-input'],
      [/phone|tel/i, 'tel-input'],
      [/file.*upload|upload.*file/i, 'file-upload'],
      [/textarea/i, 'textarea'],
      [/checkbox|check/i, 'checkbox'],
      [/radio/i, 'radio'],
      [/select|dropdown|menu/i, 'select'],
      [/toggle|switch/i, 'toggle'],
      [/button|btn/i, 'button'],
      [/link|anchor/i, 'link'],
      [/input|field|textbox/i, 'text-input'],
    ]);
  }

  /**
   * Parse a natural language action into a test step
   */
  private parseAction(action: string): ProcessedTestStep | null {
    for (const [pattern, type] of this.actionPatterns) {
      const match = action.match(pattern);
      if (match) {
        return this.buildActionStep(type, match, action);
      }
    }
    return null;
  }

  /**
   * Parse a natural language assertion into a test assertion
   */
  private parseAssertion(assertion: string): ProcessedTestAssertion | null {
    for (const [pattern, type] of this.assertionPatterns) {
      const match = assertion.match(pattern);
      if (match) {
        return this.buildAssertion(type, match, assertion);
      }
    }
    return null;
  }

  /**
   * Build a test step from pattern match
   */
  private buildActionStep(type: string, match: RegExpMatchArray, originalText: string): ProcessedTestStep {
    switch (type) {
      case 'navigate':
        return {
          type: 'navigate',
          description: `Navigate to ${match[1]}`,
          target: { text: match[1] },
          naturalLanguage: originalText,
        };

      case 'click':
        return {
          type: 'click',
          description: `Click ${match[1]}`,
          target: this.parseElementReference(match[1]),
          naturalLanguage: originalText,
        };

      case 'type':
        // Handle both "type X into Y" and "fill Y with X" patterns
        if (originalText.toLowerCase().includes('fill')) {
          return {
            type: 'type',
            description: `Fill ${match[1]} with "${match[2]}"`,
            target: this.parseElementReference(match[1]),
            data: match[2],
            naturalLanguage: originalText,
          };
        } else {
          return {
            type: 'type',
            description: `Type "${match[1]}" into ${match[2]}`,
            target: this.parseElementReference(match[2]),
            data: match[1],
            naturalLanguage: originalText,
          };
        }

      case 'select':
        return {
          type: 'select',
          description: `Select "${match[1]}" from ${match[2]}`,
          target: this.parseElementReference(match[2]),
          data: match[1],
          naturalLanguage: originalText,
        };

      case 'wait':
        return {
          type: 'wait',
          description: `Wait for ${match[1]}`,
          target: this.parseElementReference(match[1]),
          options: { timeout: 10000 },
          naturalLanguage: originalText,
        };

      case 'scroll':
        return {
          type: 'scroll',
          description: `Scroll to ${match[1]}`,
          target: this.parseElementReference(match[1]),
          naturalLanguage: originalText,
        };

      case 'hover':
        return {
          type: 'hover',
          description: `Hover over ${match[1]}`,
          target: this.parseElementReference(match[1]),
          naturalLanguage: originalText,
        };

      case 'drag':
        return {
          type: 'drag',
          description: `Drag ${match[1]} to ${match[2]}`,
          target: this.parseElementReference(match[1]),
          data: { destination: this.parseElementReference(match[2]) },
          naturalLanguage: originalText,
        };

      default:
        return {
          type: 'custom',
          description: originalText,
          target: {},
          naturalLanguage: originalText,
        };
    }
  }

  /**
   * Build a test assertion from pattern match
   */
  private buildAssertion(type: string, match: RegExpMatchArray, originalText: string): ProcessedTestAssertion {
    switch (type) {
      case 'visible':
        return {
          type: 'visible',
          description: `Assert ${match[1]} is visible`,
          target: this.parseElementReference(match[1]),
          expected: true,
          naturalLanguage: originalText,
        };

      case 'hidden':
        return {
          type: 'hidden',
          description: `Assert ${match[1]} is hidden`,
          target: this.parseElementReference(match[1]),
          expected: false,
          naturalLanguage: originalText,
        };

      case 'enabled':
        return {
          type: 'enabled',
          description: `Assert ${match[1]} is enabled`,
          target: this.parseElementReference(match[1]),
          expected: true,
          naturalLanguage: originalText,
        };

      case 'disabled':
        return {
          type: 'disabled',
          description: `Assert ${match[1]} is disabled`,
          target: this.parseElementReference(match[1]),
          expected: false,
          naturalLanguage: originalText,
        };

      case 'contains':
        return {
          type: 'contains',
          description: `Assert ${match[1]} contains "${match[2] || match[1]}"`,
          target: match[2] ? this.parseElementReference(match[1]) : {},
          expected: match[2] || match[1],
          naturalLanguage: originalText,
        };

      case 'equals':
        return {
          type: 'equals',
          description: `Assert ${match[1]} equals "${match[2]}"`,
          target: this.parseElementReference(match[1]),
          expected: match[2],
          naturalLanguage: originalText,
        };

      case 'url':
        return {
          type: 'url',
          description: `Assert URL ${originalText.includes('contain') ? 'contains' : 'equals'} "${match[1]}"`,
          expected: match[1],
          naturalLanguage: originalText,
        };

      case 'count':
        return {
          type: 'count',
          description: `Assert there are ${match[1]} ${match[2]}`,
          target: this.parseElementReference(match[2]),
          expected: parseInt(match[1], 10),
          naturalLanguage: originalText,
        };

      default:
        return {
          type: 'custom',
          description: originalText,
          expected: true,
          naturalLanguage: originalText,
        };
    }
  }

  /**
   * Parse element reference from natural language
   */
  private parseElementReference(reference: string): { selector?: string; text?: string; type?: ElementType } {
    const target: { selector?: string; text?: string; type?: ElementType } = {};

    // Check if it's a CSS selector or XPath
    if (reference.match(/^[#\.]/)) {
      target.selector = reference;
      return target;
    }

    // Check for quoted text (specific element text)
    const quotedMatch = reference.match(/\"([^\"]+)\"/);
    if (quotedMatch) {
      target.text = quotedMatch[1];
    } else {
      target.text = reference;
    }

    // Determine element type from description
    for (const [pattern, elementType] of this.elementPatterns) {
      if (pattern.test(reference)) {
        target.type = elementType;
        break;
      }
    }

    return target;
  }

  /**
   * Generate a test name from description
   */
  private generateTestName(description: string): string {
    return description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\s/g, '_');
  }

  /**
   * Determine test complexity based on steps and assertions
   */
  private determineComplexity(steps: ProcessedTestStep[], assertions: ProcessedTestAssertion[]): 'simple' | 'medium' | 'complex' {
    const totalOperations = steps.length + assertions.length;
    const complexSteps = steps.filter(step => 
      ['drag', 'custom'].includes(step.type) || 
      step.options?.waitFor || 
      step.type === 'type' && typeof step.data === 'object'
    ).length;

    if (totalOperations <= 5 && complexSteps === 0) return 'simple';
    if (totalOperations <= 15 && complexSteps <= 2) return 'medium';
    return 'complex';
  }

  /**
   * Estimate test execution time in minutes
   */
  private estimateTestTime(steps: ProcessedTestStep[], assertions: ProcessedTestAssertion[]): number {
    let time = 0;

    // Base time per step type
    const stepTimes = {
      navigate: 2,
      click: 0.5,
      type: 1,
      select: 1,
      wait: 2,
      scroll: 0.5,
      hover: 0.5,
      drag: 2,
      custom: 3,
    };

    for (const step of steps) {
      time += stepTimes[step.type] || 1;
      if (step.options?.timeout) {
        time += (step.options.timeout / 1000) / 60; // Convert ms to minutes
      }
    }

    // Assertions are generally quick
    time += assertions.length * 0.2;

    // Add buffer for test setup/teardown
    time += 1;

    return Math.ceil(time);
  }
}