import { Page } from 'playwright';
export interface BrowserbaseConfig {
    apiKey: string;
    projectId: string;
    region?: 'us-east-1' | 'us-west-2' | 'eu-west-1';
}
export interface StagehandConfig {
    modelName?: string;
    modelClientOptions?: Record<string, any>;
    enableCaching?: boolean;
    headless?: boolean;
    logger?: (message: string, level?: string) => void;
}
export interface ExplorationTarget {
    url: string;
    domain: string;
    maxDepth: number;
    maxPages: number;
    patterns?: string[];
    excludePatterns?: string[];
    requireAuth?: boolean;
    authStrategy?: string;
    selectors?: {
        include?: string[];
        exclude?: string[];
    };
}
export interface ExplorationResult {
    id: string;
    target: ExplorationTarget;
    startTime: Date;
    endTime: Date;
    pagesExplored: number;
    elementsFound: number;
    interactionsRecorded: number;
    screenshotsTaken: number;
    userPaths: UserPath[];
    errors: ExplorationError[];
    metadata: Record<string, any>;
}
export interface UserPath {
    id: string;
    name: string;
    url: string;
    steps: ExplorationStep[];
    duration: number;
    success: boolean;
    screenshots: string[];
    metadata: Record<string, any>;
}
export interface ExplorationStep {
    id: string;
    type: 'navigate' | 'click' | 'fill' | 'select' | 'hover' | 'scroll' | 'wait' | 'extract';
    selector?: string;
    value?: string;
    url?: string;
    timestamp: Date;
    duration: number;
    success: boolean;
    screenshot?: string;
    elementInfo?: ElementInfo;
    error?: string;
}
export interface ElementInfo {
    tagName: string;
    text?: string;
    attributes: Record<string, string>;
    computedStyles?: Record<string, string>;
    boundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    isVisible: boolean;
    isClickable: boolean;
    isFormField: boolean;
}
export interface ExplorationError {
    id: string;
    type: 'navigation' | 'interaction' | 'extraction' | 'timeout' | 'auth' | 'captcha';
    message: string;
    stack?: string;
    url?: string;
    selector?: string;
    timestamp: Date;
    recoverable: boolean;
}
export interface CrawlPlan {
    id: string;
    name: string;
    targets: ExplorationTarget[];
    strategy: 'breadth-first' | 'depth-first' | 'priority-based' | 'distributed';
    priority: number;
    schedule?: {
        startAt?: Date;
        interval?: string;
        maxRuns?: number;
    };
    resources: {
        maxConcurrency: number;
        maxMemory: number;
        timeout: number;
    };
    notifications?: {
        onComplete?: string[];
        onError?: string[];
    };
}
export interface TestGenerationRequest {
    userPaths: UserPath[];
    framework: 'playwright' | 'cypress' | 'selenium';
    language: 'typescript' | 'javascript' | 'python' | 'java';
    options: {
        generatePageObjects: boolean;
        generateFixtures: boolean;
        generateHelpers: boolean;
        outputDirectory: string;
    };
}
export interface TestGenerationResult {
    id: string;
    request: TestGenerationRequest;
    files: GeneratedFile[];
    metrics: {
        testsGenerated: number;
        pageObjectsGenerated: number;
        linesOfCode: number;
        generationTime: number;
    };
    quality: {
        syntaxValid: boolean;
        lintScore: number;
        testCoverage: number;
    };
}
export interface GeneratedFile {
    path: string;
    content: string;
    type: 'test' | 'page-object' | 'fixture' | 'helper' | 'config';
    framework: string;
    language: string;
}
export interface WorkflowContext {
    sessionId: string;
    userId?: string;
    config: {
        browserbase: BrowserbaseConfig;
        stagehand: StagehandConfig;
    };
    targets: ExplorationTarget[];
    results: ExplorationResult[];
    currentPage?: Page;
    errors: ExplorationError[];
    metadata: Record<string, any>;
}
export interface AgentCapabilities {
    canNavigate: boolean;
    canInteract: boolean;
    canExtract: boolean;
    canGenerateTests: boolean;
    canHandleAuth: boolean;
    canHandleCaptcha: boolean;
    canTakeScreenshots: boolean;
    supportedBrowsers: string[];
}
export interface AgentMetrics {
    tasksCompleted: number;
    tasksSuccessful: number;
    tasksFailed: number;
    averageTaskDuration: number;
    totalRuntime: number;
    memoryUsage: number;
    cpuUsage: number;
    lastActivity: Date;
}
//# sourceMappingURL=types.d.ts.map