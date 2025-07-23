import { vi } from '@jest/globals';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock process.env for tests
process.env.NODE_ENV = 'test';

// Set up global test timeout
vi.setConfig({ testTimeout: 30000 });

// Mock file system operations
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
  stat: vi.fn(),
}));

// Mock path operations
vi.mock('path', async () => {
  const actual = await vi.importActual('path');
  return {
    ...actual,
    join: vi.fn((...paths: string[]) => paths.join('/')),
    resolve: vi.fn((...paths: string[]) => paths.join('/')),
    dirname: vi.fn((path: string) => path.split('/').slice(0, -1).join('/')),
    basename: vi.fn((path: string) => path.split('/').pop() || ''),
  };
});

// Global test setup
beforeEach(() => {
  vi.clearAllMocks();
});

// Global test teardown
afterEach(() => {
  vi.restoreAllMocks();
});