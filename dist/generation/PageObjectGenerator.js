"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageObjectGenerator = void 0;
const logger_1 = require("../utils/logger");
class PageObjectGenerator {
    pageObjects = new Map();
    generateFromPath(path) {
        logger_1.logger.info('Generating page objects from user path', {
            pathId: path.id,
            steps: path.steps.length,
        });
        // Group steps by page URL
        const pageGroups = this.groupStepsByPage(path.steps);
        // Generate page object for each page
        const files = [];
        for (const [url, steps] of pageGroups.entries()) {
            const pageObject = this.generatePageObject(url, steps);
            const file = this.generatePageObjectFile(pageObject);
            files.push(file);
        }
        return files;
    }
    groupStepsByPage(steps) {
        const groups = new Map();
        let currentUrl = '';
        for (const step of steps) {
            // Update current URL on navigation
            if (step.type === 'navigation') {
                currentUrl = String(step.value) || '';
            }
            // Group steps by URL
            if (!groups.has(currentUrl)) {
                groups.set(currentUrl, []);
            }
            groups.get(currentUrl).push(step);
        }
        return groups;
    }
    generatePageObject(url, steps) {
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
    extractSelectors(steps) {
        const selectors = {};
        const seen = new Set();
        for (const step of steps) {
            if (!step.element)
                continue;
            const { selector, type, text } = step.element;
            // Skip if already processed
            if (seen.has(selector))
                continue;
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
    generateActions(steps) {
        const actions = {};
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
    identifyActionPatterns(steps) {
        const patterns = new Map();
        // Identify form fill patterns
        const formSteps = [];
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            if (!step)
                continue;
            if (step.type === 'type' || step.type === 'select' || step.type === 'check') {
                formSteps.push(step);
            }
            else if (formSteps.length > 0 && step.element?.type === 'button') {
                // Found submit button, create form action
                formSteps.push(step);
                patterns.set('fillAndSubmitForm', [...formSteps]);
                formSteps.length = 0;
            }
        }
        // Identify login patterns
        const passwordStep = steps.find((s) => s.element?.type === 'password-input');
        if (passwordStep) {
            const loginSteps = steps.filter((s) => s.element?.type === 'text-input' ||
                s.element?.type === 'email-input' ||
                s.element?.type === 'password-input' ||
                (s.element?.type === 'button' && s.element.text?.toLowerCase().includes('login')));
            patterns.set('login', loginSteps);
        }
        return patterns;
    }
    createPageAction(name, steps) {
        const action = {
            name,
            steps: [],
            description: this.generateActionDescription(name, steps),
        };
        // Add parameters based on input fields
        const inputs = steps.filter((s) => s.type === 'type' || s.type === 'select');
        if (inputs.length > 0) {
            action.parameters = inputs.map((input) => ({
                name: this.generateParameterName(input.element),
                type: 'string',
                required: true,
            }));
        }
        // Generate steps
        action.steps = steps.map((step) => this.generateActionStep(step));
        return action;
    }
    generateActionStep(step) {
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
    generateAssertions(_steps) {
        const assertions = {};
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
    generatePageObjectFile(pageObject) {
        const className = `${pageObject.name}Page`;
        const content = this.renderPageObjectClass(className, pageObject);
        return {
            filename: `${className}.ts`,
            path: 'pages',
            content,
            type: 'page-object',
            metadata: {
                generatedAt: new Date(),
                sourcePath: {},
                framework: 'playwright',
                language: 'typescript',
                dependencies: ['@playwright/test'],
            },
        };
    }
    renderPageObjectClass(className, pageObject) {
        const lines = [];
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
    generatePageName(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname.replace(/^\/|\/$/g, '');
            if (!pathname)
                return 'Home';
            // Convert path to PascalCase
            return pathname
                .split(/[-/_]/)
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                .join('');
        }
        catch {
            return 'Page';
        }
    }
    generateSelectorName(element) {
        // Try to generate from element properties
        if (element.attributes.id) {
            return this.toCamelCase(String(element.attributes.id));
        }
        if (element.attributes.name) {
            return this.toCamelCase(String(element.attributes.name));
        }
        if (element.text) {
            return this.toCamelCase(element.text) + this.capitalize(element.type);
        }
        // Fallback to type + index
        return `${element.type.replace('-', '')}Element`;
    }
    generateParameterName(element) {
        if (element.attributes.name) {
            return this.toCamelCase(String(element.attributes.name));
        }
        if (element.metadata?.label) {
            return this.toCamelCase(element.metadata.label);
        }
        return 'value';
    }
    generateActionDescription(name, steps) {
        const actions = steps
            .map((s) => s.action)
            .filter(Boolean)
            .join(', ');
        return `${name}: ${actions}`;
    }
    toCamelCase(str) {
        return str
            .replace(/[^a-zA-Z0-9]/g, ' ')
            .split(' ')
            .filter(Boolean)
            .map((word, index) => index === 0
            ? word.toLowerCase()
            : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
    }
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}
exports.PageObjectGenerator = PageObjectGenerator;
//# sourceMappingURL=PageObjectGenerator.js.map