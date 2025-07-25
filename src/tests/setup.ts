// Mock problematic ESM modules
jest.mock('p-queue', () => {
  class MockPQueue {
    constructor(options?: any) {
      // Store constructor options for testing if needed
      this.options = options;
    }
    
    options: any;
    size = 0;
    pending = 0;
    isPaused = false;
    
    add = jest.fn().mockImplementation((fn) => Promise.resolve(fn()));
    onEmpty = jest.fn().mockResolvedValue(undefined);
    clear = jest.fn();
    pause = jest.fn();
    start = jest.fn();
  }
  
  return {
    default: MockPQueue,
  };
});

jest.mock('normalize-url', () => ({
  default: jest.fn((url) => url),
}));

jest.mock('robots-parser', () => ({
  default: jest.fn(() => ({
    isAllowed: jest.fn().mockReturnValue(true),
    isDisallowed: jest.fn().mockReturnValue(false),
    getCrawlDelay: jest.fn().mockReturnValue(0),
  })),
}));

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock logger to reduce noise in tests
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock process.env for tests
process.env.NODE_ENV = 'test';

// Set up global test timeout
jest.setTimeout(30000);

// Mock BreadthFirstCrawler to avoid p-queue import issues
jest.mock('../crawler/BreadthFirstCrawler', () => ({
  BreadthFirstCrawler: jest.fn().mockImplementation(() => ({
    crawl: jest.fn().mockResolvedValue({
      pagesVisited: 5,
      urls: ['http://localhost:3001', 'http://localhost:3001/page1'],
      errors: [],
      duration: 1000,
      crawlTree: new Map(),
    }),
  })),
}));

// Mock file system operations
jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(''),
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn().mockResolvedValue({}),
}));

// Mock path operations
jest.mock('path', () => {
  const actual = jest.requireActual('path');
  return {
    ...actual,
    join: jest.fn((...paths: string[]) => paths.join('/')),
    resolve: jest.fn((...paths: string[]) => paths.join('/')),
    dirname: jest.fn((path: string) => path.split('/').slice(0, -1).join('/')),
    basename: jest.fn((path: string) => path.split('/').pop() || ''),
  };
});

// Global test setup
beforeEach(() => {
  jest.clearAllMocks();
});

// Global test teardown
afterEach(() => {
  jest.restoreAllMocks();
});
