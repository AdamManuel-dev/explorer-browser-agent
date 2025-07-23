#!/usr/bin/env node

import { Command } from 'commander';
import { BrowserExplorerCLI } from './BrowserExplorerCLI';
import { logger } from '../utils/logger';

const program = new Command();
const cli = new BrowserExplorerCLI();

program
  .name('browser-explorer')
  .description('AI-powered web browsing agent for automated test generation')
  .version('1.0.0');

// Crawl command
program
  .command('crawl')
  .description('Crawl a website and generate tests')
  .argument('<url>', 'URL to start crawling from')
  .option('-d, --max-depth <number>', 'Maximum crawl depth', '3')
  .option('-p, --max-pages <number>', 'Maximum pages to crawl', '100')
  .option('-o, --output <directory>', 'Output directory for tests', './generated-tests')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--headless', 'Run in headless mode', true)
  .option('--no-headless', 'Run with visible browser')
  .option('--delay <ms>', 'Delay between requests in milliseconds', '1000')
  .option('--workers <number>', 'Number of parallel workers', '5')
  .option('--framework <name>', 'Test framework (playwright|cypress|puppeteer)', 'playwright')
  .option('--language <lang>', 'Output language (typescript|javascript)', 'typescript')
  .option('--page-objects', 'Generate page objects', true)
  .option('--no-page-objects', 'Skip page object generation')
  .option('--auth', 'Enable authentication')
  .option('--auth-url <url>', 'Authentication URL')
  .option('--username <user>', 'Username for authentication')
  .option('--password <pass>', 'Password for authentication')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (url, options) => {
    await cli.crawl(url, options);
  });

// Test command
program
  .command('test')
  .description('Test the crawler on a single page')
  .argument('<url>', 'URL to test')
  .option('-o, --output <directory>', 'Output directory', './test-output')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--headless', 'Run in headless mode', true)
  .option('--no-headless', 'Run with visible browser')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (url, options) => {
    await cli.test(url, options);
  });

// Init command
program
  .command('init')
  .description('Initialize a new Browser Explorer project')
  .option('-f, --force', 'Overwrite existing configuration')
  .option('--config-only', 'Create only the configuration file')
  .action(async (options) => {
    await cli.init(options);
  });

// Config commands
const configCmd = program
  .command('config')
  .description('Configuration management');

configCmd
  .command('create')
  .description('Create a sample configuration file')
  .option('-f, --file <path>', 'Configuration file path', 'browser-explorer.config.yaml')
  .option('--force', 'Overwrite existing file')
  .action(async (options) => {
    await cli.createConfig(options);
  });

configCmd
  .command('validate')
  .description('Validate configuration file')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    await cli.validateConfig(options);
  });

// Server command (for API mode)
program
  .command('serve')
  .description('Start Browser Explorer as a web service')
  .option('-p, --port <number>', 'Port to listen on', '3000')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--cors', 'Enable CORS')
  .action(async (options) => {
    await cli.serve(options);
  });

// Debug command
program
  .command('debug')
  .description('Debug Browser Explorer components')
  .argument('<component>', 'Component to debug (crawler|detector|generator)')
  .argument('<url>', 'URL to test with')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-o, --output <directory>', 'Output directory', './debug-output')
  .action(async (component, url, options) => {
    await cli.debug(component, url, options);
  });

// Global error handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Parse command line arguments
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}