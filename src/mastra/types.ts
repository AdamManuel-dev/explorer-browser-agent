import { Page } from 'playwright';

export interface BrowserbaseConfig {
  apiKey: string;
  projectId: string;
  region?: 'us-east-1' | 'us-west-2' | 'eu-west-1';
}

export interface StagehandConfig {
  modelName?:
    | 'gpt-4o'
    | 'gpt-4o-mini'
    | 'gpt-4o-2024-08-06'
    | 'gpt-4.5-preview'
    | 'claude-3-5-sonnet-latest'
    | 'claude-3-5-sonnet-20241022'
    | 'claude-3-5-sonnet-20240620'
    | 'claude-3-7-sonnet-latest'
    | 'claude-3-7-sonnet-20250219'
    | 'o1-mini'
    | 'o1-preview'
    | 'o3-mini'
    | 'cerebras-llama-3.3-70b'
    | 'cerebras-llama-3.1-8b'
    | 'groq-llama-3.3-70b-versatile'
    | 'groq-llama-3.3-70b-specdec';
  modelClientOptions?: Record<string, unknown>;
  enableCaching?: boolean;
  headless?: boolean;
  logger?: (message: {
    id?: string;
    category?: string;
    message: string;
    level?: 0 | 1 | 2;
    timestamp?: string;
    auxiliary?: {
      [key: string]: {
        value: string;
        type: 'object' | 'string' | 'html' | 'integer' | 'float' | 'boolean';
      };
    };
  }) => void | Promise<void>;
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
  metadata: Record<string, unknown>;
}

export interface UserPath {
  id: string;
  name: string;
  url: string;
  steps: ExplorationStep[];
  duration: number;
  success: boolean;
  screenshots: string[];
  metadata: Record<string, unknown>;
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
  metadata: Record<string, unknown>;
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

export interface ExplorationWorkflowInput {
  targets: ExplorationTarget[];
  planningContext?: {
    domain: string;
    objectives: string[];
    constraints: {
      timeLimit?: number;
      resourceLimit?: number;
      priorityAreas?: string[];
      excludedAreas?: string[];
    };
  };
  testGenerationOptions?: {
    framework: 'playwright' | 'cypress' | 'selenium';
    language: 'typescript' | 'javascript' | 'python' | 'java';
    generatePageObjects: boolean;
    generateFixtures: boolean;
    generateHelpers: boolean;
  };
}

export interface ExplorationWorkflowOutput {
  sessionId: string;
  plan: CrawlPlan;
  explorationResults: ExplorationResult[];
  testGenerationResult?: TestGenerationResult;
  metadata: {
    totalDuration: number;
    totalPagesExplored: number;
    totalTestsGenerated: number;
    successRate: number;
    errors: string[];
  };
}
