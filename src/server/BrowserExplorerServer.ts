import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { BrowserExplorer } from '../index';
import { BrowserExplorerConfig } from '../config';
import { CrawlResult } from '../types/crawler';
import { logger } from '../utils/logger';

export interface ServerOptions {
  port: number;
  config?: string;
  cors?: boolean;
}

export class BrowserExplorerServer {
  private app: Express;
  private browserExplorer: BrowserExplorer;
  private server: any;

  constructor(private options: ServerOptions) {
    this.app = express();
    this.browserExplorer = new BrowserExplorer();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    
    if (this.options.cors) {
      this.app.use(cors());
    }

    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, { 
        userAgent: req.get('User-Agent'),
        ip: req.ip 
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // Get current configuration
    this.app.get('/api/config', (req: Request, res: Response) => {
      try {
        const config = this.browserExplorer.getConfig();
        res.json({ config });
      } catch (error) {
        logger.error('Failed to get config', error);
        res.status(500).json({ 
          error: 'Failed to retrieve configuration',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Start exploration
    this.app.post('/api/explore', async (req: Request, res: Response) => {
      try {
        const { url, config } = req.body;
        
        if (!url) {
          return res.status(400).json({ 
            error: 'URL is required',
            message: 'Please provide a URL to explore'
          });
        }

        // Initialize with config if provided
        if (config) {
          await this.browserExplorer.initialize(config);
        }

        logger.info(`Starting exploration of ${url}`);
        const result = await this.browserExplorer.explore(url);
        
        res.json({ 
          success: true,
          result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Exploration failed', error);
        res.status(500).json({ 
          error: 'Exploration failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Get exploration status
    this.app.get('/api/status', (req: Request, res: Response) => {
      // TODO: Implement status tracking
      res.json({ 
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    });

    // Stop exploration
    this.app.post('/api/stop', async (req: Request, res: Response) => {
      try {
        await this.browserExplorer.cleanup();
        res.json({ 
          success: true,
          message: 'Exploration stopped successfully'
        });
      } catch (error) {
        logger.error('Failed to stop exploration', error);
        res.status(500).json({ 
          error: 'Failed to stop exploration',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Error handling middleware
    this.app.use((error: Error, req: Request, res: Response, next: any) => {
      logger.error('Unhandled server error', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.path} not found`
      });
    });
  }

  async start(): Promise<void> {
    try {
      // Initialize the browser explorer
      await this.browserExplorer.initialize(this.options.config);
      
      // Start the server
      this.server = this.app.listen(this.options.port, () => {
        logger.info(`🚀 Browser Explorer server started on port ${this.options.port}`);
        logger.info(`📡 API endpoints available:`);
        logger.info(`   GET  /health - Health check`);
        logger.info(`   GET  /api/config - Get configuration`);
        logger.info(`   POST /api/explore - Start exploration`);
        logger.info(`   GET  /api/status - Get status`);
        logger.info(`   POST /api/stop - Stop exploration`);
      });

      // Handle server errors
      this.server.on('error', (error: Error) => {
        logger.error('Server error', error);
      });

    } catch (error) {
      logger.error('Failed to start server', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close(async (error: Error) => {
        if (error) {
          logger.error('Error stopping server', error);
          reject(error);
          return;
        }

        try {
          await this.browserExplorer.cleanup();
          logger.info('🛑 Browser Explorer server stopped');
          resolve();
        } catch (cleanupError) {
          logger.error('Error during cleanup', cleanupError);
          reject(cleanupError);
        }
      });
    });
  }
}