"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowEngine = void 0;
class WorkflowEngine {
    config;
    workflows = new Map();
    eventHandlers = new Map();
    isStarted = false;
    constructor(config) {
        this.config = config;
    }
    registerWorkflow(name, workflow) {
        this.workflows.set(name, workflow);
    }
    async start() {
        this.isStarted = true;
    }
    async stop() {
        this.isStarted = false;
    }
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }
    emit(event, ...args) {
        const handlers = this.eventHandlers.get(event) || [];
        handlers.forEach((handler) => handler(...args));
    }
}
exports.WorkflowEngine = WorkflowEngine;
//# sourceMappingURL=WorkflowEngine.js.map