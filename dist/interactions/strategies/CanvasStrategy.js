"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CanvasStrategy = void 0;
class CanvasStrategy {
    type = 'canvas';
    async execute(context) {
        const { element } = context;
        try {
            // Basic implementation - just click the canvas
            await element.click();
            return {
                success: true,
                message: 'Canvas clicked successfully',
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to interact with canvas: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    }
}
exports.CanvasStrategy = CanvasStrategy;
//# sourceMappingURL=CanvasStrategy.js.map