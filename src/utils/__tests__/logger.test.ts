import { logger } from '../logger';

// Mock winston to avoid actual file operations
jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  return {
    createLogger: jest.fn(() => mockLogger),
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      errors: jest.fn(),
      json: jest.fn(),
      printf: jest.fn(),
      colorize: jest.fn(),
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn(),
    },
  };
});

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should export a logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should call info method', () => {
    const message = 'Test info message';
    const meta = { key: 'value' };

    logger.info(message, meta);

    expect(logger.info).toHaveBeenCalledWith(message, meta);
  });

  it('should call warn method', () => {
    const message = 'Test warn message';

    logger.warn(message);

    expect(logger.warn).toHaveBeenCalledWith(message);
  });

  it('should call error method', () => {
    const message = 'Test error message';
    const error = new Error('Test error');

    logger.error(message, error);

    expect(logger.error).toHaveBeenCalledWith(message, error);
  });

  it('should call debug method', () => {
    const message = 'Test debug message';

    logger.debug(message);

    expect(logger.debug).toHaveBeenCalledWith(message);
  });
});
