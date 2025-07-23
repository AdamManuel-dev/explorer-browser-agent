"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestFileWriter = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const logger_1 = require("../utils/logger");
class TestFileWriter {
    baseDirectory;
    constructor(baseDirectory) {
        this.baseDirectory = baseDirectory;
    }
    async writeFiles(result) {
        logger_1.logger.info('Writing test files', {
            totalFiles: result.files.length,
            baseDirectory: this.baseDirectory,
        });
        // Create base directory if it doesn't exist
        await this.ensureDirectory(this.baseDirectory);
        // Write each file
        for (const file of result.files) {
            await this.writeFile(file);
        }
        // Write summary report
        await this.writeSummaryReport(result);
        logger_1.logger.info('Test files written successfully', {
            filesWritten: result.files.length,
        });
    }
    async writeFile(file) {
        try {
            // Construct full path
            const directory = path.join(this.baseDirectory, file.path);
            const fullPath = path.join(directory, file.filename);
            // Ensure directory exists
            await this.ensureDirectory(directory);
            // Write file
            await fs.writeFile(fullPath, file.content, 'utf8');
            logger_1.logger.debug('Wrote test file', {
                path: fullPath,
                type: file.type,
                size: file.content.length,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to write test file', {
                filename: file.filename,
                error,
            });
            throw error;
        }
    }
    async writeSummaryReport(result) {
        const reportPath = path.join(this.baseDirectory, 'test-generation-report.json');
        const report = {
            generatedAt: new Date().toISOString(),
            summary: result.summary,
            files: result.files.map((f) => ({
                filename: f.filename,
                path: f.path,
                type: f.type,
                size: f.content.length,
                metadata: f.metadata,
            })),
            errors: result.errors,
        };
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
        // Also write a markdown summary
        await this.writeMarkdownSummary(result);
    }
    async writeMarkdownSummary(result) {
        const summaryPath = path.join(this.baseDirectory, 'README.md');
        const lines = [
            '# Generated Tests',
            '',
            `Generated on: ${new Date().toLocaleString()}`,
            '',
            '## Summary',
            '',
            `- Total Files: ${result.summary.totalFiles}`,
            `- Test Files: ${result.summary.testFiles}`,
            `- Page Objects: ${result.summary.pageObjects}`,
            `- Total Tests: ${result.summary.totalTests}`,
            `- Total Assertions: ${result.summary.totalAssertions}`,
            `- Estimated Duration: ${Math.round(result.summary.estimatedDuration / 1000)}s`,
            '',
            '## Files Generated',
            '',
        ];
        // Group files by type
        const filesByType = this.groupFilesByType(result.files);
        for (const [type, files] of Object.entries(filesByType)) {
            lines.push(`### ${this.formatFileType(type)}`);
            lines.push('');
            for (const file of files) {
                const filePath = path.join(file.path, file.filename);
                lines.push(`- \`${filePath}\``);
            }
            lines.push('');
        }
        // Add errors if any
        if (result.errors.length > 0) {
            lines.push('## Generation Errors');
            lines.push('');
            for (const error of result.errors) {
                lines.push(`- **${error.severity}**: ${error.error}`);
            }
            lines.push('');
        }
        // Add running instructions
        lines.push('## Running the Tests');
        lines.push('');
        lines.push('```bash');
        lines.push('# Install dependencies');
        lines.push('npm install');
        lines.push('');
        lines.push('# Run all tests');
        lines.push('npm test');
        lines.push('');
        lines.push('# Run specific test file');
        lines.push('npx playwright test tests/your-test.spec.ts');
        lines.push('```');
        await fs.writeFile(summaryPath, lines.join('\n'), 'utf8');
    }
    async ensureDirectory(directory) {
        try {
            await fs.access(directory);
        }
        catch {
            await fs.mkdir(directory, { recursive: true });
        }
    }
    groupFilesByType(files) {
        const groups = {};
        for (const file of files) {
            if (!groups[file.type]) {
                groups[file.type] = [];
            }
            groups[file.type].push(file);
        }
        return groups;
    }
    formatFileType(type) {
        const typeNames = {
            test: 'Test Files',
            'page-object': 'Page Objects',
            fixture: 'Fixtures',
            helper: 'Helper Functions',
            config: 'Configuration Files',
        };
        return typeNames[type] || type;
    }
    async createProjectStructure() {
        const directories = ['tests', 'pages', 'fixtures', 'helpers', 'screenshots', 'reports'];
        for (const dir of directories) {
            await this.ensureDirectory(path.join(this.baseDirectory, dir));
        }
        // Create basic configuration files
        await this.createPlaywrightConfig();
        await this.createPackageJson();
        await this.createGitignore();
    }
    async createPlaywrightConfig() {
        const configPath = path.join(this.baseDirectory, 'playwright.config.ts');
        const config = `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
`;
        await fs.writeFile(configPath, config, 'utf8');
    }
    async createPackageJson() {
        const packagePath = path.join(this.baseDirectory, 'package.json');
        // Check if already exists
        try {
            await fs.access(packagePath);
            return; // Don't overwrite existing package.json
        }
        catch {
            // File doesn't exist, create it
        }
        const packageJson = {
            name: 'browser-explorer-tests',
            version: '1.0.0',
            description: 'Automated tests generated by Browser Explorer',
            scripts: {
                test: 'playwright test',
                'test:ui': 'playwright test --ui',
                'test:debug': 'playwright test --debug',
                'test:report': 'playwright show-report',
            },
            devDependencies: {
                '@playwright/test': '^1.40.0',
                '@types/node': '^20.0.0',
                typescript: '^5.0.0',
            },
        };
        await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2), 'utf8');
    }
    async createGitignore() {
        const gitignorePath = path.join(this.baseDirectory, '.gitignore');
        const gitignore = `node_modules/
/test-results/
/playwright-report/
/playwright/.cache/
screenshots/
reports/
*.log
.env
`;
        await fs.writeFile(gitignorePath, gitignore, 'utf8');
    }
}
exports.TestFileWriter = TestFileWriter;
//# sourceMappingURL=TestFileWriter.js.map