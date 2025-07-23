import { UserPath, InteractionStep } from '../types/recording';
import { PageObject, PageSelector, PageAction, TestFile } from '../types/generation';
import { InteractiveElement } from '../types/elements';
import { logger } from '../utils/logger';

export class PageObjectGenerator {
  private pageObjects: Map<string, PageObject> = new Map();

  generateFromPath(path: UserPath): TestFile[] {
    logger.info('Generating page objects from user path', {
      pathId: path.id,
      steps: path.steps.length,
    });

    // Group steps by page URL
    const pageGroups = this.groupStepsByPage(path.steps);

    // Generate page object for each page
    const files: TestFile[] = [];

    for (const [url, steps] of pageGroups.entries()) {
      const pageObject = this.generatePageObject(url, steps);
      const file = this.generatePageObjectFile(pageObject);
      files.push(file);
    }

    return files;
  }

  private groupStepsByPage(steps: InteractionStep[]): Map<string, InteractionStep[]> {
    const groups = new Map<string, InteractionStep[]>();
    let currentUrl = '';

    for (const step of steps) {
      // Update current URL on navigation
      if (step.type === 'navigation') {
        currentUrl = step.value || '';
      }

      // Group steps by URL
      if (!groups.has(currentUrl)) {
        groups.set(currentUrl, []);
      }
      groups.get(currentUrl)!.push(step);
    }

    return groups;
  }

  private generatePageObject(url: string, steps: InteractionStep[]): PageObject {
    const pageName = this.generatePageName(url);
    const selectors = this.extractSelectors(steps);
    const actions = this.generateActions(steps);
    const assertions = this.generateAssertions(steps);

    return {
      name: pageName,
      url,
      selectors,
      actions,
      assertions,
    };
  }

  private extractSelectors(steps: InteractionStep[]): Record<string, PageSelector> {
    const selectors: Record<string, PageSelector> = {};
    const seen = new Set<string>();

    for (const step of steps) {
      if (!step.element) continue;

      const { selector, type, text } = step.element;

      // Skip if already processed
      if (seen.has(selector)) continue;
      seen.add(selector);

      // Generate a meaningful name
      const name = this.generateSelectorName(step.element);

      selectors[name] = {
        selector,
        description: text || `${type} element`,
        type,
      };
    }

    return selectors;
  }

  private generateActions(steps: InteractionStep[]): Record<string, PageAction> {
    const actions: Record<string, PageAction> = {};
    const actionGroups = this.identifyActionPatterns(steps);

    for (const [actionName, actionSteps] of actionGroups) {
      actions[actionName] = this.createPageAction(actionName, actionSteps);
    }

    // Add common actions
    actions.navigate = {
      name: 'navigate',
      steps: [`await this.page.goto(this.url);`],
      description: 'Navigate to the page',
    };

    actions.waitForLoad = {
      name: 'waitForLoad',
      steps: [`await this.page.waitForLoadState('networkidle');`],
      description: 'Wait for page to fully load',
    };

    return actions;
  }

  private identifyActionPatterns(steps: InteractionStep[]): Map<string, InteractionStep[]> {
    const patterns = new Map<string, InteractionStep[]>();

    // Identify form fill patterns
    const formSteps: InteractionStep[] = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      if (!step) continue;

      if (step.type === 'type' || step.type === 'select' || step.type === 'check') {
        formSteps.push(step);
      } else if (formSteps.length > 0 && step.element?.type === 'button') {
        // Found submit button, create form action
        formSteps.push(step);
        patterns.set('fillAndSubmitForm', [...formSteps]);
        formSteps.length = 0;
      }
    }

    // Identify login patterns
    const passwordStep = steps.find((s) => s.element?.type === 'password-input');
    if (passwordStep) {
      const loginSteps = steps.filter(
        (s) =>
          s.element?.type === 'text-input' ||
          s.element?.type === 'email-input' ||
          s.element?.type === 'password-input' ||
          (s.element?.type === 'button' && s.element.text?.toLowerCase().includes('login'))
      );
      patterns.set('login', loginSteps);
    }

