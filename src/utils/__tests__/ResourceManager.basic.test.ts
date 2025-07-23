import { test, expect, describe, beforeEach, afterEach, jest } from '@jest/globals';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { ResourceManager } from '../ResourceManager';

jest.mock('playwright');
jest.mock('../logger');

describe('ResourceManager Basic Tests', () => {
  let resourceManager: ResourceManager;
  let mockBrowser: jest.Mocked<Browser>;
  let mockContext: jest.Mocked<BrowserContext>;
  let mockPage: jest.Mocked<Page>;

  beforeEach(() => {
    mockPage = {
      close: jest.fn(),
      isClosed: jest.fn().mockReturnValue(false),
    } as any;

    mockContext = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
    } as any;

    mockBrowser = {
      newContext: jest.fn().mockResolvedValue(mockContext),
      close: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
    } as any;

    (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);

    resourceManager = new ResourceManager();
  });

  afterEach(async () => {
    await resourceManager.cleanup();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a ResourceManager instance', () => {
      const manager = new ResourceManager();
      expect(manager).toBeInstanceOf(ResourceManager);
    });
  });

  describe('allocateResources', () => {
    it('should create and return resource allocation', async () => {
      const allocation = await resourceManager.allocateResources();

      expect(allocation.browser).toBe(mockBrowser);
      expect(allocation).toHaveProperty('browserId');
      expect(allocation).toHaveProperty('contextId');
      expect(allocation).toHaveProperty('pageId');
      expect(chromium.launch).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should clean up all resources', async () => {
      await resourceManager.allocateResources();
      await resourceManager.cleanup();

      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });
});