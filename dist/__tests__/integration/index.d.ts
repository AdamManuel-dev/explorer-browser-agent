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
export declare const INTEGRATION_TEST_CONFIG: {
    DEFAULT_TIMEOUT: number;
    BROWSER_LAUNCH_OPTIONS: {
        headless: boolean;
        args: string[];
    };
    TEST_SERVER_PORTS: {
        BROWSER_EXPLORER: number;
        CRAWLER_WORKFLOW: number;
        AUTH_WORKFLOW: number;
    };
    TEMP_DIR_PREFIX: string;
};
export declare const TEST_CREDENTIALS: {
    BASIC_AUTH: {
        admin: {
            username: string;
            password: string;
        };
        user: {
            username: string;
            password: string;
        };
        testuser: {
            username: string;
            password: string;
        };
    };
    API_KEYS: {
        valid: string;
        invalid: string;
    };
    OAUTH: {
        mockCode: string;
    };
};
export declare const TEST_URLS: {
    HOME: string;
    ABOUT: string;
    CONTACT: string;
    LOGIN: string;
    DASHBOARD: string;
    PROFILE: string;
    PRODUCTS: string;
    CART: string;
    CHECKOUT: string;
    ADMIN: string;
};
export declare const EXPECTED_ELEMENTS: {
    NAVIGATION: string[];
    FORMS: string[];
    BUTTONS: string[];
    INPUTS: string[];
};
export declare function createTestServer(port: number, routes: any): any;
export declare function generateTestData(type: string): string;
export declare function waitForElement(page: any, selector: string, timeout?: number): Promise<any>;
export declare function waitForNavigation(page: any, expectedUrl?: string, timeout?: number): Promise<void>;
export declare function measureExecutionTime<T>(operation: () => Promise<T>): Promise<{
    result: T;
    duration: number;
}>;
export declare class TestMetricsCollector {
    private metrics;
    record(name: string, value: number): void;
    getAverage(name: string): number;
    getMax(name: string): number;
    getMin(name: string): number;
    getTotal(name: string): number;
    getSummary(): Record<string, {
        avg: number;
        max: number;
        min: number;
        total: number;
        count: number;
    }>;
    clear(): void;
}
//# sourceMappingURL=index.d.ts.map