import { BrowserAgentConfig } from '../types';
export declare class BrowserAgent {
    private browser;
    private context;
    private page;
    private config;
    constructor(config?: Partial<BrowserAgentConfig>);
    initialize(): Promise<void>;
    navigate(url: string): Promise<void>;
    extractContent(): Promise<string>;
    screenshot(path: string): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=BrowserAgent.d.ts.map