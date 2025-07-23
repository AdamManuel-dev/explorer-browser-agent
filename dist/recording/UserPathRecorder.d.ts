import { Page } from 'playwright';
import { UserPath, Assertion, RecordingSession, RecordingOptions, PathMetadata } from '../types/recording';
import { InteractiveElement } from '../types/elements';
import { InteractionResult } from '../types/interactions';
export declare class UserPathRecorder {
    private options;
    private session;
    private steps;
    private assertions;
    private startTime;
    private page;
    private context;
    private networkActivity;
    private consoleMessages;
    constructor(options?: RecordingOptions);
    startRecording(page: Page, metadata?: Partial<PathMetadata>): Promise<void>;
    stopRecording(): Promise<UserPath>;
    recordNavigation(url: string): Promise<void>;
    recordInteraction(element: InteractiveElement, result: InteractionResult): Promise<void>;
    recordAssertion(assertion: Assertion): Promise<void>;
    recordWait(duration: number, reason?: string): Promise<void>;
    recordScreenshot(name: string): Promise<void>;
    private setupEventListeners;
    private cleanupEventListeners;
    private captureScreenshot;
    private captureNetworkActivity;
    private mapElementTypeToStepType;
    private getActionDescription;
    private generateNavigationAssertions;
    private generateInteractionAssertions;
    private generateFinalAssertions;
    private analyzePath;
    getSession(): RecordingSession | null;
    getCurrentPath(): UserPath | null;
    pauseRecording(): void;
    resumeRecording(): void;
}
//# sourceMappingURL=UserPathRecorder.d.ts.map