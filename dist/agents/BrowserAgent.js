"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserAgent = void 0;
const playwright_1 = require("playwright");
const logger_1 = require("../utils/logger");
class BrowserAgent {
    browser = null;
    context = null;
    page = null;
    config;
    constructor(config = {}) {
        this.config = {
            headless: true,
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ...config,
        };
    }
    async initialize() {
        try {
            this.browser = await playwright_1.chromium.launch({
                headless: this.config.headless,
            });
            this.context = await this.browser.newContext({
                viewport: this.config.viewport,
                userAgent: this.config.userAgent,
            });
            this.page = await this.context.newPage();
            logger_1.logger.info('Browser agent initialized');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize browser', error);
            throw error;
        }
    }
    async navigate(url) {
        if (!this.page) {
            throw new Error('Browser not initialized');
        }
        try {
            await this.page.goto(url, { waitUntil: 'networkidle' });
            logger_1.logger.info('Navigated to URL', { url });
        }
        catch (error) {
            logger_1.logger.error('Navigation failed', { url, error });
            throw error;
        }
    }
    async extractContent() {
        if (!this.page) {
            throw new Error('Browser not initialized');
        }
        try {
            const content = await this.page.evaluate(() => document.body.innerText);
            return content;
        }
        catch (error) {
            logger_1.logger.error('Content extraction failed', error);
            throw error;
        }
    }
    async screenshot(path) {
        if (!this.page) {
            throw new Error('Browser not initialized');
        }
        await this.page.screenshot({ path });
        logger_1.logger.info('Screenshot saved', { path });
    }
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.context = null;
            this.page = null;
            logger_1.logger.info('Browser agent closed');
        }
    }
}
exports.BrowserAgent = BrowserAgent;
//# sourceMappingURL=BrowserAgent.js.map