import { CrawlConfiguration, CrawlResult } from './BreadthFirstCrawler';
export declare class CrawlerService {
    private crawler;
    private browserAgent;
    constructor(config: CrawlConfiguration);
    initialize(): Promise<void>;
    crawl(): Promise<CrawlResult>;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=CrawlerService.d.ts.map