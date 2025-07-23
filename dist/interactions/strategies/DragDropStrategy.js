"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DragDropStrategy = void 0;
class DragDropStrategy {
    type = 'drag-drop';
    async execute(element, context) {
        const { page } = context;
        const startTime = Date.now();
        try {
            // Locate the element
            const el = await page.$(element.selector);
            if (!el) {
                throw new Error('Element not found');
            }
            // Perform the interaction
            await el.click();
            return {
                success: true,
                value: 'clicked',
                timing: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timing: Date.now() - startTime,
            };
        }
    }
    async validate(element) {
        return element.isEnabled && element.isVisible;
    }
}
exports.DragDropStrategy = DragDropStrategy;
//# sourceMappingURL=DragDropStrategy.js.map