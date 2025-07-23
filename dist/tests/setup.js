"use strict";
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
        join: jest.fn((...paths) => paths.join('/')),
        resolve: jest.fn((...paths) => paths.join('/')),
        dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/')),
        basename: jest.fn((path) => path.split('/').pop() || ''),
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
//# sourceMappingURL=setup.js.map