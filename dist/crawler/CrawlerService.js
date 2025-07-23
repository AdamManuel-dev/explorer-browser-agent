"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrawlerService = void 0;
const BrowserAgent_1 = require("../agents/BrowserAgent");
const BreadthFirstCrawler_1 = require("./BreadthFirstCrawler");
class CrawlerService {
    crawler;
    browserAgent;
    constructor(config) {
        this.crawler = new BreadthFirstCrawler_1.BreadthFirstCrawler(config);
        this.browserAgent = new BrowserAgent_1.BrowserAgent({
            headless: true,
            userAgent: config.userAgent,
        });
    }
    async initialize() {
        await this.browserAgent.initialize();
    }
    async crawl() {
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
        }
        finally {
            await this.cleanup();
        }
    }
    async cleanup() {
        await this.browserAgent.close();
    }
}
exports.CrawlerService = CrawlerService;
//# sourceMappingURL=CrawlerService.js.map