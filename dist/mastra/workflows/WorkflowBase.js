"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Workflow = void 0;
class Workflow {
    config;
    steps = new Map();
    constructor(config) {
        this.config = config;
    }
    addStep(name, handler) {
        this.steps.set(name, handler);
    }
    async executeStep(stepName, context) {
        const step = this.steps.get(stepName);
        if (!step) {
            throw new Error(`Step '${stepName}' not found`);
        }
        context.metadata.currentStep = stepName;
        await step(context);
    }
}
exports.Workflow = Workflow;
//# sourceMappingURL=WorkflowBase.js.map