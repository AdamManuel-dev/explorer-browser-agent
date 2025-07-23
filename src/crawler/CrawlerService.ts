import { BrowserAgent } from '../agents/BrowserAgent';
import { BreadthFirstCrawler, CrawlConfiguration, CrawlResult } from './BreadthFirstCrawler';
import { logger } from '../utils/logger';

export class CrawlerService {
  private crawler: BreadthFirstCrawler;
  private browserAgent: BrowserAgent;

  constructor(config: CrawlConfiguration) {
    this.crawler = new BreadthFirstCrawler(config);
    this.browserAgent = new BrowserAgent({
      headless: true,
      userAgent: config.userAgent,
    });
  }

  async initialize(): Promise<void> {
    await this.browserAgent.initialize();
  }

  async crawl(): Promise<CrawlResult> {
    try {
      // Inject browser agent into crawler
      (this.crawler as any).crawlPage = async (url: string) => {
        await this.browserAgent.navigate(url);
        const page = (this.browserAgent as any).page;
        return this.crawler.extractUrls(page, url);
      };

      return await this.crawler.crawl();
    } finally {
      await this.cleanup();
    }
  }

  async cleanup(): Promise<void> {
    await this.browserAgent.close();
  }
}