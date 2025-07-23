"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestStructureRule = exports.AssertionQualityRule = exports.SelectorStabilityRule = exports.PlaywrightBestPracticesRule = void 0;
class PlaywrightBestPracticesRule {
    async validate(_testFile, parsed) {
        const errors = [];
        const warnings = [];
        // Check for page.goto usage in tests (should be in beforeEach)
        for (const test of parsed.tests) {
            const testContent = this.getTestContent(_testFile.content, test);
            if (testContent.includes('page.goto')) {
                warnings.push({
                    type: 'best-practice',
                    message: 'Consider moving page.goto to beforeEach hook',
                    line: test.startLine,
                    suggestion: 'Use beforeEach for navigation to improve test maintainability',
                });
            }
        }
        return { errors, warnings };
    }
    getTestContent(fullContent, test) {
        const lines = fullContent.split('\n');
        return lines.slice(test.startLine - 1, test.endLine).join('\n');
    }
}
exports.PlaywrightBestPracticesRule = PlaywrightBestPracticesRule;
class SelectorStabilityRule {
    async validate(_testFile, parsed) {
        const errors = [];
        const warnings = [];
        for (const selector of parsed.selectors) {
            if (selector.type === 'class' && !selector.selector.includes('data-')) {
                warnings.push({
                    type: 'maintainability',
                    message: `Consider using data-testid instead of class selector: ${selector.selector}`,
                    line: selector.line,
                    suggestion: 'Use [data-testid="..."] for more stable selectors',
                });
            }
        }
        return { errors, warnings };
    }
}
exports.SelectorStabilityRule = SelectorStabilityRule;
class AssertionQualityRule {
    async validate(_testFile, parsed) {
        const errors = [];
        const warnings = [];
        for (const assertion of parsed.assertions) {
            if (assertion.type === 'generic') {
                warnings.push({
                    type: 'best-practice',
                    message: 'Consider using more specific assertion',
                    line: assertion.line,
                    suggestion: 'Use specific assertions like toHaveText, toBeVisible, etc.',
                });
            }
        }
        return { errors, warnings };
    }
}
exports.AssertionQualityRule = AssertionQualityRule;
class TestStructureRule {
    async validate(_testFile, parsed) {
        const errors = [];
        const warnings = [];
        // Check for very long tests
        for (const test of parsed.tests) {
            const testLength = test.endLine - test.startLine;
            if (testLength > 50) {
                warnings.push({
                    type: 'maintainability',
                    message: `Test "${test.name}" is very long (${testLength} lines)`,
                    line: test.startLine,
                    suggestion: 'Consider breaking into smaller tests or extracting helper functions',
                });
            }
        }
        return { errors, warnings };
    }
}
exports.TestStructureRule = TestStructureRule;
//# sourceMappingURL=ValidationRules.js.map