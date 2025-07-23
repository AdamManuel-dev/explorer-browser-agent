import { InteractiveElement } from './elements';
import { StateChange, NetworkActivity } from './interactions';
export interface UserPath {
    id: string;
    name: string;
    description?: string;
    startUrl: string;
    endUrl?: string;
    steps: InteractionStep[];
    assertions: Assertion[];
    duration: number;
    metadata: PathMetadata;
    createdAt: Date;
}
export interface InteractionStep {
    id: string;
    type: StepType;
    element?: InteractiveElement;
    action: string;
    value?: any;
    timestamp: number;
    duration: number;
    screenshot?: string;
    networkActivity: NetworkActivity[];
    stateChanges: StateChange[];
    error?: string;
    retries?: number;
}
export type StepType = 'navigation' | 'click' | 'type' | 'select' | 'check' | 'uncheck' | 'hover' | 'scroll' | 'wait' | 'screenshot' | 'assertion' | 'custom';
export interface Assertion {
    id: string;
    type: AssertionType;
    target: string;
    expected: any;
    operator: AssertionOperator;
    message?: string;
    screenshot?: string;
}
export type AssertionType = 'url' | 'title' | 'text' | 'visible' | 'enabled' | 'value' | 'count' | 'attribute' | 'css' | 'screenshot' | 'network' | 'storage' | 'custom';
export type AssertionOperator = 'equals' | 'contains' | 'matches' | 'greater-than' | 'less-than' | 'exists' | 'not-exists';
export interface PathMetadata {
    browser: string;
    viewport: {
        width: number;
        height: number;
    };
    userAgent: string;
    locale?: string;
    timezone?: string;
    recordedBy?: string;
    tags?: string[];
    purpose?: string;
    critical?: boolean;
}
export interface RecordingSession {
    id: string;
    startTime: Date;
    endTime?: Date;
    status: 'recording' | 'paused' | 'completed' | 'failed';
    currentPath?: UserPath;
    options: RecordingOptions;
}
export interface RecordingOptions {
    captureScreenshots: boolean;
    captureNetwork: boolean;
    captureConsole: boolean;
    generateAssertions: boolean;
    assertionTypes: AssertionType[];
    screenshotQuality?: number;
    videoRecord?: boolean;
    slowMo?: number;
    maskSensitiveData?: boolean;
}
export interface PathAnalysis {
    complexity: 'simple' | 'moderate' | 'complex';
    estimatedDuration: number;
    interactionCount: number;
    uniqueElements: number;
    pageTransitions: number;
    networkRequests: number;
    assertions: number;
    coverage: {
        elements: number;
        elementsTested: number;
        percentage: number;
    };
}
//# sourceMappingURL=recording.d.ts.map