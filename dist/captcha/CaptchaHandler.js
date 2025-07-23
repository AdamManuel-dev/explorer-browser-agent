"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaptchaHandler = void 0;
const logger_1 = require("../utils/logger");
class CaptchaHandler {
    config;
    detectionPatterns;
    constructor(config) {
        this.config = this.mergeWithDefaults(config || {});
        this.detectionPatterns = this.initializeDetectionPatterns();
    }
    async detectCaptcha(page) {
        logger_1.logger.debug('Detecting CAPTCHA on page');
        if (!this.config.autoDetect) {
            return { detected: false, type: 'unknown', confidence: 0 };
        }
        // Check for each CAPTCHA type
        for (const [type, selectors] of this.detectionPatterns.entries()) {
            for (const selector of selectors) {
                try {
                    const element = page.locator(selector);
                    const isVisible = await element.isVisible().catch(() => false);
                    if (isVisible) {
                        const metadata = await this.extractCaptchaMetadata(page, type, element);
                        logger_1.logger.info('CAPTCHA detected', {
                            type,
                            selector,
                            metadata,
                        });
                        return {
                            detected: true,
                            type,
                            element,
                            selector,
                            confidence: this.calculateConfidence(type, selector),
                            metadata,
                        };
                    }
                }
                catch (error) {
                    logger_1.logger.debug('Error checking CAPTCHA selector', { selector, error });
                }
            }
        }
        // Check for custom selectors
        if (this.config.customSelectors) {
            for (const [customType, selectors] of Object.entries(this.config.customSelectors)) {
                for (const selector of selectors) {
                    try {
                        const element = page.locator(selector);
                        const isVisible = await element.isVisible().catch(() => false);
                        if (isVisible) {
                            logger_1.logger.info('Custom CAPTCHA detected', { type: customType, selector });
                            return {
                                detected: true,
                                type: 'custom',
                                element,
                                selector,
                                confidence: 0.8,
                                metadata: { customType },
                            };
                        }
                    }
                    catch (error) {
                        logger_1.logger.debug('Error checking custom CAPTCHA selector', { selector, error });
                    }
                }
            }
        }
        logger_1.logger.debug('No CAPTCHA detected');
        return { detected: false, type: 'unknown', confidence: 0 };
    }
    async solveCaptcha(page, detection) {
        if (!detection.detected || !detection.element) {
            return {
                success: false,
                error: 'No CAPTCHA detected to solve',
                timeToSolve: 0,
                method: 'bypass',
            };
        }
        logger_1.logger.info('Attempting to solve CAPTCHA', {
            type: detection.type,
            method: this.getPreferredSolvingMethod(),
        });
        const startTime = Date.now();
        let result;
        try {
            // Try different solving methods in order of preference
            result = await this.attemptSolution(page, detection);
            if (result.success) {
                logger_1.logger.info('CAPTCHA solved successfully', {
                    type: detection.type,
                    method: result.method,
                    timeToSolve: result.timeToSolve,
                });
            }
            else {
                logger_1.logger.warn('CAPTCHA solving failed', {
                    type: detection.type,
                    error: result.error,
                });
            }
        }
        catch (error) {
            logger_1.logger.error('CAPTCHA solving error', error);
            result = {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timeToSolve: Date.now() - startTime,
                method: 'service',
            };
        }
        return result;
    }
    async handleCaptchaWorkflow(page) {
        logger_1.logger.info('Starting CAPTCHA handling workflow');
        let attempts = 0;
        const maxAttempts = this.config.solveAttempts;
        while (attempts < maxAttempts) {
            attempts++;
            logger_1.logger.debug(`CAPTCHA attempt ${attempts}/${maxAttempts}`);
            // Detect CAPTCHA
            const detection = await this.detectCaptcha(page);
            if (!detection.detected) {
                logger_1.logger.info('No CAPTCHA detected, workflow complete');
                return true;
            }
            // Solve CAPTCHA
            const solution = await this.solveCaptcha(page, detection);
            if (solution.success) {
                // Wait for page to process the solution
                await page.waitForTimeout(2000);
                // Check if CAPTCHA is still present
                const stillPresent = await this.detectCaptcha(page);
                if (!stillPresent.detected) {
                    logger_1.logger.info('CAPTCHA workflow completed successfully');
                    return true;
                }
                logger_1.logger.warn('CAPTCHA still present after solving, retrying');
            }
            else {
                logger_1.logger.warn('CAPTCHA solving failed', {
                    attempt: attempts,
                    error: solution.error,
                });
            }
            // Brief delay before retry
            await page.waitForTimeout(1000);
        }
        logger_1.logger.error('CAPTCHA workflow failed after maximum attempts', {
            maxAttempts,
        });
        return false;
    }
    async attemptSolution(page, detection) {
        const startTime = Date.now();
        // Method 1: Try service-based solving
        if (this.hasEnabledService()) {
            const serviceResult = await this.solveWithService(page, detection);
            if (serviceResult.success) {
                return {
                    success: serviceResult.success ?? false,
                    solution: serviceResult.solution,
                    error: serviceResult.error,
                    cost: serviceResult.cost,
                    timeToSolve: Date.now() - startTime,
                    method: 'service',
                };
            }
        }
        // Method 2: Try bypass techniques
        const bypassResult = await this.attemptBypass(page, detection);
        if (bypassResult.success) {
            return {
                success: bypassResult.success ?? false,
                solution: bypassResult.solution,
                error: bypassResult.error,
                cost: bypassResult.cost,
                timeToSolve: Date.now() - startTime,
                method: 'bypass',
            };
        }
        // Method 3: Manual solving (if enabled)
        if (this.config.manualSolving.enabled) {
            const manualResult = await this.solveManually(page, detection);
            return {
                success: manualResult.success ?? false,
                solution: manualResult.solution,
                error: manualResult.error,
                cost: manualResult.cost,
                timeToSolve: Date.now() - startTime,
                method: 'manual',
            };
        }
        return {
            success: false,
            error: 'All solving methods failed',
            timeToSolve: Date.now() - startTime,
            method: 'service',
        };
    }
    async solveWithService(page, detection) {
        logger_1.logger.debug('Attempting service-based CAPTCHA solving');
        // This is a placeholder for actual service integration
        // In a real implementation, you would integrate with services like:
        // - 2captcha.com
        // - anti-captcha.com
        // - deathbycaptcha.com
        if (detection.type === 'recaptcha' && detection.metadata?.siteKey) {
            return this.solveRecaptchaWithService(page, detection.metadata.siteKey);
        }
        if (detection.type === 'hcaptcha' && detection.metadata?.siteKey) {
            return this.solveHcaptchaWithService(page, detection.metadata.siteKey);
        }
        return {
            success: false,
            error: 'Service solving not implemented for this CAPTCHA type',
        };
    }
    async solveRecaptchaWithService(_page, siteKey) {
        // Placeholder for reCAPTCHA service integration
        logger_1.logger.debug('Solving reCAPTCHA with service', { siteKey });
        // This would involve:
        // 1. Submit CAPTCHA to solving service
        // 2. Wait for solution
        // 3. Inject solution into page
        return {
            success: false,
            error: 'Service integration not implemented',
        };
    }
    async solveHcaptchaWithService(_page, siteKey) {
        // Placeholder for hCaptcha service integration
        logger_1.logger.debug('Solving hCaptcha with service', { siteKey });
        return {
            success: false,
            error: 'Service integration not implemented',
        };
    }
    async attemptBypass(page, detection) {
        logger_1.logger.debug('Attempting CAPTCHA bypass techniques');
        switch (detection.type) {
            case 'cloudflare':
                return this.bypassCloudflare(page);
            case 'custom':
                return this.bypassCustomCaptcha(page, detection);
            default:
                return {
                    success: false,
                    error: 'No bypass method available for this CAPTCHA type',
                };
        }
    }
    async bypassCloudflare(page) {
        logger_1.logger.debug('Attempting Cloudflare bypass');
        try {
            // Wait for Cloudflare challenge to complete
            await page.waitForLoadState('networkidle', { timeout: 30000 });
            // Check if we're past the challenge
            const challengePresent = await page
                .locator('.cf-browser-verification')
                .isVisible()
                .catch(() => false);
            if (!challengePresent) {
                return { success: true, solution: 'bypass' };
            }
            // Try clicking the challenge checkbox
            const checkbox = page.locator('input[type="checkbox"]').first();
            if (await checkbox.isVisible().catch(() => false)) {
                await checkbox.click();
                await page.waitForTimeout(5000);
                const stillPresent = await page
                    .locator('.cf-browser-verification')
                    .isVisible()
                    .catch(() => false);
                return {
                    success: !stillPresent,
                    solution: stillPresent ? undefined : 'checkbox-click',
                };
            }
        }
        catch (error) {
            logger_1.logger.debug('Cloudflare bypass failed', error);
        }
        return {
            success: false,
            error: 'Cloudflare bypass failed',
        };
    }
    async bypassCustomCaptcha(page, detection) {
        logger_1.logger.debug('Attempting custom CAPTCHA bypass');
        // Try common bypass techniques
        if (detection.element) {
            try {
                // Try hiding the CAPTCHA element
                await page.evaluate((selector) => {
                    const element = document.querySelector(selector);
                    if (element) {
                        element.style.display = 'none';
                    }
                }, detection.selector || '');
                await page.waitForTimeout(1000);
                return { success: true, solution: 'hide-element' };
            }
            catch (error) {
                logger_1.logger.debug('Custom CAPTCHA bypass failed', error);
            }
        }
        return {
            success: false,
            error: 'Custom CAPTCHA bypass failed',
        };
    }
    async solveManually(page, detection) {
        logger_1.logger.info('Manual CAPTCHA solving requested');
        if (this.config.manualSolving.promptUser) {
            // In a real implementation, this would prompt the user
            // For now, just wait and hope the user solves it
            console.log(`\n🔐 CAPTCHA DETECTED: ${detection.type}`);
            console.log('Please solve the CAPTCHA manually in the browser window.');
            console.log(`Waiting ${this.config.manualSolving.timeout / 1000} seconds...\n`);
            await page.waitForTimeout(this.config.manualSolving.timeout);
            // Check if CAPTCHA is solved
            const stillPresent = await this.detectCaptcha(page);
            return {
                success: !stillPresent.detected,
                solution: stillPresent.detected ? undefined : 'manual',
                error: stillPresent.detected ? 'Manual solving timeout' : undefined,
            };
        }
        return {
            success: false,
            error: 'Manual solving not configured',
        };
    }
    async extractCaptchaMetadata(page, type, _element) {
        const metadata = {};
        try {
            switch (type) {
                case 'recaptcha': {
                    // Extract reCAPTCHA site key
                    const siteKey = await page.evaluate(() => {
                        const scripts = Array.from(document.scripts);
                        for (const script of scripts) {
                            const match = script.src.match(/[?&]k=([^&]+)/);
                            if (match)
                                return match[1];
                        }
                        // Check for data-sitekey attribute
                        const recaptchaDiv = document.querySelector('[data-sitekey]');
                        return recaptchaDiv?.getAttribute('data-sitekey') || null;
                    });
                    if (siteKey)
                        metadata.siteKey = siteKey;
                    break;
                }
                case 'hcaptcha': {
                    // Extract hCaptcha site key
                    const hcaptchaSiteKey = await page.evaluate(() => {
                        const hcaptchaDiv = document.querySelector('[data-sitekey]');
                        return hcaptchaDiv?.getAttribute('data-sitekey') || null;
                    });
                    if (hcaptchaSiteKey)
                        metadata.siteKey = hcaptchaSiteKey;
                    break;
                }
                case 'cloudflare': {
                    // Extract Cloudflare challenge info
                    const challengeId = await page.evaluate(() => {
                        const challengeInput = document.querySelector('input[name="cf_ch_verify"]');
                        return challengeInput?.getAttribute('value') || null;
                    });
                    if (challengeId)
                        metadata.challenge = challengeId;
                    break;
                }
                default:
                    // Unknown captcha type, metadata will be empty
                    break;
            }
        }
        catch (error) {
            logger_1.logger.debug('Error extracting CAPTCHA metadata', error);
        }
        return metadata;
    }
    calculateConfidence(type, selector) {
        // Higher confidence for more specific selectors
        const confidenceMap = {
            recaptcha: 0.95,
            hcaptcha: 0.9,
            funcaptcha: 0.85,
            cloudflare: 0.9,
            custom: 0.7,
            unknown: 0.5,
        };
        let confidence = confidenceMap[type] || 0.5;
        // Boost confidence for specific selectors
        if (selector.includes('data-sitekey') || selector.includes('recaptcha')) {
            confidence = Math.min(0.98, confidence + 0.1);
        }
        return confidence;
    }
    initializeDetectionPatterns() {
        return new Map([
            [
                'recaptcha',
                [
                    '.g-recaptcha',
                    '[data-sitekey]',
                    '#recaptcha-element',
                    '.recaptcha-checkbox',
                    'iframe[src*="recaptcha"]',
                    '.grecaptcha-badge',
                ],
            ],
            [
                'hcaptcha',
                ['.h-captcha', '[data-hcaptcha-sitekey]', 'iframe[src*="hcaptcha"]', '.hcaptcha-checkbox'],
            ],
            [
                'funcaptcha',
                [
                    '.funcaptcha',
                    '#funcaptcha',
                    'iframe[src*="funcaptcha"]',
                    '[data-callback*="funcaptcha"]',
                ],
            ],
            [
                'cloudflare',
                [
                    '.cf-browser-verification',
                    '.cf-checking-browser',
                    '#cf-wrapper',
                    '.cf-challenge-running',
                    'input[name="cf_ch_verify"]',
                ],
            ],
            [
                'custom',
                [
                    '.captcha',
                    '#captcha',
                    '[class*="captcha"]',
                    '[id*="captcha"]',
                    '.challenge',
                    '.verification',
                ],
            ],
        ]);
    }
    hasEnabledService() {
        return Object.values(this.config.services).some((service) => service?.enabled);
    }
    getPreferredSolvingMethod() {
        if (this.hasEnabledService())
            return 'service';
        if (this.config.manualSolving.enabled)
            return 'manual';
        return 'bypass';
    }
    mergeWithDefaults(config) {
        return {
            autoDetect: true,
            solveAttempts: 3,
            timeout: 60000,
            services: {
                twoCaptcha: {
                    apiKey: '',
                    enabled: false,
                },
                antiCaptcha: {
                    apiKey: '',
                    enabled: false,
                },
                deathByCaptcha: {
                    username: '',
                    password: '',
                    enabled: false,
                },
                ...config.services,
            },
            manualSolving: {
                enabled: true,
                promptUser: true,
                timeout: 60000,
                ...config.manualSolving,
            },
            customSelectors: {},
            ...config,
        };
    }
}
exports.CaptchaHandler = CaptchaHandler;
//# sourceMappingURL=CaptchaHandler.js.map