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
            // Inject browser agent into crawler
            this.crawler.crawlPage = async (url) => {
                await this.browserAgent.navigate(url);
                const page = this.browserAgent.page;
                return this.crawler.extractUrls(page, url);
            };
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