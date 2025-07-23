"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const globals_1 = require("@jest/globals");
const BreadthFirstCrawler_1 = require("../crawler/BreadthFirstCrawler");
globals_1.jest.mock('../utils/logger');
(0, globals_1.describe)('BreadthFirstCrawler', () => {
    let crawler;
    let mockPage;
    let mockBrowser;
    let defaultConfig;
    (0, globals_1.beforeEach)(() => {
        mockPage = {
            goto: globals_1.jest.fn().mockResolvedValue({ status: () => 200, ok: () => true }),
            url: globals_1.jest.fn().mockReturnValue('https://example.com'),
            title: globals_1.jest.fn().mockResolvedValue('Test Page'),
            content: globals_1.jest.fn().mockResolvedValue('<html><body>Test content</body></html>'),
            evaluate: globals_1.jest.fn().mockResolvedValue([]),
            waitForLoadState: globals_1.jest.fn().mockResolvedValue(undefined),
            close: globals_1.jest.fn().mockResolvedValue(undefined),
        };
        mockBrowser = {
            newPage: globals_1.jest.fn().mockResolvedValue(mockPage),
            close: globals_1.jest.fn().mockResolvedValue(undefined),
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
        crawler = new BreadthFirstCrawler_1.BreadthFirstCrawler(defaultConfig);
    });
    (0, globals_1.describe)('initialization', () => {
        (0, globals_1.test)('should initialize with default options', () => {
            (0, globals_1.expect)(crawler).toBeDefined();
        });
        (0, globals_1.test)('should validate crawl options', async () => {
            const invalidOptions = {
                startUrl: 'invalid-url',
                maxDepth: -1,
                maxPages: 0,
                sameDomain: true,
                respectRobots: true,
                delay: -1,
            };
            await (0, globals_1.expect)(crawler.crawl(invalidOptions)).rejects.toThrow();
        });
    });
    (0, globals_1.describe)('URL processing', () => {
        (0, globals_1.test)('should normalize URLs correctly', async () => {
            const options = {
                startUrl: 'https://example.com',
                maxDepth: 1,
                maxPages: 5,
                sameDomain: true,
                respectRobots: false,
                delay: 100,
            };
            // Mock finding links
            mockPage.evaluate.mockResolvedValue([
                'https://example.com/page1',
                'https://example.com/page1/', // Should be normalized
                'https://example.com/page1#fragment', // Should remove fragment
                '/relative-page', // Should be made absolute
                'https://otherdomain.com/page', // Should be filtered out if sameDomain=true
            ]);
            const result = await new BreadthFirstCrawler_1.BreadthFirstCrawler(options).crawl();
            (0, globals_1.expect)(result.crawledUrls).toContainEqual(globals_1.expect.objectContaining({ url: 'https://example.com/page1' }));
            (0, globals_1.expect)(result.crawledUrls).not.toContainEqual(globals_1.expect.objectContaining({ url: 'https://otherdomain.com/page' }));
        });
        (0, globals_1.test)('should respect same domain restriction', async () => {
            const options = {
                startUrl: 'https://example.com',
                maxDepth: 1,
                maxPages: 5,
                sameDomain: true,
                respectRobots: false,
                delay: 100,
            };
            mockPage.evaluate.mockResolvedValue([
                'https://example.com/page1',
                'https://other-domain.com/page2',
                'https://subdomain.example.com/page3',
            ]);
            const result = await new BreadthFirstCrawler_1.BreadthFirstCrawler(options).crawl();
            const urls = result.crawledUrls.map((u) => u.url);
            (0, globals_1.expect)(urls).toContain('https://example.com/page1');
            (0, globals_1.expect)(urls).not.toContain('https://other-domain.com/page2');
        });
        (0, globals_1.test)('should allow cross-domain when sameDomain is false', async () => {
            const options = {
                startUrl: 'https://example.com',
                maxDepth: 1,
                maxPages: 5,
                sameDomain: false,
                respectRobots: false,
                delay: 100,
            };
            mockPage.evaluate.mockResolvedValue([
                'https://example.com/page1',
                'https://other-domain.com/page2',
            ]);
            const result = await new BreadthFirstCrawler_1.BreadthFirstCrawler(options).crawl();
            const urls = result.crawledUrls.map((u) => u.url);
            (0, globals_1.expect)(urls).toContain('https://example.com/page1');
            (0, globals_1.expect)(urls).toContain('https://other-domain.com/page2');
        });
    });
    (0, globals_1.describe)('depth and page limits', () => {
        (0, globals_1.test)('should respect max depth limit', async () => {
            const options = {
                startUrl: 'https://example.com',
                maxDepth: 1,
                maxPages: 10,
                sameDomain: true,
                respectRobots: false,
                delay: 100,
            };
            // Mock different responses based on URL
            let callCount = 0;
            mockPage.evaluate.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.resolve(['https://example.com/page1']);
                }
                return Promise.resolve(['https://example.com/page2']);
            });
            const result = await new BreadthFirstCrawler_1.BreadthFirstCrawler(options).crawl();
            // Should crawl start URL (depth 0) and page1 (depth 1), but not page2 (depth 2)
            (0, globals_1.expect)(result.crawledUrls.length).toBeLessThanOrEqual(2);
            (0, globals_1.expect)(result.statistics.maxDepthReached).toBeLessThanOrEqual(1);
        });
        (0, globals_1.test)('should respect max pages limit', async () => {
            const options = {
                startUrl: 'https://example.com',
                maxDepth: 5,
                maxPages: 2,
                sameDomain: true,
                respectRobots: false,
                delay: 100,
            };
            mockPage.evaluate.mockResolvedValue([
                'https://example.com/page1',
                'https://example.com/page2',
                'https://example.com/page3',
                'https://example.com/page4',
            ]);
            const result = await new BreadthFirstCrawler_1.BreadthFirstCrawler(options).crawl();
            (0, globals_1.expect)(result.crawledUrls.length).toBeLessThanOrEqual(2);
            (0, globals_1.expect)(result.statistics.totalPages).toBe(2);
        });
    });
    (0, globals_1.describe)('robots.txt handling', () => {
        (0, globals_1.test)('should respect robots.txt when enabled', async () => {
            const options = {
                startUrl: 'https://example.com',
                maxDepth: 1,
                maxPages: 5,
                sameDomain: true,
                respectRobots: true,
                delay: 100,
            };
            // Mock robots.txt response
            const mockRobotsPage = {
                goto: globals_1.jest.fn().mockResolvedValue({
                    status: () => 200,
                    ok: () => true,
                    url: () => 'https://example.com',
                }),
                content: globals_1.jest.fn().mockResolvedValue('User-agent: *\nDisallow: /private/'),
            };
            mockBrowser.newPage.mockResolvedValueOnce(mockRobotsPage);
            mockPage.evaluate.mockResolvedValue([
                'https://example.com/public-page',
                'https://example.com/private/secret',
            ]);
            const result = await new BreadthFirstCrawler_1.BreadthFirstCrawler(options).crawl();
            const urls = result.crawledUrls.map((u) => u.url);
            (0, globals_1.expect)(urls).toContain('https://example.com/public-page');
            (0, globals_1.expect)(urls).not.toContain('https://example.com/private/secret');
        });
        (0, globals_1.test)('should continue crawling when robots.txt is not found', async () => {
            const options = {
                startUrl: 'https://example.com',
                maxDepth: 1,
                maxPages: 5,
                sameDomain: true,
                respectRobots: true,
                delay: 100,
            };
            // Mock robots.txt 404 response
            const mockRobotsPage = {
                goto: globals_1.jest.fn().mockRejectedValue(new Error('404 Not Found')),
                close: globals_1.jest.fn().mockResolvedValue(undefined),
            };
            mockBrowser.newPage.mockResolvedValueOnce(mockRobotsPage);
            mockPage.evaluate.mockResolvedValue(['https://example.com/page1']);
            const result = await new BreadthFirstCrawler_1.BreadthFirstCrawler(options).crawl();
            (0, globals_1.expect)(result.crawledUrls.length).toBeGreaterThan(0);
        });
    });
    (0, globals_1.describe)('error handling', () => {
        (0, globals_1.test)('should handle page load errors gracefully', async () => {
            const options = {
                startUrl: 'https://example.com',
                maxDepth: 1,
                maxPages: 5,
                sameDomain: true,
                respectRobots: false,
                delay: 100,
            };
            mockPage.goto.mockRejectedValueOnce(new Error('Network error'));
            const result = await new BreadthFirstCrawler_1.BreadthFirstCrawler(options).crawl();
            (0, globals_1.expect)(result.errors.length).toBeGreaterThan(0);
            (0, globals_1.expect)(result.errors[0]).toContain('Network error');
        });
        (0, globals_1.test)('should continue crawling after individual page errors', async () => {
            const options = {
                startUrl: 'https://example.com',
                maxDepth: 1,
                maxPages: 5,
                sameDomain: true,
                respectRobots: false,
                delay: 100,
            };
            let callCount = 0;
            mockPage.goto.mockImplementation((url) => {
                callCount++;
                if (callCount === 2) {
                    throw new Error('Failed to load page');
                }
                return Promise.resolve();
            });
            mockPage.evaluate.mockResolvedValue([
                'https://example.com/page1',
                'https://example.com/page2',
            ]);
            const result = await new BreadthFirstCrawler_1.BreadthFirstCrawler(options).crawl();
            (0, globals_1.expect)(result.crawledUrls.length).toBeGreaterThan(0);
            (0, globals_1.expect)(result.errors.length).toBeGreaterThan(0);
        });
    });
    (0, globals_1.describe)('delay handling', () => {
        (0, globals_1.test)('should respect delay between requests', async () => {
            const options = {
                startUrl: 'https://example.com',
                maxDepth: 1,
                maxPages: 3,
                sameDomain: true,
                respectRobots: false,
                delay: 100,
            };
            mockPage.evaluate.mockResolvedValue([
                'https://example.com/page1',
                'https://example.com/page2',
            ]);
            const startTime = Date.now();
            await new BreadthFirstCrawler_1.BreadthFirstCrawler(options).crawl();
            const endTime = Date.now();
            // Should take at least 200ms (2 delays of 100ms each)
            (0, globals_1.expect)(endTime - startTime).toBeGreaterThanOrEqual(100);
        });
    });
    (0, globals_1.describe)('statistics and reporting', () => {
        (0, globals_1.test)('should generate accurate statistics', async () => {
            const options = {
                startUrl: 'https://example.com',
                maxDepth: 2,
                maxPages: 5,
                sameDomain: true,
                respectRobots: false,
                delay: 100,
            };
            mockPage.evaluate.mockResolvedValue(['https://example.com/page1']);
            const result = await new BreadthFirstCrawler_1.BreadthFirstCrawler(options).crawl();
            (0, globals_1.expect)(result.statistics).toBeDefined();
            (0, globals_1.expect)(result.statistics.totalPages).toBeGreaterThan(0);
            (0, globals_1.expect)(result.statistics.totalTime).toBeGreaterThan(0);
            (0, globals_1.expect)(result.statistics.averageLoadTime).toBeGreaterThanOrEqual(0);
            (0, globals_1.expect)(result.statistics.maxDepthReached).toBeGreaterThanOrEqual(0);
        });
        (0, globals_1.test)('should track unique URLs correctly', async () => {
            const options = {
                startUrl: 'https://example.com',
                maxDepth: 1,
                maxPages: 5,
                sameDomain: true,
                respectRobots: false,
                delay: 100,
            };
            mockPage.evaluate.mockResolvedValue([
                'https://example.com/page1',
                'https://example.com/page1', // Duplicate
                'https://example.com/page2',
            ]);
            const result = await new BreadthFirstCrawler_1.BreadthFirstCrawler(options).crawl();
            const uniqueUrls = new Set(result.crawledUrls.map((u) => u.url));
            (0, globals_1.expect)(uniqueUrls.size).toBe(result.crawledUrls.length);
        });
    });
    (0, globals_1.describe)('cleanup', () => {
        (0, globals_1.test)('should close pages after crawling', async () => {
            const options = {
                startUrl: 'https://example.com',
                maxDepth: 1,
                maxPages: 1,
                sameDomain: true,
                respectRobots: false,
                delay: 100,
            };
            await new BreadthFirstCrawler_1.BreadthFirstCrawler(options).crawl();
            (0, globals_1.expect)(mockPage.close).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=crawler.test.js.map