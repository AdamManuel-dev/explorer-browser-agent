import { Page, Locator } from 'playwright';
export type CaptchaType = 'recaptcha' | 'hcaptcha' | 'funcaptcha' | 'cloudflare' | 'custom' | 'unknown';
export interface CaptchaConfig {
    autoDetect: boolean;
    solveAttempts: number;
    timeout: number;
    services: {
        twoCaptcha?: {
            apiKey: string;
            enabled: boolean;
        };
        antiCaptcha?: {
            apiKey: string;
            enabled: boolean;
        };
        deathByCaptcha?: {
            username: string;
            password: string;
            enabled: boolean;
        };
    };
    manualSolving: {
        enabled: boolean;
        promptUser: boolean;
        timeout: number;
    };
    customSelectors: {
        [key: string]: string[];
    };
}
export interface CaptchaDetectionResult {
    detected: boolean;
    type: CaptchaType;
    element?: Locator;
    selector?: string;
    confidence: number;
    metadata?: {
        siteKey?: string;
        action?: string;
        challenge?: string;
        customType?: string;
    };
}
export interface CaptchaSolutionResult {
    success: boolean;
    solution?: string;
    error?: string;
    timeToSolve: number;
    method: 'service' | 'manual' | 'bypass';
    cost?: number;
}
export declare class CaptchaHandler {
    private config;
    private detectionPatterns;
    constructor(config?: Partial<CaptchaConfig>);
    detectCaptcha(page: Page): Promise<CaptchaDetectionResult>;
    solveCaptcha(page: Page, detection: CaptchaDetectionResult): Promise<CaptchaSolutionResult>;
    handleCaptchaWorkflow(page: Page): Promise<boolean>;
    private attemptSolution;
    private solveWithService;
    private solveRecaptchaWithService;
    private solveHcaptchaWithService;
    private attemptBypass;
    private bypassCloudflare;
    private bypassCustomCaptcha;
    private solveManually;
    private extractCaptchaMetadata;
    private calculateConfidence;
    private initializeDetectionPatterns;
    private hasEnabledService;
    private getPreferredSolvingMethod;
    /**
     * Get the detection patterns for all CAPTCHA types
     * @returns A map of CAPTCHA types to their detection selectors
     */
    getDetectionPatterns(): Map<CaptchaType, string[]>;
    private mergeWithDefaults;
}
//# sourceMappingURL=CaptchaHandler.d.ts.map