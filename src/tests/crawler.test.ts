// @ts-nocheck
import { test, expect, describe, beforeEach, jest } from '@jest/globals';
import { Page, Browser } from 'playwright';
import { BreadthFirstCrawler, CrawlConfiguration } from '../crawler/BreadthFirstCrawler';

jest.mock('../utils/logger');

// Mock ES modules that cause issues in Jest
jest.mock('normalize-url', () => {
  return {
    __esModule: true,
    default: (url: string) => url.toLowerCase().replace(/\/$/, '').replace(/#.*$/, '')
  };
});

jest.mock('robots-parser', () => {
  return {
    __esModule: true,
    default: () => ({
      isAllowed: () => true
    })
  };
});

jest.mock('p-queue', () => {
  return {
    __esModule: true,
    default: class MockQueue {
      private tasks: Array<() => Promise<any>> = [];
      private running = 0;
      private concurrency = 5;

      constructor(options: any) {
        this.concurrency = options.concurrency || 5;
      }

      async add<T>(fn: () => Promise<T>): Promise<T> {
        return fn();
      }

      async onIdle(): Promise<void> {
        return Promise.resolve();
      }
    }
  };
});

describe('BreadthFirstCrawler', () => {
  let crawler: BreadthFirstCrawler;
  let mockPage: Partial<Page>;
  let mockBrowser: Partial<Browser>;
  let defaultConfig: CrawlConfiguration;

  beforeEach(() => {
    mockPage = {
      goto: jest.fn().mockResolvedValue({ status: () => 200, ok: () => true }),
      url: jest.fn().mockReturnValue('https://example.com'),
      title: jest.fn().mockResolvedValue('Test Page'),
      content: jest.fn().mockResolvedValue('<html><body>Test content</body></html>'),
      evaluate: jest.fn().mockResolvedValue([]),
      waitForLoadState: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
    };

    defaultConfig = {
      startUrl: 'https://example.com',
      maxDepth: 2,
      maxPages: 10,
      crawlDelay: 1000,
      allowedDomains: ['example.com'],
      parallelWorkers: 2,
      respectRobotsTxt: true,
      userAgent: 'test-crawler',
    };

    crawler = new BreadthFirstCrawler(defaultConfig);
  });

  describe('initialization', () => {
    test('should initialize with default options', () => {
      expect(crawler).toBeDefined();
    });

    test('should validate crawl options', async () => {
      const invalidConfig: CrawlConfiguration = {
        startUrl: 'invalid-url',
        maxDepth: -1,
        maxPages: 0,
        crawlDelay: -1,
        allowedDomains: [],
        respectRobotsTxt: true,
        userAgent: 'test-crawler',
      };

      const invalidCrawler = new BreadthFirstCrawler(invalidConfig);
      await expect(invalidCrawler.crawl()).rejects.toThrow();
    });
  });

  describe('URL processing', () => {
    test('should normalize URLs correctly', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 1,
        maxPages: 5,
        crawlDelay: 100,
        allowedDomains: ['example.com'],
        respectRobotsTxt: false,
        userAgent: 'test-crawler',
      };

      // Mock finding links
      (mockPage.evaluate as jest.Mock).mockResolvedValue([
        'https://example.com/page1',
        'https://example.com/page1/', // Should be normalized
        'https://example.com/page1#fragment', // Should remove fragment
        '/relative-page', // Should be made absolute
        'https://otherdomain.com/page', // Should be filtered out by allowedDomains
      ]);

      const result = await new BreadthFirstCrawler(options).crawl();

      expect(result.urls).toContain('https://example.com/page1');
      expect(result.urls).not.toContain('https://otherdomain.com/page');
    });

    test('should respect domain restriction', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 1,
        maxPages: 5,
        crawlDelay: 100,
        allowedDomains: ['example.com'],
        respectRobotsTxt: false,
        userAgent: 'test-crawler',
      };

      (mockPage.evaluate as jest.Mock).mockResolvedValue([
        'https://example.com/page1',
        'https://other-domain.com/page2',
        'https://subdomain.example.com/page3',
      ]);

      const result = await new BreadthFirstCrawler(options).crawl();

      expect(result.urls).toContain('https://example.com/page1');
      expect(result.urls).not.toContain('https://other-domain.com/page2');
    });

    test('should allow cross-domain when no domain restrictions', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 1,
        maxPages: 5,
        crawlDelay: 100,
        allowedDomains: [], // Empty array allows all domains
        respectRobotsTxt: false,
        userAgent: 'test-crawler',
      };

      (mockPage.evaluate as jest.Mock).mockResolvedValue([
        'https://example.com/page1',
        'https://other-domain.com/page2',
      ]);

      const result = await new BreadthFirstCrawler(options).crawl();

      expect(result.urls).toContain('https://example.com/page1');
      expect(result.urls).toContain('https://other-domain.com/page2');
    });
  });

  describe('depth and page limits', () => {
    test('should respect max depth limit', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 1,
        maxPages: 10,
        crawlDelay: 100,
        allowedDomains: ['example.com'],
        respectRobotsTxt: false,
        userAgent: 'test-crawler',
      };

      // Mock different responses based on URL
      let callCount = 0;
      (mockPage.evaluate as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(['https://example.com/page1']);
        }
        return Promise.resolve(['https://example.com/page2']);
      });

      const result = await new BreadthFirstCrawler(options).crawl();

      // Should crawl start URL (depth 0) and page1 (depth 1), but not page2 (depth 2)
      expect(result.urls.length).toBeLessThanOrEqual(2);
      expect(result.pagesVisited).toBeLessThanOrEqual(2);
    });

    test('should respect max pages limit', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 5,
        maxPages: 2,
        crawlDelay: 100,
        allowedDomains: ['example.com'],
        respectRobotsTxt: false,
        userAgent: 'test-crawler',
      };

      (mockPage.evaluate as jest.Mock).mockResolvedValue([
        'https://example.com/page1',
        'https://example.com/page2',
        'https://example.com/page3',
        'https://example.com/page4',
      ]);

      const result = await new BreadthFirstCrawler(options).crawl();

      expect(result.urls.length).toBeLessThanOrEqual(2);
      expect(result.pagesVisited).toBe(2);
    });
  });

  describe('robots.txt handling', () => {
    test('should respect robots.txt when enabled', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 1,
        maxPages: 5,
        crawlDelay: 100,
        allowedDomains: ['example.com'],
        respectRobotsTxt: true,
        userAgent: 'test-crawler',
      };

      // Mock robots.txt response
      const mockRobotsPage = {
        goto: jest.fn().mockResolvedValue({
          status: () => 200,
          ok: () => true,
          url: () => 'https://example.com',
        } as Response),
        content: jest.fn().mockResolvedValue('User-agent: *\nDisallow: /private/'),
      };
      (mockBrowser.newPage as jest.Mock).mockResolvedValueOnce(mockRobotsPage);

      (mockPage.evaluate as jest.Mock).mockResolvedValue([
        'https://example.com/public-page',
        'https://example.com/private/secret',
      ]);

      const result = await new BreadthFirstCrawler(options).crawl();

      expect(result.urls).toContain('https://example.com/public-page');
      expect(result.urls).not.toContain('https://example.com/private/secret');
    });

    test('should continue crawling when robots.txt is not found', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 1,
        maxPages: 5,
        crawlDelay: 100,
        allowedDomains: ['example.com'],
        respectRobotsTxt: true,
        userAgent: 'test-crawler',
      };

      // Mock robots.txt 404 response
      const mockRobotsPage = {
        goto: jest.fn().mockRejectedValue(new Error('404 Not Found')),
        close: jest.fn().mockResolvedValue(undefined),
      };
      (mockBrowser.newPage as jest.Mock).mockResolvedValueOnce(mockRobotsPage);

      (mockPage.evaluate as jest.Mock).mockResolvedValue(['https://example.com/page1']);

      const result = await new BreadthFirstCrawler(options).crawl();

      expect(result.urls.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    test('should handle page load errors gracefully', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 1,
        maxPages: 5,
        crawlDelay: 100,
        allowedDomains: ['example.com'],
        respectRobotsTxt: false,
        userAgent: 'test-crawler',
      };

      (mockPage.goto as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await new BreadthFirstCrawler(options).crawl();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toContain('Network error');
    });

    test('should continue crawling after individual page errors', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 1,
        maxPages: 5,
        crawlDelay: 100,
        allowedDomains: ['example.com'],
        respectRobotsTxt: false,
        userAgent: 'test-crawler',
      };

      let callCount = 0;
      (mockPage.goto as jest.Mock).mockImplementation((_url) => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Failed to load page');
        }
        return Promise.resolve();
      });

      (mockPage.evaluate as jest.Mock).mockResolvedValue([
        'https://example.com/page1',
        'https://example.com/page2',
      ]);

      const result = await new BreadthFirstCrawler(options).crawl();

      expect(result.urls.length).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('delay handling', () => {
    test('should respect delay between requests', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 1,
        maxPages: 3,
        crawlDelay: 100,
        allowedDomains: ['example.com'],
        respectRobotsTxt: false,
        userAgent: 'test-crawler',
      };

      (mockPage.evaluate as jest.Mock).mockResolvedValue([
        'https://example.com/page1',
        'https://example.com/page2',
      ]);

      const startTime = Date.now();
      await new BreadthFirstCrawler(options).crawl();
      const endTime = Date.now();

      // Should take at least some time due to delay
      expect(endTime - startTime).toBeGreaterThanOrEqual(50);
    });
  });

  describe('statistics and reporting', () => {
    test('should generate accurate results', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 2,
        maxPages: 5,
        crawlDelay: 100,
        allowedDomains: ['example.com'],
        respectRobotsTxt: false,
        userAgent: 'test-crawler',
      };

      (mockPage.evaluate as jest.Mock).mockResolvedValue(['https://example.com/page1']);

      const result = await new BreadthFirstCrawler(options).crawl();

      expect(result.pagesVisited).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.urls.length).toBeGreaterThanOrEqual(0);
      expect(result.crawlTree).toBeDefined();
    });

    test('should track unique URLs correctly', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 1,
        maxPages: 5,
        crawlDelay: 100,
        allowedDomains: ['example.com'],
        respectRobotsTxt: false,
        userAgent: 'test-crawler',
      };

      (mockPage.evaluate as jest.Mock).mockResolvedValue([
        'https://example.com/page1',
        'https://example.com/page1', // Duplicate
        'https://example.com/page2',
      ]);

      const result = await new BreadthFirstCrawler(options).crawl();

      const uniqueUrls = new Set(result.urls);
      expect(uniqueUrls.size).toBe(result.urls.length);
    });
  });

  describe('cleanup', () => {
    test('should close pages after crawling', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 1,
        maxPages: 1,
        crawlDelay: 100,
        allowedDomains: ['example.com'],
        respectRobotsTxt: false,
        userAgent: 'test-crawler',
      };

      await new BreadthFirstCrawler(options).crawl();

      expect(mockPage.close).toHaveBeenCalled();
    });
  });
});
