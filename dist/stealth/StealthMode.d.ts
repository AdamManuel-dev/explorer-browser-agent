import { Browser, BrowserContext, Page } from 'playwright';
export interface StealthConfig {
    userAgents: {
        enabled: boolean;
        rotateOnNewPage: boolean;
        customAgents?: string[];
    };
    viewport: {
        randomize: boolean;
        commonSizes: Array<{
            width: number;
            height: number;
        }>;
    };
    timing: {
        humanLikeDelays: boolean;
        minDelay: number;
        maxDelay: number;
        typingSpeed: {
            min: number;
            max: number;
        };
    };
    fingerprinting: {
        spoofWebGL: boolean;
        spoofCanvas: boolean;
        spoofAudio: boolean;
        spoofTimezone: boolean;
        spoofLanguages: boolean;
    };
    navigation: {
        randomScrolling: boolean;
        mouseMoves: boolean;
        refererSpoofing: boolean;
    };
    headers: {
        acceptLanguage: string[];
        acceptEncoding: string[];
        customHeaders: Record<string, string>;
    };
}
export interface StealthMetrics {
    detectionAttempts: number;
    successfulEvasions: number;
    failedEvasions: number;
    averagePageLoadTime: number;
    userAgentRotations: number;
}
export declare class StealthMode {
    private config;
    private metrics;
    private userAgentPool;
    private currentUserAgentIndex;
    constructor(config?: Partial<StealthConfig>);
    setupStealthBrowser(browser: Browser): Promise<BrowserContext>;
    setupStealthPage(page: Page): Promise<void>;
    navigateStealthily(page: Page, url: string): Promise<void>;
    typeStealthily(page: Page, selector: string, text: string): Promise<void>;
    clickStealthily(page: Page, selector: string): Promise<void>;
    detectBotDetection(page: Page): Promise<boolean>;
    getMetrics(): StealthMetrics;
    resetMetrics(): void;
    getConfig(): StealthConfig;
    generateRandomUserAgent(): string;
    private injectStealthScripts;
    private getStealthScript;
    private setupRequestInterception;
    private setupPageEventHandlers;
    private applyPageStealthMeasures;
    private simulateHumanBehavior;
    private randomScroll;
    private randomMouseMove;
    private rotateUserAgent;
    private getRandomUserAgent;
    private getRandomViewport;
    private getRandomLocale;
    private getRandomTimezone;
    private getRandomGeolocation;
    private buildStealthHeaders;
    private buildUserAgentPool;
    private humanDelay;
    private getTypingDelay;
    private randomBetween;
    private getRandomItem;
    private updateMetrics;
    private mergeWithDefaults;
}
//# sourceMappingURL=StealthMode.d.ts.map