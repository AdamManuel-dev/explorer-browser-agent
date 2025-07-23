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
      // TODO: Inject browser agent into crawler
      // const crawlerWithCrawlPage = this.crawler as BreadthFirstCrawler & {
      //   crawlPage: (url: string) => Promise<string[]>;
      // };
      // crawlerWithCrawlPage.crawlPage = async (url: string) => {
      //   await this.browserAgent.navigate(url);
      //   const page = this.browserAgent.getPage();
      //   if (!page) {
      //     throw new Error('Browser page not available');
      //   }
      //   return this.crawler.extractUrls(page, url);
      // };

      return await this.crawler.crawl();
    } finally {
      await this.cleanup();
    }
  }

  async cleanup(): Promise<void> {
    await this.browserAgent.close();
  }
}
