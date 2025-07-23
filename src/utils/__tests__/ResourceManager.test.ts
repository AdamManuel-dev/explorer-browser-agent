import { expect, describe, beforeEach, afterEach, jest } from '@jest/globals';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { ResourceManager } from '../ResourceManager';

jest.mock('playwright');
jest.mock('../logger');

describe('ResourceManager', () => {
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
      newPage: jest.fn<() => Promise<Page>>().mockResolvedValue(mockPage as Page),
      close: jest.fn(),
    } as any;

    mockBrowser = {
      newContext: jest.fn<() => Promise<BrowserContext>>().mockResolvedValue(mockContext as BrowserContext),
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
      expect(chromium.launch).toHaveBeenCalled();
    });

    it('should reuse existing browsers when available', async () => {
      const allocation1 = await resourceManager.allocateResources();
      const allocation2 = await resourceManager.allocateResources();

      expect(allocation1.browser).toBe(allocation2.browser);
      expect(chromium.launch).toHaveBeenCalledTimes(1);
    });

    it('should allocate multiple resources from the same browser', async () => {
      const allocation1 = await resourceManager.allocateResources();
      const allocation2 = await resourceManager.allocateResources();

      expect(allocation1.browser).toBe(allocation2.browser);
      expect(chromium.launch).toHaveBeenCalledTimes(1);

      await resourceManager.cleanup();
    });
  });

  describe('releaseResources', () => {
    it('should release allocated resources', async () => {
      const allocation = await resourceManager.allocateResources();
      const allocationId = 'test-allocation-id';
      
      // Mock the internal allocatedResources map
      (resourceManager as any).allocatedResources.set(allocationId, allocation);

      await resourceManager.releaseResources(allocationId);

      expect((resourceManager as any).allocatedResources.has(allocationId)).toBe(false);
    });

    it('should handle unknown allocation IDs gracefully', async () => {
      await expect(resourceManager.releaseResources('unknown-id')).resolves.not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should clean up all resources', async () => {
      await resourceManager.allocateResources();

      await resourceManager.cleanup();

      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle cleanup when no resources are allocated', async () => {
      await expect(resourceManager.cleanup()).resolves.not.toThrow();
    });
  });

  describe('metrics and monitoring', () => {
    it('should track resource allocation metrics', async () => {
      const allocation = await resourceManager.allocateResources();
      
      expect(allocation).toHaveProperty('browserId');
      expect(allocation).toHaveProperty('contextId');
      expect(allocation).toHaveProperty('pageId');
      expect(allocation).toHaveProperty('allocatedAt');
    });

    it('should provide resource status information', () => {
      const status = resourceManager.getResourceStatus();
      
      expect(status).toHaveProperty('totalBrowsers');
      expect(status).toHaveProperty('totalContexts');
      expect(status).toHaveProperty('totalPages');
      expect(status).toHaveProperty('allocatedResources');
    });
  });

  describe('error handling', () => {
    it('should handle browser launch failures', async () => {
      (chromium.launch as jest.Mock).mockRejectedValue(new Error('Launch failed'));

      await expect(resourceManager.allocateResources()).rejects.toThrow('Launch failed');
    });

    it('should prevent resource allocation during shutdown', async () => {
      await resourceManager.cleanup();

      await expect(resourceManager.allocateResources()).rejects.toThrow('ResourceManager is shutting down');
    });
  });
});