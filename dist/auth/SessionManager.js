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
exports.SessionManager = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const logger_1 = require("../utils/logger");
class SessionManager {
    config;
    memoryStore = new Map();
    cleanupInterval;
    constructor(config) {
        this.config = this.mergeWithDefaults(config || {});
        if (this.config.cleanup.enabled) {
            this.startCleanup();
        }
    }
    async saveSession(sessionId, session, domain, options) {
        logger_1.logger.debug('Saving session', { sessionId, domain, strategy: session.strategy });
        const storedSession = {
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
        logger_1.logger.info('Session saved successfully', {
            sessionId,
            domain,
            storage: this.config.storage.type,
        });
    }
    async loadSession(sessionId, domain) {
        logger_1.logger.debug('Loading session', { sessionId, domain });
        let storedSession = null;
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
            logger_1.logger.debug('Session not found', { sessionId, domain });
            return null;
        }
        // Check if session is expired
        if (storedSession.expiresAt && storedSession.expiresAt < new Date()) {
            logger_1.logger.debug('Session expired', { sessionId, domain });
            await this.deleteSession(sessionId, domain);
            return null;
        }
        // Update last accessed time
        storedSession.lastAccessed = new Date();
        await this.saveSession(sessionId, storedSession.session, domain);
        logger_1.logger.info('Session loaded successfully', {
            sessionId,
            domain,
            strategy: storedSession.session.strategy,
        });
        return storedSession.session;
    }
    async deleteSession(sessionId, domain) {
        logger_1.logger.debug('Deleting session', { sessionId, domain });
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
            default:
                throw new Error(`Unknown storage type: ${this.config.storage.type}`);
        }
        logger_1.logger.info('Session deleted successfully', { sessionId, domain });
    }
    async listSessions(domain) {
        let sessions = [];
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
            default:
                throw new Error(`Unknown storage type: ${this.config.storage.type}`);
        }
        if (domain) {
            sessions = sessions.filter((s) => s.domain === domain);
        }
        return sessions;
    }
    async restoreSessionToPage(page, sessionId, domain) {
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
            await page.evaluate(({ localStorage: localStorageData, sessionStorage: sessionStorageData }) => {
                // Restore localStorage
                Object.entries(localStorageData).forEach(([key, value]) => {
                    try {
                        window.localStorage.setItem(key, value);
                    }
                    catch (error) {
                        console.warn('Failed to restore localStorage item:', key, error);
                    }
                });
                // Restore sessionStorage
                Object.entries(sessionStorageData).forEach(([key, value]) => {
                    try {
                        window.sessionStorage.setItem(key, value);
                    }
                    catch (error) {
                        console.warn('Failed to restore sessionStorage item:', key, error);
                    }
                });
            }, {
                localStorage: session.localStorage || {},
                sessionStorage: session.sessionStorage || {},
            });
            logger_1.logger.info('Session restored to page successfully', { sessionId, domain });
            return true;
        }
        catch (error) {
            logger_1.logger.error('Failed to restore session to page', { sessionId, domain, error });
            return false;
        }
    }
    async captureSessionFromPage(page, sessionId, domain, strategy) {
        logger_1.logger.debug('Capturing session from page', { sessionId, domain, strategy });
        const context = page.context();
        // Capture cookies
        const cookies = await context.cookies();
        // Capture localStorage and sessionStorage
        const storageData = await page.evaluate(() => {
            const localStorage = {};
            const sessionStorage = {};
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
        const session = {
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
        logger_1.logger.info('Session captured from page successfully', { sessionId, domain, strategy });
        return session;
    }
    async cleanupExpiredSessions() {
        logger_1.logger.debug('Cleaning up expired sessions');
        const sessions = await this.listSessions();
        const now = new Date();
        let cleanedCount = 0;
        for (const storedSession of sessions) {
            const shouldCleanup = (storedSession.expiresAt && storedSession.expiresAt < now) ||
                now.getTime() - storedSession.lastAccessed.getTime() > this.config.cleanup.maxAge;
            if (shouldCleanup) {
                await this.deleteSession(storedSession.id, storedSession.domain);
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) {
            logger_1.logger.info('Cleaned up expired sessions', { count: cleanedCount });
        }
        return cleanedCount;
    }
    async getSessionStats() {
        const sessions = await this.listSessions();
        const now = new Date();
        const stats = {
            total: sessions.length,
            byDomain: {},
            byStrategy: {},
            expired: 0,
        };
        sessions.forEach((session) => {
            // Count by domain
            stats.byDomain[session.domain] = (stats.byDomain[session.domain] || 0) + 1;
            // Count by strategy
            stats.byStrategy[session.session.strategy] =
                (stats.byStrategy[session.session.strategy] || 0) + 1;
            // Count expired
            if (session.expiresAt && session.expiresAt < now) {
                stats.expired++;
            }
        });
        return stats;
    }
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
    // Private methods for file storage
    async saveToFile(storedSession) {
        const filePath = this.getSessionFilePath(storedSession.id, storedSession.domain);
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        const data = this.config.encryption.enabled
            ? this.encrypt(JSON.stringify(storedSession))
            : JSON.stringify(storedSession, null, 2);
        await fs.writeFile(filePath, data, 'utf8');
    }
    async loadFromFile(sessionId, domain) {
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
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }
    async deleteFromFile(sessionId, domain) {
        const filePath = this.getSessionFilePath(sessionId, domain);
        try {
            await fs.unlink(filePath);
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }
    async listFromFile() {
        const sessionsDir = path.join(this.config.storage.options?.filePath || './sessions');
        const sessions = [];
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
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                logger_1.logger.error('Error listing sessions from file', error);
            }
        }
        return sessions;
    }
    // Private methods for memory storage
    saveToMemory(storedSession) {
        const key = this.getMemoryKey(storedSession.id, storedSession.domain);
        this.memoryStore.set(key, storedSession);
    }
    loadFromMemory(sessionId, domain) {
        const key = this.getMemoryKey(sessionId, domain);
        return this.memoryStore.get(key) || null;
    }
    deleteFromMemory(sessionId, domain) {
        const key = this.getMemoryKey(sessionId, domain);
        this.memoryStore.delete(key);
    }
    // Private methods for Redis storage (placeholder - would need Redis client)
    async saveToRedis(storedSession) {
        // Implementation would require Redis client
        logger_1.logger.warn('Redis storage not implemented - falling back to memory');
        this.saveToMemory(storedSession);
    }
    async loadFromRedis(sessionId, domain) {
        // Implementation would require Redis client
        logger_1.logger.warn('Redis storage not implemented - falling back to memory');
        return this.loadFromMemory(sessionId, domain);
    }
    async deleteFromRedis(sessionId, domain) {
        // Implementation would require Redis client
        logger_1.logger.warn('Redis storage not implemented - falling back to memory');
        this.deleteFromMemory(sessionId, domain);
    }
    async listFromRedis() {
        // Implementation would require Redis client
        logger_1.logger.warn('Redis storage not implemented - falling back to memory');
        return Array.from(this.memoryStore.values());
    }
    // Helper methods
    getSessionFilePath(sessionId, domain) {
        const baseDir = this.config.storage.options?.filePath || './sessions';
        return path.join(baseDir, domain, `${sessionId}.json`);
    }
    getMemoryKey(sessionId, domain) {
        return `${domain}:${sessionId}`;
    }
    generateFingerprint(session) {
        const data = {
            strategy: session.strategy,
            userId: session.userId,
            cookieNames: session.cookies?.map((c) => c.name).sort(),
            localStorageKeys: Object.keys(session.localStorage || {}).sort(),
        };
        return Buffer.from(JSON.stringify(data)).toString('base64');
    }
    extractUserId(localStorage, cookies) {
        // Try to find user ID in common locations
        const userIdKeys = ['userId', 'user_id', 'uid', 'id', 'sub', 'email'];
        // Check localStorage
        for (const key of userIdKeys) {
            if (localStorage[key]) {
                return localStorage[key];
            }
        }
        // Check cookies
        const userCookie = cookies.find((cookie) => userIdKeys.includes(cookie.name.toLowerCase()));
        return userCookie?.value;
    }
    extractSessionToken(localStorage, sessionStorage, cookies) {
        const tokenKeys = ['token', 'accessToken', 'authToken', 'sessionToken', 'jwt'];
        // Check localStorage
        for (const key of tokenKeys) {
            if (localStorage[key])
                return localStorage[key];
        }
        // Check sessionStorage
        for (const key of tokenKeys) {
            if (sessionStorage[key])
                return sessionStorage[key];
        }
        // Check cookies
        const tokenCookie = cookies.find((cookie) => tokenKeys.some((key) => cookie.name.toLowerCase().includes(key.toLowerCase())));
        return tokenCookie?.value;
    }
    encrypt(data) {
        // Placeholder for encryption - would need crypto implementation
        return Buffer.from(data).toString('base64');
    }
    decrypt(data) {
        // Placeholder for decryption - would need crypto implementation
        return Buffer.from(data, 'base64').toString('utf8');
    }
    startCleanup() {
        this.cleanupInterval = setInterval(async () => {
            try {
                await this.cleanupExpiredSessions();
            }
            catch (error) {
                logger_1.logger.error('Error during session cleanup', error);
            }
        }, this.config.cleanup.interval);
    }
    mergeWithDefaults(config) {
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
exports.SessionManager = SessionManager;
//# sourceMappingURL=SessionManager.js.map