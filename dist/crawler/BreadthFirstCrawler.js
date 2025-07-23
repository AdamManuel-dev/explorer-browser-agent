"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BreadthFirstCrawler = void 0;
const p_queue_1 = __importDefault(require("p-queue"));
const normalize_url_1 = __importDefault(require("normalize-url"));
const robots_parser_1 = __importDefault(require("robots-parser"));
const url_1 = require("url");
const logger_1 = require("../utils/logger");
class BreadthFirstCrawler {
    config;
    queue = [];
    visited = new Set();
    robotsCache = new Map();
    crawlResult;
    pQueue;
    startTime = 0;
    constructor(config) {
        this.config = config;
        this.crawlResult = {
            pagesVisited: 0,
            urls: [],
            errors: [],
            duration: 0,
            crawlTree: new Map(),
        };
        this.pQueue = new p_queue_1.default({
            concurrency: config.parallelWorkers || 5,
            interval: config.crawlDelay,
            intervalCap: 1,
        });
    }
    async crawl() {
        this.startTime = Date.now();
        const normalizedStartUrl = this.normalizeUrl(this.config.startUrl);
        const startNode = {
            url: normalizedStartUrl,
            depth: 0,
            discoveredAt: new Date(),
        };
        this.queue.push(startNode);
        logger_1.logger.info('Starting BFS crawl', { startUrl: normalizedStartUrl, config: this.config });
        while (this.queue.length > 0 && this.crawlResult.pagesVisited < this.config.maxPages) {
            const currentDepthNodes = this.getNodesAtCurrentDepth();
            if (currentDepthNodes.length === 0) {
                break;
            }
            await this.processNodesInParallel(currentDepthNodes);
        }
        await this.pQueue.onIdle();
        this.crawlResult.duration = Date.now() - this.startTime;
        logger_1.logger.info('Crawl completed', {
            pagesVisited: this.crawlResult.pagesVisited,
            duration: this.crawlResult.duration,
        });
        return this.crawlResult;
    }
    getNodesAtCurrentDepth() {
        const nodes = [];
        const currentDepth = this.queue[0]?.depth;
        while (this.queue.length > 0 && this.queue[0].depth === currentDepth) {
            const node = this.queue.shift();
            if (!this.visited.has(node.url) && this.crawlResult.pagesVisited < this.config.maxPages) {
                nodes.push(node);
            }
        }
        return nodes;
    }
    async processNodesInParallel(nodes) {
        const promises = nodes.map(node => this.pQueue.add(() => this.processNode(node)));
        await Promise.all(promises);
    }
    async processNode(node) {
        if (this.visited.has(node.url) || this.crawlResult.pagesVisited >= this.config.maxPages) {
            return;
        }
        this.visited.add(node.url);
        try {
            if (this.config.respectRobotsTxt && !(await this.canCrawl(node.url))) {
                logger_1.logger.info('Skipping URL due to robots.txt', { url: node.url });
                return;
            }
            logger_1.logger.info('Crawling URL', { url: node.url, depth: node.depth });
            const childUrls = await this.crawlPage(node.url);
            this.crawlResult.pagesVisited++;
            this.crawlResult.urls.push(node.url);
            if (!this.crawlResult.crawlTree.has(node.url)) {
                this.crawlResult.crawlTree.set(node.url, []);
            }
            if (node.depth < this.config.maxDepth) {
                const childNodes = childUrls.map(url => ({
                    url,
                    depth: node.depth + 1,
                    parentUrl: node.url,
                    discoveredAt: new Date(),
                }));
                this.crawlResult.crawlTree.get(node.url).push(...childNodes);
                this.queue.push(...childNodes);
            }
        }
        catch (error) {
            logger_1.logger.error('Error crawling page', { url: node.url, error });
            this.crawlResult.errors.push({
                url: node.url,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date(),
            });
        }
    }
    async crawlPage(url) {
        // This is a placeholder - will be implemented with actual page crawling
        // Will be integrated with BrowserAgent
        return [];
    }
    normalizeUrl(url) {
        try {
            return (0, normalize_url_1.default)(url, {
                stripHash: true,
                stripWWW: true,
                removeTrailingSlash: true,
                sortQueryParameters: true,
            });
        }
        catch (error) {
            logger_1.logger.warn('Failed to normalize URL', { url, error });
            return url;
        }
    }
    async canCrawl(url) {
        try {
            const urlObj = new url_1.URL(url);
            const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
            if (!this.robotsCache.has(robotsUrl)) {
                const response = await fetch(robotsUrl);
                const robotsTxt = await response.text();
                const robots = (0, robots_parser_1.default)(robotsUrl, robotsTxt);
                this.robotsCache.set(robotsUrl, robots);
            }
            const robots = this.robotsCache.get(robotsUrl);
            return robots.isAllowed(url, this.config.userAgent);
        }
        catch (error) {
            logger_1.logger.warn('Failed to check robots.txt', { url, error });
            return true;
        }
    }
    isAllowedDomain(url) {
        if (this.config.allowedDomains.length === 0) {
            return true;
        }
        try {
            const urlObj = new url_1.URL(url);
            return this.config.allowedDomains.some(domain => urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`));
        }
        catch {
            return false;
        }
    }
    async extractUrls(page, baseUrl) {
        const urls = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a[href]'));
            return anchors
                .map(anchor => anchor.href)
                .filter(href => href && !href.startsWith('javascript:') && !href.startsWith('#'));
        });
        return urls
            .map(url => this.normalizeUrl(url))
            .filter(url => this.isValidUrl(url) && this.isAllowedDomain(url))
            .filter((url, index, self) => self.indexOf(url) === index);
    }
    isValidUrl(url) {
        try {
            new url_1.URL(url);
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.BreadthFirstCrawler = BreadthFirstCrawler;
//# sourceMappingURL=BreadthFirstCrawler.js.map