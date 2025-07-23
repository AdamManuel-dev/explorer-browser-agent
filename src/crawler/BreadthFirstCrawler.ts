import { Page } from 'playwright';
import PQueue from 'p-queue';
import normalizeUrl from 'normalize-url';
import robotsParser from 'robots-parser';
import { URL } from 'url';
import { logger } from '../utils/logger';

export interface CrawlNode {
  url: string;
  depth: number;
  parentUrl?: string;
  discoveredAt: Date;
}

export interface CrawlConfiguration {
  startUrl: string;
  maxDepth: number;
  maxPages: number;
  crawlDelay: number;
  allowedDomains: string[];
  respectRobotsTxt: boolean;
  userAgent: string;
  customHeaders?: Record<string, string>;
  parallelWorkers?: number;
}

export interface CrawlResult {
  pagesVisited: number;
  urls: string[];
  errors: CrawlError[];
  duration: number;
  crawlTree: Map<string, CrawlNode[]>;
}

export interface CrawlError {
  url: string;
  error: string;
  timestamp: Date;
}

export interface CrawlOptions {
  startUrl: string;
  maxDepth: number;
  maxPages: number;
  crawlDelay: number;
  allowedDomains: string[];
  respectRobotsTxt: boolean;
  userAgent: string;
  customHeaders?: Record<string, string>;
  parallelWorkers?: number;
}

export class BreadthFirstCrawler {
  private queue: CrawlNode[] = [];

  private visited: Set<string> = new Set();

  private robotsCache: Map<string, ReturnType<typeof robotsParser>> = new Map();

  private crawlResult: CrawlResult;

  private pQueue: PQueue;

  private startTime: number = 0;

  constructor(private config: CrawlConfiguration) {
    this.crawlResult = {
      pagesVisited: 0,
      urls: [],
      errors: [],
      duration: 0,
      crawlTree: new Map(),
    };

    this.pQueue = new PQueue({
      concurrency: config.parallelWorkers || 5,
      interval: config.crawlDelay,
      intervalCap: 1,
    });
  }

  async crawl(): Promise<CrawlResult> {
    this.startTime = Date.now();

    const normalizedStartUrl = this.normalizeUrl(this.config.startUrl);
    const startNode: CrawlNode = {
      url: normalizedStartUrl,
      depth: 0,
      discoveredAt: new Date(),
    };

    this.queue.push(startNode);
    logger.info('Starting BFS crawl', { startUrl: normalizedStartUrl, config: this.config });

    while (this.queue.length > 0 && this.crawlResult.pagesVisited < this.config.maxPages) {
      const currentDepthNodes = this.getNodesAtCurrentDepth();

      if (currentDepthNodes.length === 0) {
        break;
      }

      await this.processNodesInParallel(currentDepthNodes);
    }

    await this.pQueue.onIdle();

    this.crawlResult.duration = Date.now() - this.startTime;
    logger.info('Crawl completed', {
      pagesVisited: this.crawlResult.pagesVisited,
      duration: this.crawlResult.duration,
    });

    return this.crawlResult;
  }

  private getNodesAtCurrentDepth(): CrawlNode[] {
    const nodes: CrawlNode[] = [];
    const currentDepth = this.queue[0]?.depth;

    while (this.queue.length > 0 && this.queue[0]?.depth === currentDepth) {
      const node = this.queue.shift()!;

      if (!this.visited.has(node.url) && this.crawlResult.pagesVisited < this.config.maxPages) {
        nodes.push(node);
      }
    }

    return nodes;
  }

  private async processNodesInParallel(nodes: CrawlNode[]): Promise<void> {
    const promises = nodes.map((node) => this.pQueue.add(() => this.processNode(node)));

    await Promise.all(promises);
  }

  private async processNode(node: CrawlNode): Promise<void> {
    if (this.visited.has(node.url) || this.crawlResult.pagesVisited >= this.config.maxPages) {
      return;
    }

    this.visited.add(node.url);

    try {
      if (this.config.respectRobotsTxt && !(await this.canCrawl(node.url))) {
        logger.info('Skipping URL due to robots.txt', { url: node.url });
        return;
      }

      logger.info('Crawling URL', { url: node.url, depth: node.depth });

      const childUrls = await this.crawlPage(node.url);

      this.crawlResult.pagesVisited++;
      this.crawlResult.urls.push(node.url);

      if (!this.crawlResult.crawlTree.has(node.url)) {
        this.crawlResult.crawlTree.set(node.url, []);
      }

      if (node.depth < this.config.maxDepth) {
        const childNodes = childUrls.map((url) => ({
          url,
          depth: node.depth + 1,
          parentUrl: node.url,
          discoveredAt: new Date(),
        }));

        this.crawlResult.crawlTree.get(node.url)!.push(...childNodes);
        this.queue.push(...childNodes);
      }
    } catch (error) {
      logger.error('Error crawling page', { url: node.url, error });
      this.crawlResult.errors.push({
        url: node.url,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      });
    }
  }

  private async crawlPage(_url: string): Promise<string[]> {
    // This is a placeholder - will be implemented with actual page crawling
    // Will be integrated with BrowserAgent
    return [];
  }

  private normalizeUrl(url: string): string {
    try {
      return normalizeUrl(url, {
        stripHash: true,
        stripWWW: true,
        removeTrailingSlash: true,
        sortQueryParameters: true,
      });
    } catch (error) {
      logger.warn('Failed to normalize URL', { url, error });
      return url;
    }
  }

  private async canCrawl(url: string): Promise<boolean> {
    try {
      const urlObj = new URL(url);
      const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;

      if (!this.robotsCache.has(robotsUrl)) {
        const response = await fetch(robotsUrl);
        const robotsTxt = await response.text();
        const robots = robotsParser(robotsUrl, robotsTxt);
        this.robotsCache.set(robotsUrl, robots);
      }

      const robots = this.robotsCache.get(robotsUrl);
      return robots ? robots.isAllowed(url, this.config.userAgent) : true;
    } catch (error) {
      logger.warn('Failed to check robots.txt', { url, error });
      return true;
    }
  }

  private isAllowedDomain(url: string): boolean {
    if (this.config.allowedDomains.length === 0) {
      return true;
    }

    try {
      const urlObj = new URL(url);
      return this.config.allowedDomains.some(
        (domain) => urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  }

  async extractUrls(page: Page, _baseUrl: string): Promise<string[]> {
    const urls = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      return anchors
        .map((anchor) => (anchor as HTMLAnchorElement).href)
        .filter((href) => {
          if (!href || href.startsWith('#')) return false;
          // Filter out JavaScript protocol URLs
          const lowerHref = href.toLowerCase();
          // eslint-disable-next-line no-script-url
          return !lowerHref.startsWith('javascript:') && !lowerHref.startsWith('vbscript:');
        });
    });

    return urls
      .map((url) => this.normalizeUrl(url))
      .filter((url) => this.isValidUrl(url) && this.isAllowedDomain(url))
      .filter((url, index, self) => self.indexOf(url) === index);
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return !!parsedUrl;
    } catch {
      return false;
    }
  }
}
