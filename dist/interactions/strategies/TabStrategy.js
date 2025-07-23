"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TabStrategy = void 0;
class TabStrategy {
    type = 'tab';
    async execute(context) {
        const { element } = context;
        try {
            // Basic implementation - just click the tab
            await element.click();
            return {
                success: true,
                message: 'Tab clicked successfully',
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to interact with tab: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    }
}
exports.TabStrategy = TabStrategy;
//# sourceMappingURL=TabStrategy.js.map