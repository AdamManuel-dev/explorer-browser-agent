import { BrowserAgent } from '../agents/BrowserAgent';
import { BreadthFirstCrawler, CrawlConfiguration, CrawlResult } from './BreadthFirstCrawler';

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
      // Initialize the browser agent
      await this.browserAgent.initialize();
      
      // Inject browser agent into crawler
      this.crawler.setBrowserAgent(this.browserAgent);
      
      // Start crawling
      return await this.crawler.crawl();
    } finally {
      await this.cleanup();
    }
  }

  async cleanup(): Promise<void> {
    await this.browserAgent.close();
  }
}
