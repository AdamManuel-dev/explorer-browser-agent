import { Page } from 'playwright';
import { InteractiveElement } from '../types/elements';
import { InteractionResult, InteractionOptions } from '../types/interactions';
export declare class InteractionExecutor {
    private strategies;
    private testDataGenerator;
    private page;
    constructor();
    setPage(page: Page): void;
    executeInteraction(element: InteractiveElement, options?: InteractionOptions): Promise<InteractionResult>;
    private initializeStrategies;
    private monitorNetwork;
    private waitForNetworkIdle;
    private captureState;
    private compareStates;
    private takeScreenshot;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=InteractionExecutor.d.ts.map