    return patterns;
  }

  private createPageAction(name: string, steps: InteractionStep[]): PageAction {
    const action: PageAction = {
      name,
      steps: [],
      description: this.generateActionDescription(name, steps),
    };

    // Add parameters based on input fields
    const inputs = steps.filter((s) => s.type === 'type' || s.type === 'select');
    if (inputs.length > 0) {
      action.parameters = inputs.map((input) => ({
        name: this.generateParameterName(input.element!),
        type: 'string',
        required: true,
      }));
    }

    // Generate steps
    action.steps = steps.map((step) => this.generateActionStep(step));

    return action;
  }

  private generateActionStep(step: InteractionStep): string {
    if (!step.element) {
      return `// ${step.action}`;
    }

    const selectorName = this.generateSelectorName(step.element);

    switch (step.type) {
      case 'click':
        return `await this.page.click(this.selectors.${selectorName});`;
      case 'type': {
        const paramName = this.generateParameterName(step.element);
        return `await this.page.fill(this.selectors.${selectorName}, ${paramName});`;
      }
      case 'select':
        return `await this.page.selectOption(this.selectors.${selectorName}, value);`;
      case 'check':
        return step.value
          ? `await this.page.check(this.selectors.${selectorName});`
          : `await this.page.uncheck(this.selectors.${selectorName});`;
      default:
        return `// ${step.action}`;
    }
  }

  private generateAssertions(_steps: InteractionStep[]): Record<string, unknown> {
    const assertions: Record<string, unknown> = {};

    // Add common assertions
    assertions.isVisible = {
      name: 'isVisible',
      selector: 'element',
      condition: 'toBeVisible()',
      description: 'Check if element is visible',
    };

    assertions.hasText = {
      name: 'hasText',
      selector: 'element',
      condition: 'toHaveText(expectedText)',
      description: 'Check if element contains text',
    };

    return assertions;
  }

  private generatePageObjectFile(pageObject: PageObject): TestFile {
    const className = `${pageObject.name}Page`;
    const content = this.renderPageObjectClass(className, pageObject);

    return {
      filename: `${className}.ts`,
      path: 'pages',
      content,
      type: 'page-object',
      metadata: {
        generatedAt: new Date(),
        sourcePath: {} as UserPath,
        framework: 'playwright',
        language: 'typescript',
        dependencies: ['@playwright/test'],
      },
    };
  }

  private renderPageObjectClass(className: string, pageObject: PageObject): string {
    const lines: string[] = [];

    // Imports
    lines.push(`import { Page } from '@playwright/test';`);
    lines.push('');

    // Class definition
    lines.push(`export class ${className} {`);
    lines.push(`  private page: Page;`);
    lines.push(`  private url = '${pageObject.url}';`);
    lines.push('');

    // Selectors
    lines.push('  private selectors = {');
    for (const [name, selector] of Object.entries(pageObject.selectors)) {
      lines.push(`    ${name}: '${selector.selector}',`);
    }
    lines.push('  };');
    lines.push('');

    // Constructor
    lines.push('  constructor(page: Page) {');
    lines.push('    this.page = page;');
    lines.push('  }');
    lines.push('');

    // Actions
    for (const [name, action] of Object.entries(pageObject.actions)) {
      const params = action.parameters
        ? action.parameters.map((p) => `${p.name}: ${p.type}`).join(', ')
        : '';

      lines.push(`  async ${name}(${params}) {`);
      action.steps.forEach((step) => {
        lines.push(`    ${step}`);
      });
      lines.push('  }');
      lines.push('');
    }

    // Getters for elements
    lines.push('  // Element getters');
    for (const [name] of Object.entries(pageObject.selectors)) {
      lines.push(`  get ${name}() {`);
      lines.push(`    return this.page.locator(this.selectors.${name});`);
      lines.push('  }');
      lines.push('');
    }

    lines.push('}');

    return lines.join('\n');
  }

  private generatePageName(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.replace(/^\/|\/$/g, '');

      if (!pathname) return 'Home';

      // Convert path to PascalCase
      return pathname
        .split(/[-/_]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
    } catch {
      return 'Page';
    }
  }

  private generateSelectorName(element: InteractiveElement): string {
    // Try to generate from element properties
    if (element.attributes.id) {
      return this.toCamelCase(element.attributes.id);
    }

    if (element.attributes.name) {
      return this.toCamelCase(element.attributes.name);
    }

    if (element.text) {
      return this.toCamelCase(element.text) + this.capitalize(element.type);
    }

    // Fallback to type + index
    return `${element.type.replace('-', '')}Element`;
  }

  private generateParameterName(element: InteractiveElement): string {
    if (element.attributes.name) {
      return this.toCamelCase(element.attributes.name);
    }

    if (element.metadata?.label) {
      return this.toCamelCase(element.metadata.label);
    }

    return 'value';
  }

  private generateActionDescription(name: string, steps: InteractionStep[]): string {
    const actions = steps
      .map((s) => s.action)
      .filter(Boolean)
      .join(', ');

    return `${name}: ${actions}`;
  }

  private toCamelCase(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((word, index) =>
        index === 0
          ? word.toLowerCase()
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join('');
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
