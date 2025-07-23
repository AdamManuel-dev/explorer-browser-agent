"use strict";
/**
 * Integration Tests Suite
 *
 * This directory contains comprehensive integration tests that verify the
 * end-to-end functionality of the Browser Explorer system.
 *
 * Test Categories:
 *
 * 1. BrowserExplorer.integration.test.ts
 *    - Full exploration workflow tests
 *    - Configuration loading and validation
 *    - Component integration verification
 *    - Error handling and edge cases
 *    - Performance and scalability tests
 *
 * 2. CrawlerWorkflow.integration.test.ts
 *    - Multi-crawler coordination tests
 *    - Complex form interaction workflows
 *    - Performance measurement and reporting
 *    - Concurrent crawling session handling
 *    - Element detection and interaction execution
 *
 * 3. AuthWorkflow.integration.test.ts
 *    - Multi-strategy authentication workflows
 *    - Session persistence and restoration
 *    - Stealth mode authentication
 *    - Authentication error handling
 *    - Authenticated content crawling
 *
 * Running Integration Tests:
 *
 * # Run all integration tests
 * npm run test:integration
 *
 * # Run specific test file
 * npm test -- --testPathPattern=BrowserExplorer.integration.test.ts
 *
 * # Run with coverage
 * npm run test:integration:coverage
 *
 * Test Requirements:
 * - Playwright browsers installed
 * - Node.js test server capabilities (Express)
 * - Sufficient system resources for browser automation
 * - Network access for localhost test servers
 *
 * Test Environment Setup:
 * Each test suite starts its own test server with predefined endpoints
 * and test data. This ensures test isolation and repeatability.
 *
 * Key Testing Patterns:
 * - Test server setup/teardown in beforeEach/afterEach
 * - Browser instance management in beforeAll/afterAll
 * - Temporary directory creation for test outputs
 * - Comprehensive assertion coverage
 * - Performance metric collection
 * - Error boundary testing
 *
 * Integration Test Best Practices:
 * 1. Always clean up resources (browsers, servers, temp files)
 * 2. Use realistic test data and scenarios
 * 3. Test both success and failure paths
 * 4. Verify integration between multiple components
 * 5. Include performance and load testing
 * 6. Test with different configurations
 * 7. Validate end-to-end workflows
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestMetricsCollector = exports.EXPECTED_ELEMENTS = exports.TEST_URLS = exports.TEST_CREDENTIALS = exports.INTEGRATION_TEST_CONFIG = void 0;
exports.createTestServer = createTestServer;
exports.generateTestData = generateTestData;
exports.waitForElement = waitForElement;
exports.waitForNavigation = waitForNavigation;
exports.measureExecutionTime = measureExecutionTime;
// Re-export test utilities if needed
exports.INTEGRATION_TEST_CONFIG = {
    DEFAULT_TIMEOUT: 30000,
    BROWSER_LAUNCH_OPTIONS: {
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
    TEST_SERVER_PORTS: {
        BROWSER_EXPLORER: 3001,
        CRAWLER_WORKFLOW: 3002,
        AUTH_WORKFLOW: 3003,
    },
    TEMP_DIR_PREFIX: 'browser-explorer-test',
};
exports.TEST_CREDENTIALS = {
    BASIC_AUTH: {
        admin: { username: 'admin', password: 'password' },
        user: { username: 'user', password: 'secret' },
        testuser: { username: 'testuser', password: 'testpass' },
    },
    API_KEYS: {
        valid: 'test-api-key-123',
        invalid: 'invalid-key',
    },
    OAUTH: {
        mockCode: 'mock-auth-code-123',
    },
};
exports.TEST_URLS = {
    HOME: '/',
    ABOUT: '/about',
    CONTACT: '/contact',
    LOGIN: '/login',
    DASHBOARD: '/dashboard',
    PROFILE: '/profile',
    PRODUCTS: '/products',
    CART: '/cart',
    CHECKOUT: '/checkout',
    ADMIN: '/admin',
};
exports.EXPECTED_ELEMENTS = {
    NAVIGATION: ['home-link', 'about-link', 'contact-link', 'login-link'],
    FORMS: ['search-form', 'login-form', 'feedback-form', 'checkout-form'],
    BUTTONS: ['search-button', 'login-submit', 'add-to-cart', 'checkout-btn'],
    INPUTS: ['search-input', 'username-input', 'password-input', 'email-input'],
};
// Test utility functions
function createTestServer(port, routes) {
    const express = require('express');
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    // Add routes
    Object.entries(routes).forEach(([path, handler]) => {
        app.get(path, handler);
    });
    return app.listen(port);
}
function generateTestData(type) {
    const generators = {
        email: () => `test${Date.now()}@example.com`,
        username: () => `user${Math.floor(Math.random() * 1000)}`,
        password: () => 'Test123!',
        firstName: () => 'John',
        lastName: () => 'Doe',
        address: () => '123 Test Street',
        city: () => 'Test City',
        zipCode: () => '12345',
        phone: () => '(555) 123-4567',
        cardNumber: () => '4111111111111111',
        expiryDate: () => '12/25',
        cvv: () => '123',
    };
    return generators[type]?.() || 'test-value';
}
async function waitForElement(page, selector, timeout = 5000) {
    try {
        await page.waitForSelector(selector, { timeout });
        return page.locator(selector);
    }
    catch (error) {
        throw new Error(`Element ${selector} not found within ${timeout}ms`);
    }
}
async function waitForNavigation(page, expectedUrl, timeout = 10000) {
    await page.waitForLoadState('networkidle', { timeout });
    if (expectedUrl) {
        const currentUrl = page.url();
        if (!currentUrl.includes(expectedUrl)) {
            throw new Error(`Expected URL to contain ${expectedUrl}, but got ${currentUrl}`);
        }
    }
}
async function measureExecutionTime(operation) {
    const startTime = Date.now();
    try {
        const result = await operation();
        const duration = Date.now() - startTime;
        return { result, duration };
    }
    catch (error) {
        const duration = Date.now() - startTime;
        throw new Error(`Operation failed: ${error} (duration: ${duration}ms)`);
    }
}
class TestMetricsCollector {
    metrics = new Map();
    record(name, value) {
        if (!this.metrics.has(name)) {
            this.metrics.set(name, []);
        }
        this.metrics.get(name).push(value);
    }
    getAverage(name) {
        const values = this.metrics.get(name) || [];
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    }
    getMax(name) {
        const values = this.metrics.get(name) || [];
        return values.length > 0 ? Math.max(...values) : 0;
    }
    getMin(name) {
        const values = this.metrics.get(name) || [];
        return values.length > 0 ? Math.min(...values) : 0;
    }
    getTotal(name) {
        const values = this.metrics.get(name) || [];
        return values.reduce((a, b) => a + b, 0);
    }
    getSummary() {
        const summary = {};
        for (const [name, values] of this.metrics.entries()) {
            summary[name] = {
                avg: this.getAverage(name),
                max: this.getMax(name),
                min: this.getMin(name),
                total: this.getTotal(name),
                count: values.length,
            };
        }
        return summary;
    }
    clear() {
        this.metrics.clear();
    }
}
exports.TestMetricsCollector = TestMetricsCollector;
// Dummy test to satisfy Jest requirement
describe('Integration Test Suite', () => {
    test('exports are defined', () => {
        expect(exports.INTEGRATION_TEST_CONFIG).toBeDefined();
        expect(exports.TEST_CREDENTIALS).toBeDefined();
        expect(exports.TEST_URLS).toBeDefined();
        expect(exports.EXPECTED_ELEMENTS).toBeDefined();
        expect(TestMetricsCollector).toBeDefined();
    });
});
//# sourceMappingURL=index.js.map