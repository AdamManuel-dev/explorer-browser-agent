import * as fs from 'fs/promises';
import * as path from 'path';
import { BrowserContext, Page } from 'playwright';
import { AuthSession, AuthStrategy } from './MultiStrategyAuthManager';
import { logger } from '../utils/logger';

export interface SessionStorage {
  type: 'file' | 'memory' | 'redis';
  options?: {
    filePath?: string;
    redisUrl?: string;
    ttl?: number; // Time to live in seconds
  };
}

export interface SessionManagerConfig {
  storage: SessionStorage;
  encryption: {
    enabled: boolean;
    algorithm?: string;
    key?: string;
  };
  cleanup: {
    enabled: boolean;
    interval: number; // ms
    maxAge: number; // ms
  };
}

export interface StoredSession {
  id: string;
  session: AuthSession;
  domain: string;
  createdAt: Date;
  lastAccessed: Date;
  expiresAt?: Date;
  metadata: {
    userAgent: string;
    fingerprint: string;
  };
}

export class SessionManager {
  private config: SessionManagerConfig;
  private memoryStore = new Map<string, StoredSession>();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config?: Partial<SessionManagerConfig>) {
    this.config = this.mergeWithDefaults(config || {});
    
    if (this.config.cleanup.enabled) {
      this.startCleanup();
    }
  }

  async saveSession(
    sessionId: string,
    session: AuthSession,
    domain: string,
    options?: {
      ttl?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    logger.debug('Saving session', { sessionId, domain, strategy: session.strategy });

    const storedSession: StoredSession = {
      id: sessionId,
      session,
      domain,
      createdAt: new Date(),
      lastAccessed: new Date(),
      expiresAt: options?.ttl ? new Date(Date.now() + options.ttl * 1000) : session.expiresAt,
      metadata: {
        userAgent: session.metadata?.userAgent || 'browser-explorer',
        fingerprint: this.generateFingerprint(session),
        ...options?.metadata,
      },
    };

    switch (this.config.storage.type) {
      case 'file':
        await this.saveToFile(storedSession);
        break;
      case 'memory':
        this.saveToMemory(storedSession);
        break;
      case 'redis':
        await this.saveToRedis(storedSession);
        break;
      default:
        throw new Error(`Unsupported storage type: ${this.config.storage.type}`);
    }

    logger.info('Session saved successfully', { 
      sessionId, 
      domain, 
      storage: this.config.storage.type 
    });
  }

  async loadSession(sessionId: string, domain: string): Promise<AuthSession | null> {
    logger.debug('Loading session', { sessionId, domain });

    let storedSession: StoredSession | null = null;

    switch (this.config.storage.type) {
      case 'file':
        storedSession = await this.loadFromFile(sessionId, domain);
        break;
      case 'memory':
        storedSession = this.loadFromMemory(sessionId, domain);
        break;
      case 'redis':
        storedSession = await this.loadFromRedis(sessionId, domain);
        break;
      default:
        throw new Error(`Unsupported storage type: ${this.config.storage.type}`);
    }

    if (!storedSession) {
      logger.debug('Session not found', { sessionId, domain });
      return null;
    }

    // Check if session is expired
    if (storedSession.expiresAt && storedSession.expiresAt < new Date()) {
      logger.debug('Session expired', { sessionId, domain });
      await this.deleteSession(sessionId, domain);
      return null;
    }

    // Update last accessed time
    storedSession.lastAccessed = new Date();
    await this.saveSession(sessionId, storedSession.session, domain);

    logger.info('Session loaded successfully', { 
      sessionId, 
      domain, 
      strategy: storedSession.session.strategy 
    });

    return storedSession.session;
  }

  async deleteSession(sessionId: string, domain: string): Promise<void> {
    logger.debug('Deleting session', { sessionId, domain });

    switch (this.config.storage.type) {
      case 'file':
        await this.deleteFromFile(sessionId, domain);
        break;
      case 'memory':
        this.deleteFromMemory(sessionId, domain);
        break;
      case 'redis':
        await this.deleteFromRedis(sessionId, domain);
        break;
    }

    logger.info('Session deleted successfully', { sessionId, domain });
  }

  async listSessions(domain?: string): Promise<StoredSession[]> {
    let sessions: StoredSession[] = [];

    switch (this.config.storage.type) {
      case 'file':
        sessions = await this.listFromFile();
        break;
      case 'memory':
        sessions = Array.from(this.memoryStore.values());
        break;
      case 'redis':
        sessions = await this.listFromRedis();
        break;
    }

    if (domain) {
      sessions = sessions.filter(s => s.domain === domain);
    }

    return sessions;
  }

  async restoreSessionToPage(
    page: Page,
    sessionId: string,
    domain: string
  ): Promise<boolean> {
    const session = await this.loadSession(sessionId, domain);
    if (!session) {
      return false;
    }

    try {
      const context = page.context();

      // Restore cookies
      if (session.cookies && session.cookies.length > 0) {
        await context.addCookies(session.cookies);
      }

      // Restore localStorage and sessionStorage
      await page.evaluate(
        ({ localStorage: localStorageData, sessionStorage: sessionStorageData }) => {
          // Restore localStorage
          Object.entries(localStorageData).forEach(([key, value]) => {
            try {
              window.localStorage.setItem(key, value);
            } catch (error) {
              console.warn('Failed to restore localStorage item:', key, error);
            }
          });

          // Restore sessionStorage
          Object.entries(sessionStorageData).forEach(([key, value]) => {
            try {
              window.sessionStorage.setItem(key, value);
            } catch (error) {
              console.warn('Failed to restore sessionStorage item:', key, error);
            }
          });
        },
        {
          localStorage: session.localStorage || {},
          sessionStorage: session.sessionStorage || {},
        }
      );

      logger.info('Session restored to page successfully', { sessionId, domain });
      return true;

    } catch (error) {
      logger.error('Failed to restore session to page', { sessionId, domain, error });
      return false;
    }
  }

  async captureSessionFromPage(
    page: Page,
    sessionId: string,
    domain: string,
    strategy: AuthStrategy
  ): Promise<AuthSession> {
    logger.debug('Capturing session from page', { sessionId, domain, strategy });

    const context = page.context();
    
    // Capture cookies
    const cookies = await context.cookies();

    // Capture localStorage and sessionStorage
    const storageData = await page.evaluate(() => {
      const localStorage: Record<string, string> = {};
      const sessionStorage: Record<string, string> = {};

      // Capture localStorage
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) {
          localStorage[key] = window.localStorage.getItem(key) || '';
        }
      }

      // Capture sessionStorage
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key) {
          sessionStorage[key] = window.sessionStorage.getItem(key) || '';
        }
      }

      return { localStorage, sessionStorage };
    });

    const session: AuthSession = {
      strategy,
      authenticated: true,
      userId: this.extractUserId(storageData.localStorage, cookies),
      sessionToken: this.extractSessionToken(storageData.localStorage, storageData.sessionStorage, cookies),
      cookies,
      localStorage: storageData.localStorage,
      sessionStorage: storageData.sessionStorage,
      metadata: {
        capturedAt: new Date().toISOString(),
        url: page.url(),
        title: await page.title().catch(() => ''),
        userAgent: await page.evaluate(() => navigator.userAgent),
      },
    };

    await this.saveSession(sessionId, session, domain);
    
    logger.info('Session captured from page successfully', { sessionId, domain, strategy });
    return session;
  }

  async cleanupExpiredSessions(): Promise<number> {
    logger.debug('Cleaning up expired sessions');

    const sessions = await this.listSessions();
    const now = new Date();
    let cleanedCount = 0;

    for (const storedSession of sessions) {
      const shouldCleanup = 
        (storedSession.expiresAt && storedSession.expiresAt < now) ||
        (now.getTime() - storedSession.lastAccessed.getTime() > this.config.cleanup.maxAge);

      if (shouldCleanup) {
        await this.deleteSession(storedSession.id, storedSession.domain);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up expired sessions', { count: cleanedCount });
    }

    return cleanedCount;
  }

  async getSessionStats(): Promise<{
    total: number;
    byDomain: Record<string, number>;
    byStrategy: Record<string, number>;
    expired: number;
  }> {
    const sessions = await this.listSessions();
    const now = new Date();

    const stats = {
      total: sessions.length,
      byDomain: {} as Record<string, number>,
      byStrategy: {} as Record<string, number>,
      expired: 0,
    };

    sessions.forEach(session => {
      // Count by domain
      stats.byDomain[session.domain] = (stats.byDomain[session.domain] || 0) + 1;

      // Count by strategy
      stats.byStrategy[session.session.strategy] = (stats.byStrategy[session.session.strategy] || 0) + 1;

      // Count expired
      if (session.expiresAt && session.expiresAt < now) {
        stats.expired++;
      }
    });

    return stats;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  // Private methods for file storage
  private async saveToFile(storedSession: StoredSession): Promise<void> {
    const filePath = this.getSessionFilePath(storedSession.id, storedSession.domain);
    const dir = path.dirname(filePath);
    
    await fs.mkdir(dir, { recursive: true });

    const data = this.config.encryption.enabled 
      ? this.encrypt(JSON.stringify(storedSession))
      : JSON.stringify(storedSession, null, 2);

    await fs.writeFile(filePath, data, 'utf8');
  }

  private async loadFromFile(sessionId: string, domain: string): Promise<StoredSession | null> {
    const filePath = this.getSessionFilePath(sessionId, domain);
    
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const content = this.config.encryption.enabled ? this.decrypt(data) : data;
      
      const storedSession = JSON.parse(content);
      
      // Convert date strings back to Date objects
      storedSession.createdAt = new Date(storedSession.createdAt);
      storedSession.lastAccessed = new Date(storedSession.lastAccessed);
      if (storedSession.expiresAt) {
        storedSession.expiresAt = new Date(storedSession.expiresAt);
      }
      if (storedSession.session.expiresAt) {
        storedSession.session.expiresAt = new Date(storedSession.session.expiresAt);
      }

      return storedSession;

    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  private async deleteFromFile(sessionId: string, domain: string): Promise<void> {
    const filePath = this.getSessionFilePath(sessionId, domain);
    
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private async listFromFile(): Promise<StoredSession[]> {
    const sessionsDir = path.join(this.config.storage.options?.filePath || './sessions');
    const sessions: StoredSession[] = [];

    try {
      const domains = await fs.readdir(sessionsDir);
      
      for (const domain of domains) {
        const domainDir = path.join(sessionsDir, domain);
        const sessionFiles = await fs.readdir(domainDir);
        
        for (const file of sessionFiles) {
          if (file.endsWith('.json')) {
            const sessionId = path.basename(file, '.json');
            const session = await this.loadFromFile(sessionId, domain);
            if (session) {
              sessions.push(session);
            }
          }
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error('Error listing sessions from file', error);
      }
    }

    return sessions;
  }

  // Private methods for memory storage
  private saveToMemory(storedSession: StoredSession): void {
    const key = this.getMemoryKey(storedSession.id, storedSession.domain);
    this.memoryStore.set(key, storedSession);
  }

  private loadFromMemory(sessionId: string, domain: string): StoredSession | null {
    const key = this.getMemoryKey(sessionId, domain);
    return this.memoryStore.get(key) || null;
  }

  private deleteFromMemory(sessionId: string, domain: string): void {
    const key = this.getMemoryKey(sessionId, domain);
    this.memoryStore.delete(key);
  }

  // Private methods for Redis storage (placeholder - would need Redis client)
  private async saveToRedis(storedSession: StoredSession): Promise<void> {
    // Implementation would require Redis client
    logger.warn('Redis storage not implemented - falling back to memory');
    this.saveToMemory(storedSession);
  }

  private async loadFromRedis(sessionId: string, domain: string): Promise<StoredSession | null> {
    // Implementation would require Redis client
    logger.warn('Redis storage not implemented - falling back to memory');
    return this.loadFromMemory(sessionId, domain);
  }

  private async deleteFromRedis(sessionId: string, domain: string): Promise<void> {
    // Implementation would require Redis client
    logger.warn('Redis storage not implemented - falling back to memory');
    this.deleteFromMemory(sessionId, domain);
  }

  private async listFromRedis(): Promise<StoredSession[]> {
    // Implementation would require Redis client
    logger.warn('Redis storage not implemented - falling back to memory');
    return Array.from(this.memoryStore.values());
  }

  // Helper methods
  private getSessionFilePath(sessionId: string, domain: string): string {
    const baseDir = this.config.storage.options?.filePath || './sessions';
    return path.join(baseDir, domain, `${sessionId}.json`);
  }

  private getMemoryKey(sessionId: string, domain: string): string {
    return `${domain}:${sessionId}`;
  }

  private generateFingerprint(session: AuthSession): string {
    const data = {
      strategy: session.strategy,
      userId: session.userId,
      cookieNames: session.cookies?.map(c => c.name).sort(),
      localStorageKeys: Object.keys(session.localStorage || {}).sort(),
    };
    
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  private extractUserId(localStorage: Record<string, string>, cookies: any[]): string | undefined {
    // Try to find user ID in common locations
    const userIdKeys = ['userId', 'user_id', 'uid', 'id', 'sub', 'email'];
    
    // Check localStorage
    for (const key of userIdKeys) {
      if (localStorage[key]) {
        return localStorage[key];
      }
    }

    // Check cookies
    const userCookie = cookies.find(cookie => 
      userIdKeys.includes(cookie.name.toLowerCase())
    );
    
    return userCookie?.value;
  }

  private extractSessionToken(
    localStorage: Record<string, string>,
    sessionStorage: Record<string, string>,
    cookies: any[]
  ): string | undefined {
    const tokenKeys = ['token', 'accessToken', 'authToken', 'sessionToken', 'jwt'];
    
    // Check localStorage
    for (const key of tokenKeys) {
      if (localStorage[key]) return localStorage[key];
    }

    // Check sessionStorage
    for (const key of tokenKeys) {
      if (sessionStorage[key]) return sessionStorage[key];
    }

    // Check cookies
    const tokenCookie = cookies.find(cookie => 
      tokenKeys.some(key => cookie.name.toLowerCase().includes(key.toLowerCase()))
    );

    return tokenCookie?.value;
  }

  private encrypt(data: string): string {
    // Placeholder for encryption - would need crypto implementation
    return Buffer.from(data).toString('base64');
  }

  private decrypt(data: string): string {
    // Placeholder for decryption - would need crypto implementation
    return Buffer.from(data, 'base64').toString('utf8');
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupExpiredSessions();
      } catch (error) {
        logger.error('Error during session cleanup', error);
      }
    }, this.config.cleanup.interval);
  }

  private mergeWithDefaults(config: Partial<SessionManagerConfig>): SessionManagerConfig {
    return {
      storage: {
        type: 'file',
        options: {
          filePath: './sessions',
          ttl: 7 * 24 * 60 * 60, // 7 days
        },
        ...config.storage,
      },
      encryption: {
        enabled: false,
        algorithm: 'aes-256-gcm',
        ...config.encryption,
      },
      cleanup: {
        enabled: true,
        interval: 60 * 60 * 1000, // 1 hour
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        ...config.cleanup,
      },
    };
  }
}