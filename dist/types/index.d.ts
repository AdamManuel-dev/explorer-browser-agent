export interface BrowserAgentConfig {
    headless: boolean;
    viewport: {
        width: number;
        height: number;
    };
    userAgent: string;
}
export interface PageElement {
    selector: string;
    text: string;
    attributes: Record<string, string>;
}
export interface NavigationOptions {
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
    timeout?: number;
}
//# sourceMappingURL=index.d.ts.map