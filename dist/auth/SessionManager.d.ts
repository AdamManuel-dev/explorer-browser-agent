import { Page } from 'playwright';
import { AuthSession, AuthStrategy } from './MultiStrategyAuthManager';
export interface SessionStorage {
    type: 'file' | 'memory' | 'redis';
    options?: {
        filePath?: string;
        redisUrl?: string;
        ttl?: number;
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
        interval: number;
        maxAge: number;
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
export declare class SessionManager {
    private config;
    private memoryStore;
    private cleanupInterval?;
    constructor(config?: Partial<SessionManagerConfig>);
    saveSession(sessionId: string, session: AuthSession, domain: string, options?: {
        ttl?: number;
        metadata?: Record<string, any>;
    }): Promise<void>;
    loadSession(sessionId: string, domain: string): Promise<AuthSession | null>;
    deleteSession(sessionId: string, domain: string): Promise<void>;
    listSessions(domain?: string): Promise<StoredSession[]>;
    restoreSessionToPage(page: Page, sessionId: string, domain: string): Promise<boolean>;
    captureSessionFromPage(page: Page, sessionId: string, domain: string, strategy: AuthStrategy): Promise<AuthSession>;
    cleanupExpiredSessions(): Promise<number>;
    getSessionStats(): Promise<{
        total: number;
        byDomain: Record<string, number>;
        byStrategy: Record<string, number>;
        expired: number;
    }>;
    destroy(): void;
    private saveToFile;
    private loadFromFile;
    private deleteFromFile;
    private listFromFile;
    private saveToMemory;
    private loadFromMemory;
    private deleteFromMemory;
    private saveToRedis;
    private loadFromRedis;
    private deleteFromRedis;
    private listFromRedis;
    private getSessionFilePath;
    private getMemoryKey;
    private generateFingerprint;
    private extractUserId;
    private extractSessionToken;
    private encrypt;
    private decrypt;
    private startCleanup;
    private mergeWithDefaults;
}
//# sourceMappingURL=SessionManager.d.ts.map