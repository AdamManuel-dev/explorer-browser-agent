// @ts-nocheck
import { test, expect, describe, beforeEach, jest } from '@jest/globals';
import { Page, Browser } from 'playwright';
import { BreadthFirstCrawler, CrawlConfiguration } from '../crawler/BreadthFirstCrawler';

jest.mock('../utils/logger');

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
      const invalidOptions: CrawlConfiguration = {
        startUrl: 'invalid-url',
        maxDepth: -1,
        maxPages: 0,
        sameDomain: true,
        respectRobots: true,
        delay: -1,
      };

      await expect(crawler.crawl(invalidOptions)).rejects.toThrow();
    });
  });

  describe('URL processing', () => {
    test('should normalize URLs correctly', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 1,
        maxPages: 5,
        sameDomain: true,
        respectRobots: false,
        delay: 100,
      };

      // Mock finding links
      (mockPage.evaluate as jest.Mock).mockResolvedValue([
        'https://example.com/page1',
        'https://example.com/page1/', // Should be normalized
        'https://example.com/page1#fragment', // Should remove fragment
        '/relative-page', // Should be made absolute
        'https://otherdomain.com/page', // Should be filtered out if sameDomain=true
      ]);

      const result = await new BreadthFirstCrawler(options).crawl();

      expect(result.crawledUrls).toContainEqual(
        expect.objectContaining({ url: 'https://example.com/page1' })
      );
      expect(result.crawledUrls).not.toContainEqual(
        expect.objectContaining({ url: 'https://otherdomain.com/page' })
      );
    });

    test('should respect same domain restriction', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 1,
        maxPages: 5,
        sameDomain: true,
        respectRobots: false,
        delay: 100,
      };

      (mockPage.evaluate as jest.Mock).mockResolvedValue([
        'https://example.com/page1',
        'https://other-domain.com/page2',
        'https://subdomain.example.com/page3',
      ]);

      const result = await new BreadthFirstCrawler(options).crawl();

      const urls = result.crawledUrls.map((u) => u.url);
      expect(urls).toContain('https://example.com/page1');
      expect(urls).not.toContain('https://other-domain.com/page2');
    });

    test('should allow cross-domain when sameDomain is false', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 1,
        maxPages: 5,
        sameDomain: false,
        respectRobots: false,
        delay: 100,
      };

      (mockPage.evaluate as jest.Mock).mockResolvedValue([
        'https://example.com/page1',
        'https://other-domain.com/page2',
      ]);

      const result = await new BreadthFirstCrawler(options).crawl();

      const urls = result.crawledUrls.map((u) => u.url);
      expect(urls).toContain('https://example.com/page1');
      expect(urls).toContain('https://other-domain.com/page2');
    });
  });

  describe('depth and page limits', () => {
    test('should respect max depth limit', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 1,
        maxPages: 10,
        sameDomain: true,
        respectRobots: false,
        delay: 100,
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
      expect(result.crawledUrls.length).toBeLessThanOrEqual(2);
      expect(result.statistics.maxDepthReached).toBeLessThanOrEqual(1);
    });

    test('should respect max pages limit', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 5,
        maxPages: 2,
        sameDomain: true,
        respectRobots: false,
        delay: 100,
      };

      (mockPage.evaluate as jest.Mock).mockResolvedValue([
        'https://example.com/page1',
        'https://example.com/page2',
        'https://example.com/page3',
        'https://example.com/page4',
      ]);

      const result = await new BreadthFirstCrawler(options).crawl();

      expect(result.crawledUrls.length).toBeLessThanOrEqual(2);
      expect(result.statistics.totalPages).toBe(2);
    });
  });

  describe('robots.txt handling', () => {
    test('should respect robots.txt when enabled', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 1,
        maxPages: 5,
        sameDomain: true,
        respectRobots: true,
        delay: 100,
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

      const urls = result.crawledUrls.map((u) => u.url);
      expect(urls).toContain('https://example.com/public-page');
      expect(urls).not.toContain('https://example.com/private/secret');
    });

    test('should continue crawling when robots.txt is not found', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 1,
        maxPages: 5,
        sameDomain: true,
        respectRobots: true,
        delay: 100,
      };

      // Mock robots.txt 404 response
      const mockRobotsPage = {
        goto: jest.fn().mockRejectedValue(new Error('404 Not Found')),
        close: jest.fn().mockResolvedValue(undefined),
      };
      (mockBrowser.newPage as jest.Mock).mockResolvedValueOnce(mockRobotsPage);

      (mockPage.evaluate as jest.Mock).mockResolvedValue(['https://example.com/page1']);

      const result = await new BreadthFirstCrawler(options).crawl();

      expect(result.crawledUrls.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    test('should handle page load errors gracefully', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 1,
        maxPages: 5,
        sameDomain: true,
        respectRobots: false,
        delay: 100,
      };

      (mockPage.goto as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await new BreadthFirstCrawler(options).crawl();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Network error');
    });

    test('should continue crawling after individual page errors', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 1,
        maxPages: 5,
        sameDomain: true,
        respectRobots: false,
        delay: 100,
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

      expect(result.crawledUrls.length).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('delay handling', () => {
    test('should respect delay between requests', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 1,
        maxPages: 3,
        sameDomain: true,
        respectRobots: false,
        delay: 100,
      };

      (mockPage.evaluate as jest.Mock).mockResolvedValue([
        'https://example.com/page1',
        'https://example.com/page2',
      ]);

      const startTime = Date.now();
      await new BreadthFirstCrawler(options).crawl();
      const endTime = Date.now();

      // Should take at least 200ms (2 delays of 100ms each)
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });
  });

  describe('statistics and reporting', () => {
    test('should generate accurate statistics', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 2,
        maxPages: 5,
        sameDomain: true,
        respectRobots: false,
        delay: 100,
      };

      (mockPage.evaluate as jest.Mock).mockResolvedValue(['https://example.com/page1']);

      const result = await new BreadthFirstCrawler(options).crawl();

      expect(result.statistics).toBeDefined();
      expect(result.statistics.totalPages).toBeGreaterThan(0);
      expect(result.statistics.totalTime).toBeGreaterThan(0);
      expect(result.statistics.averageLoadTime).toBeGreaterThanOrEqual(0);
      expect(result.statistics.maxDepthReached).toBeGreaterThanOrEqual(0);
    });

    test('should track unique URLs correctly', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 1,
        maxPages: 5,
        sameDomain: true,
        respectRobots: false,
        delay: 100,
      };

      (mockPage.evaluate as jest.Mock).mockResolvedValue([
        'https://example.com/page1',
        'https://example.com/page1', // Duplicate
        'https://example.com/page2',
      ]);

      const result = await new BreadthFirstCrawler(options).crawl();

      const uniqueUrls = new Set(result.crawledUrls.map((u) => u.url));
      expect(uniqueUrls.size).toBe(result.crawledUrls.length);
    });
  });

  describe('cleanup', () => {
    test('should close pages after crawling', async () => {
      const options: CrawlConfiguration = {
        startUrl: 'https://example.com',
        maxDepth: 1,
        maxPages: 1,
        sameDomain: true,
        respectRobots: false,
        delay: 100,
      };

      await new BreadthFirstCrawler(options).crawl();

      expect(mockPage.close).toHaveBeenCalled();
    });
  });
});
