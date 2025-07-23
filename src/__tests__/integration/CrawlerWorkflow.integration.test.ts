import { chromium, Browser } from 'playwright';
import { BreadthFirstCrawler } from '../../crawler/BreadthFirstCrawler';
import { ResilientCrawler } from '../../crawler/ResilientCrawler';
// import { DistributedCrawler } from '../../crawler/DistributedCrawler';
import { AIElementDetector } from '../../detectors/AIElementDetector';
import { InteractionExecutor } from '../../interactions/InteractionExecutor';
import { UserPathRecorder } from '../../recording/UserPathRecorder';
import { TestGenerator } from '../../generation/TestGenerator';
import { MonitoringService } from '../../monitoring/MonitoringService';
// import { SessionManager } from '../../auth/SessionManager';
import { StealthMode } from '../../stealth/StealthMode';
import { logger } from '../../utils/logger';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdirSync, rmSync } from 'fs';
import type { Request, Response } from 'express';
import type { Server } from 'http';

describe('Crawler Workflow Integration Tests', () => {
  let browser: Browser;
  let testOutputDir: string;
  let testPort: number;
  let testServer: Server | null;

  // Helper method to generate test data
  function generateTestData(selector: string): string {
    const dataMap: Record<string, string> = {
      'first-name': 'John',
      'last-name': 'Doe',
      email: 'john.doe@example.com',
      address: '123 Main St',
      city: 'Anytown',
      'zip-code': '12345',
      'card-number': '4111111111111111',
      'expiry-date': '12/25',
      cvv: '123',
    };

    for (const [key, value] of Object.entries(dataMap)) {
      if (selector.includes(key)) {
        return value;
      }
    }

    return 'test-value';
  }

  beforeAll(async () => {
    // Create temporary directory
    const tempDir = join(tmpdir(), 'crawler-workflow-test');
    testOutputDir = join(tempDir, 'output');
    mkdirSync(testOutputDir, { recursive: true });

    // Start Playwright browser
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });

    testPort = 3002;
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }

    if (testServer) {
      testServer.close();
    }

    // Clean up temporary files
    try {
      rmSync(join(tmpdir(), 'crawler-workflow-test'), { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Start complex test server
    const express = require('express');
    const app = express();

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Complex multi-page application
    app.get('/', (_req: Request, res: Response) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>E-commerce Test Site</title>
          <style>
            .product { margin: 10px; padding: 10px; border: 1px solid #ccc; }
            .hidden { display: none; }
          </style>
        </head>
        <body>
          <header>
            <nav>
              <a href="/products" data-testid="products-link">Products</a>
              <a href="/cart" data-testid="cart-link">Cart</a>
              <a href="/account" data-testid="account-link">Account</a>
            </nav>
          </header>
          <main>
            <h1>Welcome to Test E-commerce</h1>
            <div class="hero">
              <button onclick="showSpecialOffer()" data-testid="special-offer-btn">Special Offer</button>
              <div id="special-offer" class="hidden">
                <p>50% off all items!</p>
                <form action="/subscribe" method="post">
                  <input type="email" name="email" placeholder="Enter email" required>
                  <button type="submit" data-testid="subscribe-btn">Subscribe</button>
                </form>
              </div>
            </div>
            <div class="featured-products">
              <h2>Featured Products</h2>
              <div class="product">
                <h3>Product 1</h3>
                <p>Price: $99.99</p>
                <button onclick="addToCart(1)" data-testid="add-to-cart-1">Add to Cart</button>
              </div>
              <div class="product">
                <h3>Product 2</h3>
                <p>Price: $149.99</p>
                <button onclick="addToCart(2)" data-testid="add-to-cart-2">Add to Cart</button>
              </div>
            </div>
          </main>
          <script>
            function showSpecialOffer() {
              document.getElementById('special-offer').classList.remove('hidden');
            }
            function addToCart(productId) {
              alert('Added product ' + productId + ' to cart');
              fetch('/api/cart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId, quantity: 1 })
              });
            }
          </script>
        </body>
        </html>
      `);
    });

    app.get('/products', (req: Request, res: Response) => {
      const page = parseInt(req.query.page as string) || 1;
      const category = req.query.category || 'all';

      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Products - Page ${page}</title></head>
        <body>
          <nav>
            <a href="/" data-testid="home-link">Home</a>
            <a href="/cart" data-testid="cart-link">Cart</a>
          </nav>
          <h1>Products - ${category} (Page ${page})</h1>
          <div class="filters">
            <select onchange="filterByCategory(this.value)" data-testid="category-filter">
              <option value="all">All Categories</option>
              <option value="electronics">Electronics</option>
              <option value="clothing">Clothing</option>
              <option value="books">Books</option>
            </select>
            <input type="text" placeholder="Search products..." data-testid="search-input">
            <button onclick="searchProducts()" data-testid="search-btn">Search</button>
          </div>
          <div class="products-grid">
            ${[1, 2, 3, 4, 5]
              .map(
                (i) => `
              <div class="product" data-testid="product-${i}">
                <h3>Product ${i + (page - 1) * 5}</h3>
                <p>Category: ${category === 'all' ? 'Mixed' : category}</p>
                <p>Price: $${(99 + i * 50).toFixed(2)}</p>
                <a href="/product/${i + (page - 1) * 5}" data-testid="view-product-${i}">View Details</a>
                <button onclick="addToCart(${i + (page - 1) * 5})" data-testid="add-cart-${i}">Add to Cart</button>
              </div>
            `
              )
              .join('')}
          </div>
          <div class="pagination">
            ${page > 1 ? `<a href="/products?page=${page - 1}&category=${category}" data-testid="prev-page">Previous</a>` : ''}
            <span>Page ${page}</span>
            <a href="/products?page=${page + 1}&category=${category}" data-testid="next-page">Next</a>
          </div>
          <script>
            function filterByCategory(category) {
              window.location.href = '/products?category=' + category;
            }
            function searchProducts() {
              const query = document.querySelector('[data-testid="search-input"]').value;
              window.location.href = '/products?search=' + encodeURIComponent(query);
            }
            function addToCart(productId) {
              fetch('/api/cart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId, quantity: 1 })
              }).then(() => alert('Added to cart'));
            }
          </script>
        </body>
        </html>
      `);
    });

    app.get('/product/:id', (req: Request, res: Response) => {
      const productId = req.params.id;
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Product ${productId} Details</title></head>
        <body>
          <nav>
            <a href="/" data-testid="home-link">Home</a>
            <a href="/products" data-testid="products-link">Back to Products</a>
            <a href="/cart" data-testid="cart-link">Cart</a>
          </nav>
          <div class="product-details">
            <h1>Product ${productId}</h1>
            <img src="/images/product-${productId}.jpg" alt="Product ${productId}" data-testid="product-image">
            <div class="product-info">
              <p class="price">Price: $${(99 + parseInt(productId || '0') * 50).toFixed(2)}</p>
              <p class="description">High-quality product with excellent features.</p>
              <div class="options">
                <label>Quantity:</label>
                <select data-testid="quantity-select">
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
                <label>Color:</label>
                <select data-testid="color-select">
                  <option value="red">Red</option>
                  <option value="blue">Blue</option>
                  <option value="green">Green</option>
                </select>
              </div>
              <button onclick="addToCart()" data-testid="add-to-cart">Add to Cart</button>
              <button onclick="buyNow()" data-testid="buy-now">Buy Now</button>
            </div>
            <div class="reviews">
              <h3>Customer Reviews</h3>
              <div class="review">
                <p>Great product! - ⭐⭐⭐⭐⭐</p>
              </div>
              <form class="review-form" action="/api/reviews" method="post">
                <input type="hidden" name="productId" value="${productId}">
                <textarea name="review" placeholder="Write your review..." data-testid="review-text"></textarea>
                <select name="rating" data-testid="rating-select">
                  <option value="5">⭐⭐⭐⭐⭐</option>
                  <option value="4">⭐⭐⭐⭐</option>
                  <option value="3">⭐⭐⭐</option>
                  <option value="2">⭐⭐</option>
                  <option value="1">⭐</option>
                </select>
                <button type="submit" data-testid="submit-review">Submit Review</button>
              </form>
            </div>
          </div>
          <script>
            function addToCart() {
              const quantity = document.querySelector('[data-testid="quantity-select"]').value;
              const color = document.querySelector('[data-testid="color-select"]').value;
              fetch('/api/cart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId: ${productId}, quantity: parseInt(quantity), options: { color } })
              }).then(() => alert('Added to cart'));
            }
            function buyNow() {
              addToCart();
              window.location.href = '/cart';
            }
          </script>
        </body>
        </html>
      `);
    });

    app.get('/cart', (_req: Request, res: Response) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Shopping Cart</title></head>
        <body>
          <nav>
            <a href="/" data-testid="home-link">Home</a>
            <a href="/products" data-testid="continue-shopping">Continue Shopping</a>
          </nav>
          <h1>Shopping Cart</h1>
          <div id="cart-items">
            <div class="cart-item" data-testid="cart-item-1">
              <span>Product 1 - $99.99</span>
              <button onclick="removeItem(1)" data-testid="remove-item-1">Remove</button>
            </div>
          </div>
          <div class="cart-summary">
            <p>Total: $99.99</p>
            <button onclick="proceedToCheckout()" data-testid="checkout-btn">Proceed to Checkout</button>
          </div>
          <script>
            function removeItem(itemId) {
              document.querySelector('[data-testid="cart-item-' + itemId + '"]').remove();
            }
            function proceedToCheckout() {
              window.location.href = '/checkout';
            }
          </script>
        </body>
        </html>
      `);
    });

    app.get('/checkout', (_req: Request, res: Response) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Checkout</title></head>
        <body>
          <h1>Checkout</h1>
          <form id="checkout-form" action="/order" method="post">
            <div class="billing-info">
              <h3>Billing Information</h3>
              <input type="text" name="firstName" placeholder="First Name" required data-testid="first-name">
              <input type="text" name="lastName" placeholder="Last Name" required data-testid="last-name">
              <input type="email" name="email" placeholder="Email" required data-testid="email">
              <input type="text" name="address" placeholder="Address" required data-testid="address">
              <input type="text" name="city" placeholder="City" required data-testid="city">
              <input type="text" name="zipCode" placeholder="ZIP Code" required data-testid="zip-code">
            </div>
            <div class="payment-info">
              <h3>Payment Information</h3>
              <input type="text" name="cardNumber" placeholder="Card Number" required data-testid="card-number">
              <input type="text" name="expiryDate" placeholder="MM/YY" required data-testid="expiry-date">
              <input type="text" name="cvv" placeholder="CVV" required data-testid="cvv">
            </div>
            <button type="submit" data-testid="place-order">Place Order</button>
          </form>
        </body>
        </html>
      `);
    });

    // API endpoints
    app.post('/api/cart', (_req: Request, res: Response) => {
      res.json({ success: true, message: 'Item added to cart' });
    });

    app.post('/api/reviews', (_req: Request, res: Response) => {
      res.json({ success: true, message: 'Review submitted' });
    });

    app.post('/order', (_req: Request, res: Response) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Order Confirmation</title></head>
        <body>
          <h1>Order Placed Successfully!</h1>
          <p>Thank you for your order. Order ID: #12345</p>
          <a href="/" data-testid="home-link">Return to Home</a>
        </body>
        </html>
      `);
    });

    testServer = app.listen(testPort);
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterEach(() => {
    if (testServer) {
      testServer.close();
      testServer = null;
    }
  });

  describe('Complete Crawling Workflows', () => {
    it('should crawl a complex e-commerce site with BreadthFirstCrawler', async () => {
      const crawler = new BreadthFirstCrawler({
        startUrl: `http://localhost:${testPort}`,
        maxDepth: 3,
        maxPages: 50,
        crawlDelay: 100,
        allowedDomains: ['localhost'],
        respectRobotsTxt: false,
        userAgent: 'Mozilla/5.0 (compatible; TestCrawler/1.0)',
        parallelWorkers: 3,
      });
      const monitoring = new MonitoringService({
        enabled: true,
        reporting: {
          enabled: false,
          interval: 60000,
          includeSummary: false,
        },
      });

      await monitoring.initialize();

      try {
        const result = await crawler.crawl();

        expect(result.urls.length).toBeGreaterThan(5);
        expect(result.pagesVisited).toBeGreaterThan(5);
        expect(result.duration).toBeGreaterThan(0);
        expect(result.errors.length).toBe(0);

        // Verify that different pages were crawled
        expect(result.urls.some((url) => url.includes('/products'))).toBe(true);
        expect(result.urls.some((url) => url.includes('/cart'))).toBe(true);
      } finally {
        await monitoring.shutdown();
      }
    }, 30000);

    it('should handle resilient crawling with failures', async () => {
      const resilientCrawler = new ResilientCrawler(browser, {
        circuitBreaker: {
          failureThreshold: 3,
          recoveryTimeout: 1000,
          monitoringPeriod: 5000,
        },
        retry: {
          maxRetries: 2,
          baseDelay: 100,
          maxDelay: 1000,
          backoffMultiplier: 2,
          retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'],
        },
        healthCheck: {
          enabled: true,
          interval: 2000,
          timeout: 5000,
        },
      });

      const result = await resilientCrawler.crawl({
        startUrl: `http://localhost:${testPort}`,
        maxDepth: 2,
        maxPages: 8,
        crawlDelay: 50,
        parallelWorkers: 1,
        allowedDomains: ['localhost'],
        respectRobotsTxt: false,
        userAgent: 'Mozilla/5.0 (compatible; TestCrawler/1.0)',
      });

      expect(result.urls.length).toBeGreaterThan(0);
      expect(result.pagesVisited).toBeGreaterThan(0);
    }, 20000);

    it('should perform end-to-end workflow with all components', async () => {
      // Initialize all components
      const monitoring = new MonitoringService({
        enabled: true,
        reporting: {
          enabled: false,
          interval: 60000,
          includeSummary: false,
        },
      });
      await monitoring.initialize();

      // const _sessionManager = new SessionManager({
      //   storage: { type: 'memory' },
      //   encryption: { enabled: false },
      // });

      const stealth = new StealthMode({
        enabled: true,
        fingerprintSpoofing: { canvas: true, webgl: true, audio: true },
        behaviorSimulation: { humanLikeDelays: true, randomizedTiming: true },
      });

      const crawler = new BreadthFirstCrawler({
        startUrl: `http://localhost:${testPort}`,
        maxDepth: 3,
        maxPages: 50,
        crawlDelay: 100,
        allowedDomains: ['localhost'],
        respectRobotsTxt: false,
        userAgent: 'Mozilla/5.0 (compatible; TestCrawler/1.0)',
        parallelWorkers: 3,
      });
      const recorder = new UserPathRecorder({
        captureScreenshots: true,
        captureNetworkActivity: true,
        captureConsoleMessages: true,
      });

      const testGenerator = new TestGenerator({
        framework: 'playwright',
        language: 'typescript',
        outputDirectory: testOutputDir,
        generatePageObjects: true,
        generateFixtures: true,
      });

      try {
        // Step 1: Crawl the site
        monitoring.recordCounter('workflow_steps', 1, { step: 'crawling' });
        const spanId = monitoring.startSpan('end_to_end_workflow');

        const crawlResult = await crawler.crawl();

        monitoring.addSpanLog(spanId, 'info', `Crawled ${crawlResult.urls.length} pages`);

        // Step 2: Record user interactions
        monitoring.recordCounter('workflow_steps', 1, { step: 'recording' });
        const page = await browser.newPage();
        await stealth.setupPage(page);

        recorder.startRecording(page, 'e-commerce-workflow');

        await page.goto(`http://localhost:${testPort}`);
        await page.click('[data-testid="products-link"]');
        await page.waitForLoadState('networkidle');
        await page.click('[data-testid="view-product-1"]');
        await page.waitForLoadState('networkidle');
        await page.selectOption('[data-testid="quantity-select"]', '2');
        await page.click('[data-testid="add-to-cart"]');
        await page.waitForTimeout(1000);

        const userPath = await recorder.stopRecording();
        await page.close();

        expect(userPath.steps.length).toBeGreaterThan(0);
        monitoring.addSpanLog(
          spanId,
          'info',
          `Recorded ${userPath.steps.length} interaction steps`
        );

        // Step 3: Generate tests
        monitoring.recordCounter('workflow_steps', 1, { step: 'generation' });
        const generationResult = await testGenerator.generate(userPath);

        expect(generationResult.files.length).toBeGreaterThan(0);
        expect(generationResult.summary.totalTests).toBeGreaterThan(0);

        monitoring.addSpanLog(
          spanId,
          'info',
          `Generated ${generationResult.files.length} test files`
        );
        monitoring.finishSpan(spanId, { success: true });

        // Verify the complete workflow
        expect(crawlResult.urls.length).toBeGreaterThan(3);
        expect(userPath.steps.length).toBeGreaterThan(3);
        expect(generationResult.files.length).toBeGreaterThan(0);

        // Check that monitoring captured the workflow
        const report = await monitoring.generateReport();
        expect(report.crawlMetrics.totalRequests).toBeGreaterThan(0);
        expect(report.summary.overallHealth).toBe('healthy');
      } finally {
        await monitoring.shutdown();
      }
    }, 45000);

    it('should handle complex form interactions and data generation', async () => {
      const page = await browser.newPage();
      const detector = new AIElementDetector();
      const executor = new InteractionExecutor();

      try {
        await page.goto(`http://localhost:${testPort}/checkout`);

        // Detect all form elements
        const elements = await detector.detectElements(page);
        const formElements = elements.filter(
          (el) => el.type === 'input' || el.type === 'form' || el.type === 'button'
        );

        expect(formElements.length).toBeGreaterThan(5);

        // Execute interactions with the form
        const interactions = [];
        for (const element of formElements) {
          if (element.selector && element.type === 'input') {
            const result = await executor.executeInteraction(page, {
              type: 'fill',
              selector: element.selector,
              value: generateTestData(element.selector),
              options: { delay: 50 },
            });
            interactions.push(result);
          }
        }

        // Verify interactions were successful
        const successfulInteractions = interactions.filter((i) => i.success);
        expect(successfulInteractions.length).toBeGreaterThan(3);

        // Check that form is filled
        const firstNameValue = await page.inputValue('[data-testid="first-name"]');
        expect(firstNameValue).toBeTruthy();

        const emailValue = await page.inputValue('[data-testid="email"]');
        expect(emailValue).toContain('@');
      } finally {
        await page.close();
      }
    }, 15000);
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent crawling sessions', async () => {
      const monitoring = new MonitoringService({
        enabled: true,
        reporting: {
          enabled: false,
          interval: 60000,
          includeSummary: false,
        },
      });
      await monitoring.initialize();

      try {
        // Run multiple crawlers concurrently
        const crawlers = [1, 2, 3].map(() => new BreadthFirstCrawler({
          startUrl: `http://localhost:${testPort}`,
          maxDepth: 1,
          maxPages: 3,
          crawlDelay: 200,
          parallelWorkers: 1,
          allowedDomains: ['localhost'],
          respectRobotsTxt: false,
          userAgent: 'test-crawler',
        }));

        const crawlPromises = crawlers.map(async (crawler, _index) => {
          return crawler.crawl();
        });

        const results = await Promise.all(crawlPromises);

        // Verify all crawlers completed successfully
        results.forEach((result, _index) => {
          expect(result.urls.length).toBeGreaterThan(0);
          expect(result.errors.length).toBe(0);
        });

        // Check monitoring captured all activities
        const report = await monitoring.generateReport();
        expect(report.crawlMetrics.totalRequests).toBeGreaterThan(3);
      } finally {
        await monitoring.shutdown();
      }
    }, 30000);

    it('should measure and report performance metrics', async () => {
      const monitoring = new MonitoringService({
        enabled: true,
        metricsCollection: {
          enabled: true,
          flushInterval: 1000,
          maxMetrics: 1000,
          exportFormat: 'console',
        },
        reporting: {
          enabled: false,
          interval: 60000,
          includeSummary: false,
        },
      });
      await monitoring.initialize();

      const crawler = new BreadthFirstCrawler({
        startUrl: `http://localhost:${testPort}`,
        maxDepth: 3,
        maxPages: 50,
        crawlDelay: 100,
        allowedDomains: ['localhost'],
        respectRobotsTxt: false,
        userAgent: 'Mozilla/5.0 (compatible; TestCrawler/1.0)',
        parallelWorkers: 3,
      });

      try {
        const startTime = Date.now();

        const result = await monitoring.timeFunction(
          'full_crawl_workflow',
          () => crawler.crawl(),
          { workflow: 'performance_test' }
        );

        const totalTime = Date.now() - startTime;

        // Verify performance metrics
        expect(result.urls.length).toBeGreaterThan(0);
        expect(result.duration).toBeGreaterThan(0);

        // Check monitoring metrics
        const metrics = monitoring.getMetrics();
        expect(Object.keys(metrics)).toContain('full_crawl_workflow');

        const report = await monitoring.generateReport();
        expect(report.crawlMetrics.averageResponseTime).toBeGreaterThan(0);
        expect(report.crawlMetrics.requestsPerSecond).toBeGreaterThan(0);

        // Log performance summary
        logger.info('Performance test completed', {
          totalTime,
          pagesPerSecond: result.urls.length / (totalTime / 1000),
          crawlDuration: result.duration,
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        });
      } finally {
        await monitoring.shutdown();
      }
    }, 25000);
  });
});
