"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeneratorAgent = void 0;
const agent_1 = require("@mastra/core/agent");
const uuid_1 = require("uuid");
const path_1 = __importDefault(require("path"));
const logger_1 = require("../../utils/logger");
const TestGenerator_1 = require("../../generation/TestGenerator");
const PageObjectGenerator_1 = require("../../generation/PageObjectGenerator");
const TestFileWriter_1 = require("../../generation/TestFileWriter");
const TestValidator_1 = require("../../generation/TestValidator");
class GeneratorAgent extends agent_1.Agent {
    monitoring;
    testGenerator;
    pageObjectGenerator;
    testFileWriter;
    testValidator;
    config;
    metrics;
    activeJobs = new Map();
    templates = new Map();
    generationCache = new Map();
    constructor(config) {
        super({
            id: 'generator-agent',
            name: 'GeneratorAgent',
            instructions: 'Intelligent test generation coordination and optimization agent',
        });
        this.config = config;
        this.monitoring = config.monitoring;
        // Initialize generation components
        this.testGenerator = new TestGenerator_1.TestGenerator({
            framework: config.defaultFramework || 'playwright',
            language: (config.defaultLanguage === 'python' || config.defaultLanguage === 'java'
                ? 'typescript'
                : config.defaultLanguage) || 'typescript',
            outputDirectory: config.outputDirectory || './generated-tests',
            generatePageObjects: true,
            generateFixtures: true,
            generateHelpers: true,
            useAAAPattern: true,
            addComments: true,
            groupRelatedTests: true,
            testNamingConvention: 'describe-it',
        });
        this.pageObjectGenerator = new PageObjectGenerator_1.PageObjectGenerator();
        this.testFileWriter = new TestFileWriter_1.TestFileWriter(config.outputDirectory || './generated-tests');
        this.testValidator = new TestValidator_1.TestValidator(config.defaultFramework || 'playwright');
        this.metrics = {
            tasksCompleted: 0,
            tasksSuccessful: 0,
            tasksFailed: 0,
            averageTaskDuration: 0,
            totalRuntime: 0,
            memoryUsage: 0,
            cpuUsage: 0,
            lastActivity: new Date(),
        };
        this.setupEventHandlers();
        this.loadDefaultTemplates();
    }
    /**
     * Get agent capabilities
     */
    getCapabilities() {
        return {
            canNavigate: false,
            canInteract: false,
            canExtract: false,
            canGenerateTests: true,
            canHandleAuth: false,
            canHandleCaptcha: false,
            canTakeScreenshots: false,
            supportedBrowsers: [], // Generation doesn't require browsers
        };
    }
    /**
     * Get current agent metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * Generate tests from user paths with intelligent optimization
     */
    async generateTests(request) {
        const startTime = new Date();
        const jobId = (0, uuid_1.v4)();
        const spanId = this.monitoring?.startSpan('generator_generate_tests');
        // Create generation job
        const job = {
            id: jobId,
            request,
            status: 'pending',
            progress: 0,
            startTime,
        };
        this.activeJobs.set(jobId, job);
        try {
            logger_1.logger.info('Starting test generation', {
                jobId,
                userPaths: request.userPaths.length,
                framework: request.framework,
                language: request.language,
            });
            // Update job status
            job.status = 'running';
            job.progress = 10;
            // Check cache first
            const cacheKey = this.generateCacheKey(request);
            if (this.config.cacheEnabled && this.generationCache.has(cacheKey)) {
                const cachedResult = this.generationCache.get(cacheKey);
                logger_1.logger.info('Using cached test generation result', { jobId, cacheKey });
                job.status = 'completed';
                job.progress = 100;
                job.endTime = new Date();
                job.result = cachedResult;
                return cachedResult;
            }
            // Analyze user paths for optimization opportunities
            const analysis = await this.analyzeUserPaths(request.userPaths);
            job.progress = 20;
            // Generate page objects if requested
            let pageObjects = [];
            if (request.options.generatePageObjects) {
                pageObjects = await this.generatePageObjects(request.userPaths, request.framework, request.language);
                job.progress = 40;
            }
            // Generate test fixtures if requested
            let fixtures = [];
            if (request.options.generateFixtures) {
                fixtures = await this.generateFixtures(request.userPaths, request.language);
                job.progress = 60;
            }
            // Generate helper utilities if requested
            let helpers = [];
            if (request.options.generateHelpers) {
                helpers = await this.generateHelpers(request.userPaths, request.framework, request.language);
                job.progress = 70;
            }
            // Generate main test files
            const testFiles = await this.generateTestFiles(request, analysis, pageObjects);
            job.progress = 85;
            // Generate configuration files
            const configFiles = await this.generateConfigFiles(request.framework, request.language);
            job.progress = 90;
            // Combine all generated files
            const allFiles = [...testFiles, ...pageObjects, ...fixtures, ...helpers, ...configFiles];
            // Validate generated code
            const validationResults = await this.validateGeneratedCode(allFiles);
            job.progress = 95;
            // Calculate metrics
            const metrics = this.calculateGenerationMetrics(allFiles, startTime);
            // Assess quality
            const quality = await this.assessCodeQuality(allFiles, validationResults);
            const endTime = new Date();
            const result = {
                id: jobId,
                request,
                files: allFiles,
                metrics,
                quality,
            };
            // Cache result if enabled
            if (this.config.cacheEnabled) {
                this.generationCache.set(cacheKey, result);
            }
            // Write files to disk
            await this.writeFilesToDisk(allFiles, request.options.outputDirectory);
            // Update job
            job.status = 'completed';
            job.progress = 100;
            job.endTime = endTime;
            job.result = result;
            this.updateMetrics(true, endTime.getTime() - startTime.getTime());
            this.monitoring?.recordHistogram('test_generation_duration', metrics.generationTime);
            this.monitoring?.recordGauge('tests_generated', metrics.testsGenerated);
            logger_1.logger.info('Test generation completed successfully', {
                jobId,
                files: result.files.length,
                tests: metrics.testsGenerated,
                pageObjects: metrics.pageObjectsGenerated,
                linesOfCode: metrics.linesOfCode,
                generationTime: metrics.generationTime,
            });
            return result;
        }
        catch (error) {
            job.status = 'failed';
            job.error = error instanceof Error ? error.message : String(error);
            job.endTime = new Date();
            this.updateMetrics(false, Date.now() - startTime.getTime());
            this.monitoring?.recordCounter('test_generation_errors', 1);
            logger_1.logger.error('Test generation failed', {
                jobId,
                error: job.error,
            });
            throw error;
        }
        finally {
            if (spanId) {
                this.monitoring?.endSpan(spanId);
            }
        }
    }
    /**
     * Get generation job status
     */
    getJobStatus(jobId) {
        return this.activeJobs.get(jobId) || null;
    }
    /**
     * Cancel a running generation job
     */
    async cancelJob(jobId) {
        const job = this.activeJobs.get(jobId);
        if (!job || job.status !== 'running') {
            return false;
        }
        job.status = 'failed';
        job.error = 'Job cancelled by user';
        job.endTime = new Date();
        logger_1.logger.info('Generation job cancelled', { jobId });
        return true;
    }
    /**
     * Register a custom generation template
     */
    registerTemplate(template) {
        this.templates.set(template.id, template);
        logger_1.logger.info('Registered custom generation template', {
            templateId: template.id,
            framework: template.framework,
            language: template.language,
        });
    }
    /**
     * Optimize test generation for better maintainability
     */
    async optimizeGeneration(userPaths) {
        const spanId = this.monitoring?.startSpan('generator_optimize');
        try {
            logger_1.logger.debug('Analyzing user paths for optimization opportunities');
            await this.analyzeUserPaths(userPaths);
            const recommendations = [];
            const pageObjectConsolidation = [];
            const duplicateTestElimination = [];
            const helperExtractions = [];
            // Analyze for page object consolidation opportunities
            const domainGroups = this.groupPathsByDomain(userPaths);
            for (const [domain, paths] of domainGroups.entries()) {
                if (paths.length > 3) {
                    pageObjectConsolidation.push(`Consider consolidating ${paths.length} paths for ${domain} into a shared page object`);
                }
            }
            // Analyze for duplicate test patterns
            const duplicatePatterns = this.findDuplicatePatterns(userPaths);
            for (const pattern of duplicatePatterns) {
                duplicateTestElimination.push(`Found ${pattern.count} similar test patterns: ${pattern.description}`);
            }
            // Analyze for helper extraction opportunities
            const commonOperations = this.findCommonOperations(userPaths);
            for (const operation of commonOperations) {
                if (operation.frequency > 3) {
                    helperExtractions.push(`Extract "${operation.name}" operation (used ${operation.frequency} times) into a helper function`);
                }
            }
            // Generate recommendations
            if (pageObjectConsolidation.length > 0) {
                recommendations.push('Consolidate page objects to reduce code duplication');
            }
            if (duplicateTestElimination.length > 0) {
                recommendations.push('Eliminate duplicate test patterns to improve maintainability');
            }
            if (helperExtractions.length > 0) {
                recommendations.push('Extract common operations into helper functions');
            }
            // Estimate improvements
            const estimatedImprovement = {
                maintainability: Math.min(0.9, (pageObjectConsolidation.length + duplicateTestElimination.length) * 0.1),
                performance: Math.min(0.8, duplicateTestElimination.length * 0.15),
                coverage: Math.min(0.95, helperExtractions.length * 0.05),
            };
            const result = {
                recommendations,
                optimizations: {
                    pageObjectConsolidation,
                    duplicateTestElimination,
                    helperExtractions,
                },
                estimatedImprovement,
            };
            this.monitoring?.recordCounter('optimization_analyses', 1);
            logger_1.logger.debug('Completed generation optimization analysis', {
                recommendations: recommendations.length,
                estimatedMaintainabilityImprovement: estimatedImprovement.maintainability,
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Failed to optimize generation', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
        finally {
            if (spanId) {
                this.monitoring?.endSpan(spanId);
            }
        }
    }
    /**
     * Analyze user paths to identify patterns and optimization opportunities
     */
    async analyzeUserPaths(userPaths) {
        const commonElements = new Map();
        const patternMap = new Map();
        const pageGroups = new Map();
        for (const userPath of userPaths) {
            // Group by domain/page
            const domain = new URL(userPath.url || userPath.startUrl).hostname;
            if (!pageGroups.has(domain)) {
                pageGroups.set(domain, []);
            }
            pageGroups.get(domain).push(userPath);
            // Analyze steps for common elements and patterns
            for (const step of userPath.steps) {
                if (step.selector || step.element?.selector) {
                    const selector = step.selector || step.element?.selector;
                    const count = commonElements.get(selector) || 0;
                    commonElements.set(selector, count + 1);
                }
                // Create pattern signature
                const pattern = `${step.type}:${(step.selector || step.element?.selector)
                    ?.split(/[#.\s]/)
                    .slice(0, 2)
                    .join('|') || 'no-selector'}`;
                const patternCount = patternMap.get(pattern) || 0;
                patternMap.set(pattern, patternCount + 1);
            }
        }
        const commonPatterns = Array.from(patternMap.entries())
            .map(([pattern, frequency]) => ({ pattern, frequency }))
            .filter((p) => p.frequency > 1)
            .sort((a, b) => b.frequency - a.frequency);
        // Calculate complexity score
        const avgStepsPerPath = userPaths.reduce((sum, userPath) => sum + userPath.steps.length, 0) / userPaths.length;
        const uniquePages = pageGroups.size;
        const complexityScore = Math.min(1, (avgStepsPerPath * uniquePages) / 100);
        return {
            commonElements,
            commonPatterns,
            pageGroups,
            complexityScore,
        };
    }
    /**
     * Generate page object files
     */
    async generatePageObjects(userPaths, framework, language) {
        const pageObjects = [];
        const pageGroups = this.groupPathsByDomain(userPaths);
        for (const [domain, paths] of pageGroups.entries()) {
            try {
                // Generate page objects for all paths in this domain
                const generatedFiles = paths.flatMap((path) => this.pageObjectGenerator.generateFromPath(path));
                // Convert TestFile[] to GeneratedFile[]
                const convertedFiles = generatedFiles.map((f) => ({
                    path: path_1.default.join(f.path, f.filename),
                    content: f.content,
                    type: f.type,
                    framework: f.metadata.framework,
                    language: f.metadata.language,
                }));
                pageObjects.push(...convertedFiles);
            }
            catch (error) {
                logger_1.logger.warn(`Failed to generate page object for ${domain}`, {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        return pageObjects;
    }
    /**
     * Generate test fixture files
     */
    async generateFixtures(userPaths, language) {
        const fixtures = [];
        try {
            // Analyze user paths to extract test data
            const testData = this.extractTestData(userPaths);
            // Generate fixture content based on language
            const fixtureContent = this.generateFixtureContent(testData, language);
            fixtures.push({
                path: `fixtures/testData.${this.getFileExtension(language)}`,
                content: fixtureContent,
                type: 'fixture',
                framework: '',
                language,
            });
            // Generate user-specific fixtures
            const userFixtures = this.generateUserFixtures(userPaths, language);
            fixtures.push(...userFixtures);
        }
        catch (error) {
            logger_1.logger.warn('Failed to generate fixtures', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        return fixtures;
    }
    /**
     * Generate helper utility files
     */
    async generateHelpers(userPaths, framework, language) {
        const helpers = [];
        try {
            // Identify common operations
            const commonOperations = this.findCommonOperations(userPaths);
            // Generate authentication helper if needed
            if (this.needsAuthHelper(userPaths)) {
                const authHelper = this.generateAuthHelper(framework, language);
                helpers.push(authHelper);
            }
            // Generate navigation helper
            const navHelper = this.generateNavigationHelper(framework, language);
            helpers.push(navHelper);
            // Generate form interaction helper
            if (this.needsFormHelper(userPaths)) {
                const formHelper = this.generateFormHelper(framework, language);
                helpers.push(formHelper);
            }
            // Generate custom helpers for common operations
            for (const operation of commonOperations) {
                if (operation.frequency > 3) {
                    const customHelper = this.generateCustomHelper(operation, framework, language);
                    helpers.push(customHelper);
                }
            }
        }
        catch (error) {
            logger_1.logger.warn('Failed to generate helpers', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        return helpers;
    }
    /**
     * Generate main test files
     */
    async generateTestFiles(request, analysis, pageObjects) {
        const testFiles = [];
        // Group user paths by logical test suites
        const testSuites = this.groupPathsIntoTestSuites(request.userPaths, analysis);
        for (const suite of testSuites) {
            try {
                // Generate tests for each path in the suite
                for (const path of suite.paths) {
                    const testResult = await this.testGenerator.generate(path);
                    testFiles.push(...testResult.files.map((file) => ({
                        path: file.path,
                        content: file.content,
                        type: file.type,
                        framework: request.framework,
                        language: request.language,
                    })));
                }
            }
            catch (error) {
                logger_1.logger.warn(`Failed to generate test file for suite ${suite.name}`, {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        return testFiles;
    }
    /**
     * Generate configuration files
     */
    async generateConfigFiles(framework, language) {
        const configFiles = [];
        try {
            // Generate framework-specific config
            if (framework === 'playwright') {
                const playwrightConfig = this.generatePlaywrightConfig(language);
                configFiles.push(playwrightConfig);
            }
            else if (framework === 'cypress') {
                const cypressConfig = this.generateCypressConfig(language);
                configFiles.push(cypressConfig);
            }
            // Generate package.json entries
            const packageConfig = this.generatePackageConfig(framework, language);
            configFiles.push(packageConfig);
        }
        catch (error) {
            logger_1.logger.warn('Failed to generate config files', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        return configFiles;
    }
    /**
     * Validate generated code quality
     */
    async validateGeneratedCode(files) {
        const syntaxErrors = [];
        const lintingResults = [];
        const typeErrors = [];
        for (const file of files) {
            try {
                // Validate syntax
                // Convert GeneratedFile to TestFile for validation
                const testFile = {
                    filename: path_1.default.basename(file.path),
                    path: path_1.default.dirname(file.path),
                    content: file.content,
                    type: file.type,
                    metadata: {
                        generatedAt: new Date(),
                        sourcePath: {},
                        framework: file.framework,
                        language: file.language,
                        dependencies: [],
                    },
                };
                const syntaxResult = await this.testValidator.validateTestFile(testFile);
                if (!syntaxResult.isValid) {
                    syntaxErrors.push({
                        file: file.path,
                        errors: syntaxResult.errors.map((e) => e.message),
                    });
                }
                // Run linting (not implemented in TestValidator)
                // const lintResult = await this.testValidator.runLinting(file.content, file.language);
                lintingResults.push({
                    file: file.path,
                    score: 100, // Default score
                    issues: [],
                });
                // Type checking for TypeScript files (not implemented in TestValidator)
                // if (file.language === 'typescript') {
                //   const typeResult = await this.testValidator.checkTypes(file.content);
                //   if (!typeResult.isValid) {
                //     typeErrors.push({
                //       file: file.path,
                //       errors: typeResult.errors || [],
                //     });
                //   }
                // }
            }
            catch (error) {
                logger_1.logger.warn(`Failed to validate file ${file.path}`, {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        return { syntaxErrors, lintingResults, typeErrors };
    }
    /**
     * Write generated files to disk
     */
    async writeFilesToDisk(files, outputDirectory) {
        try {
            // Convert GeneratedFile[] to the format expected by TestFileWriter
            const testFiles = files.map((file) => ({
                filename: path_1.default.basename(file.path),
                path: path_1.default.dirname(file.path),
                content: file.content,
                type: file.type,
                metadata: {
                    generatedAt: new Date(),
                    sourcePath: {}, // Placeholder since we don't have source path
                    framework: file.framework,
                    language: file.language,
                    dependencies: [],
                },
            }));
            const result = {
                files: testFiles,
                summary: {
                    totalFiles: testFiles.length,
                    testFiles: testFiles.filter((f) => f.type === 'test').length,
                    pageObjects: testFiles.filter((f) => f.type === 'page-object').length,
                    fixtures: testFiles.filter((f) => f.type === 'fixture').length,
                    helpers: testFiles.filter((f) => f.type === 'helper').length,
                    totalTests: 0,
                    totalAssertions: 0,
                    estimatedDuration: 0,
                },
                errors: [],
            };
            await this.testFileWriter.writeFiles(result);
            logger_1.logger.info(`Successfully wrote ${files.length} files to ${outputDirectory}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to write files to disk', {
                outputDirectory,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    /**
     * Generate cache key for request
     */
    generateCacheKey(request) {
        const pathsHash = request.userPaths
            .map((p) => `${p.url}:${p.steps.length}`)
            .sort()
            .join('|');
        return `${request.framework}:${request.language}:${pathsHash}`;
    }
    /**
     * Calculate generation metrics
     */
    calculateGenerationMetrics(files, startTime) {
        const endTime = new Date();
        return {
            testsGenerated: files.filter((f) => f.type === 'test').length,
            pageObjectsGenerated: files.filter((f) => f.type === 'page-object').length,
            linesOfCode: files.reduce((sum, f) => sum + f.content.split('\n').length, 0),
            generationTime: endTime.getTime() - startTime.getTime(),
        };
    }
    /**
     * Assess code quality
     */
    async assessCodeQuality(files, validationResults) {
        const syntaxValid = validationResults.syntaxErrors.length === 0;
        const avgLintScore = validationResults.lintingResults.length > 0
            ? validationResults.lintingResults.reduce((sum, r) => sum + r.score, 0) /
                validationResults.lintingResults.length
            : 0;
        // Simplified test coverage calculation
        const testCoverage = Math.min(1, files.filter((f) => f.type === 'test').length / Math.max(1, files.length * 0.3));
        return {
            syntaxValid,
            lintScore: avgLintScore,
            testCoverage,
        };
    }
    // Additional helper methods would go here...
    /**
     * Group paths by domain
     */
    groupPathsByDomain(userPaths) {
        const groups = new Map();
        for (const userPath of userPaths) {
            try {
                const domain = new URL(userPath.url || userPath.startUrl).hostname;
                if (!groups.has(domain)) {
                    groups.set(domain, []);
                }
                groups.get(domain).push(userPath);
            }
            catch (error) {
                // Skip invalid URLs
                continue;
            }
        }
        return groups;
    }
    /**
     * Generate page object name from domain
     */
    generatePageObjectName(domain) {
        return `${domain.replace(/[^a-zA-Z0-9]/g, '').replace(/^./, (match) => match.toUpperCase())}Page`;
    }
    /**
     * Get file extension for language
     */
    getFileExtension(language) {
        const extensions = {
            typescript: 'ts',
            javascript: 'js',
            python: 'py',
            java: 'java',
        };
        return extensions[language] || 'txt';
    }
    /**
     * Extract test data from user paths
     */
    extractTestData(userPaths) {
        const testData = {
            users: [],
            forms: [],
            navigation: [],
        };
        for (const userPath of userPaths) {
            for (const step of userPath.steps) {
                if (step.type === 'type' && step.value) {
                    const selector = step.selector || step.element?.selector || '';
                    if (selector.includes('email') || selector.includes('username')) {
                        testData.users.push({
                            email: String(step.value),
                            username: String(step.value),
                        });
                    }
                }
            }
        }
        return testData;
    }
    /**
     * Generate fixture content
     */
    generateFixtureContent(testData, language) {
        if (language === 'typescript' || language === 'javascript') {
            return `export const testData = ${JSON.stringify(testData, null, 2)};`;
        }
        if (language === 'python') {
            return `test_data = ${JSON.stringify(testData, null, 2).replace(/"/g, "'")}`;
        }
        return JSON.stringify(testData, null, 2);
    }
    /**
     * Generate user fixtures
     */
    generateUserFixtures(_userPaths, _language) {
        // Implementation would generate user-specific fixture files
        return [];
    }
    /**
     * Find common operations in user paths
     */
    findCommonOperations(userPaths) {
        const operations = new Map();
        for (const userPath of userPaths) {
            for (const step of userPath.steps) {
                const selector = step.selector || step.element?.selector || '';
                const operation = `${step.type}:${selector
                    .split(/[#.\s]/)
                    .slice(0, 2)
                    .join('|') || 'generic'}`;
                operations.set(operation, (operations.get(operation) || 0) + 1);
            }
        }
        return Array.from(operations.entries())
            .map(([pattern, frequency]) => ({
            name: pattern.split(':')[1],
            frequency,
            pattern,
        }))
            .filter((op) => op.frequency > 2)
            .sort((a, b) => b.frequency - a.frequency);
    }
    /**
     * Check if authentication helper is needed
     */
    needsAuthHelper(userPaths) {
        return userPaths.some((userPath) => userPath.steps.some((step) => {
            const selector = step.selector || step.element?.selector || '';
            return (selector.includes('login') || selector.includes('password') || selector.includes('auth'));
        }));
    }
    /**
     * Generate authentication helper
     */
    generateAuthHelper(framework, language) {
        const ext = this.getFileExtension(language);
        const content = this.generateHelperTemplate('auth', framework, language);
        return {
            path: `helpers/authHelper.${ext}`,
            content,
            type: 'helper',
            framework,
            language,
        };
    }
    /**
     * Generate navigation helper
     */
    generateNavigationHelper(framework, language) {
        const ext = this.getFileExtension(language);
        const content = this.generateHelperTemplate('navigation', framework, language);
        return {
            path: `helpers/navigationHelper.${ext}`,
            content,
            type: 'helper',
            framework,
            language,
        };
    }
    /**
     * Check if form helper is needed
     */
    needsFormHelper(userPaths) {
        return userPaths.some((userPath) => userPath.steps.some((step) => step.type === 'type' ||
            step.type === 'select' ||
            (step.selector || step.element?.selector || '').includes('form')));
    }
    /**
     * Generate form helper
     */
    generateFormHelper(framework, language) {
        const ext = this.getFileExtension(language);
        const content = this.generateHelperTemplate('form', framework, language);
        return {
            path: `helpers/formHelper.${ext}`,
            content,
            type: 'helper',
            framework,
            language,
        };
    }
    /**
     * Generate custom helper
     */
    generateCustomHelper(operation, framework, language) {
        const ext = this.getFileExtension(language);
        const content = this.generateCustomHelperContent(operation, framework, language);
        return {
            path: `helpers/${operation.name}Helper.${ext}`,
            content,
            type: 'helper',
            framework,
            language,
        };
    }
    /**
     * Generate helper template
     */
    generateHelperTemplate(type, framework, language) {
        // This would return framework and language specific helper templates
        return `// ${type} helper for ${framework} in ${language}\n// Implementation would go here`;
    }
    /**
     * Generate custom helper content
     */
    generateCustomHelperContent(operation, _framework, _language) {
        return `// Custom helper for ${operation.name} (used ${operation.frequency} times)\n// Implementation would go here`;
    }
    /**
     * Group paths into test suites
     */
    groupPathsIntoTestSuites(userPaths, analysis) {
        const suites = [];
        // Group by domain first
        for (const [domain, paths] of analysis.pageGroups.entries()) {
            suites.push({
                name: `${domain} Tests`,
                paths,
            });
        }
        return suites;
    }
    /**
     * Find duplicate patterns
     */
    findDuplicatePatterns(userPaths) {
        const patterns = new Map();
        for (const userPath of userPaths) {
            const signature = userPath.steps
                .map((s) => `${s.type}:${(s.selector || s.element?.selector || '').split(/[#.\s]/)[0] || 'none'}`)
                .join('->');
            patterns.set(signature, (patterns.get(signature) || 0) + 1);
        }
        return Array.from(patterns.entries())
            .filter(([_, count]) => count > 1)
            .map(([signature, count]) => ({
            description: signature,
            count,
        }));
    }
    /**
     * Generate Playwright config
     */
    generatePlaywrightConfig(language) {
        const ext = language === 'typescript' ? 'ts' : 'js';
        const content = `// Playwright configuration
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});`;
        return {
            path: `playwright.config.${ext}`,
            content,
            type: 'config',
            framework: 'playwright',
            language,
        };
    }
    /**
     * Generate Cypress config
     */
    generateCypressConfig(language) {
        const content = `// Cypress configuration
module.exports = {
  e2e: {
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
  },
};`;
        return {
            path: 'cypress.config.js',
            content,
            type: 'config',
            framework: 'cypress',
            language,
        };
    }
    /**
     * Generate package config
     */
    generatePackageConfig(framework, language) {
        const scripts = {};
        if (framework === 'playwright') {
            scripts.test = 'playwright test';
            scripts['test:headed'] = 'playwright test --headed';
            scripts['test:debug'] = 'playwright test --debug';
        }
        else if (framework === 'cypress') {
            scripts.test = 'cypress run';
            scripts['test:open'] = 'cypress open';
        }
        const packageInfo = {
            scripts,
            devDependencies: this.getFrameworkDependencies(framework, language),
        };
        return {
            path: 'package.partial.json',
            content: JSON.stringify(packageInfo, null, 2),
            type: 'config',
            framework,
            language,
        };
    }
    /**
     * Get framework dependencies
     */
    getFrameworkDependencies(framework, language) {
        const deps = {};
        if (framework === 'playwright') {
            deps['@playwright/test'] = '^1.40.0';
            if (language === 'typescript') {
                deps.typescript = '^5.0.0';
            }
        }
        else if (framework === 'cypress') {
            deps.cypress = '^13.0.0';
            if (language === 'typescript') {
                deps.typescript = '^5.0.0';
            }
        }
        return deps;
    }
    /**
     * Load default templates
     */
    loadDefaultTemplates() {
        // Load default templates for different frameworks and languages
        // This would typically load from external template files
    }
    /**
     * Update agent metrics
     */
    updateMetrics(success, duration) {
        this.metrics.tasksCompleted++;
        if (success) {
            this.metrics.tasksSuccessful++;
        }
        else {
            this.metrics.tasksFailed++;
        }
        this.metrics.averageTaskDuration =
            (this.metrics.averageTaskDuration * (this.metrics.tasksCompleted - 1) + duration) /
                this.metrics.tasksCompleted;
        this.metrics.totalRuntime += duration;
        this.metrics.lastActivity = new Date();
        const memUsage = process.memoryUsage();
        this.metrics.memoryUsage = memUsage.heapUsed;
    }
    /**
     * Set up event handlers
     */
    setupEventHandlers() {
        // this.on('error', (error) => {
        // logger.error('GeneratorAgent error', {
        //   error: error.message,
        //   stack: error.stack,
        // });
        // this.monitoring?.recordCounter('agent_errors', 1, { type: 'generator' });
        // });
        // Cleanup old jobs periodically
        setInterval(() => {
            this.cleanupOldJobs();
        }, 300000); // Every 5 minutes
    }
    /**
     * Clean up old jobs
     */
    cleanupOldJobs() {
        const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
        for (const [jobId, job] of this.activeJobs.entries()) {
            if (job.startTime.getTime() < cutoffTime &&
                (job.status === 'completed' || job.status === 'failed')) {
                this.activeJobs.delete(jobId);
            }
        }
    }
    /**
     * Get all active jobs
     */
    getActiveJobs() {
        return Array.from(this.activeJobs.values());
    }
    /**
     * Clear cache
     */
    clearCache() {
        this.generationCache.clear();
        logger_1.logger.info('Generation cache cleared');
    }
}
exports.GeneratorAgent = GeneratorAgent;
//# sourceMappingURL=GeneratorAgent.js.map