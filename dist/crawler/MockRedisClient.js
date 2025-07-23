"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockRedisClient = void 0;
const logger_1 = require("../utils/logger");
class MockRedisClient {
    config;
    store = new Map();
    lists = new Map();
    sets = new Map();
    constructor(config) {
        this.config = config;
    }
    async connect() {
        logger_1.logger.debug('Mock Redis connected');
    }
    async disconnect() {
        logger_1.logger.debug('Mock Redis disconnected');
    }
    async get(key) {
        return this.store.get(key) || null;
    }
    async set(key, value) {
        this.store.set(key, value);
    }
    async setex(key, seconds, value) {
        this.store.set(key, value);
        // In real implementation, would set expiration
    }
    async del(key) {
        this.store.delete(key);
        this.lists.delete(key);
        this.sets.delete(key);
    }
    async keys(pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return Array.from(this.store.keys()).filter((key) => regex.test(key));
    }
    async lpush(key, value) {
        if (!this.lists.has(key)) {
            this.lists.set(key, []);
        }
        this.lists.get(key).unshift(value);
    }
    async rpop(key) {
        const list = this.lists.get(key);
        return list && list.length > 0 ? list.pop() || null : null;
    }
    async llen(key) {
        const list = this.lists.get(key);
        return list ? list.length : 0;
    }
    async sadd(key, value) {
        if (!this.sets.has(key)) {
            this.sets.set(key, new Set());
        }
        this.sets.get(key).add(value);
    }
    async sismember(key, value) {
        const set = this.sets.get(key);
        return set ? set.has(value) : false;
    }
    async scard(key) {
        const set = this.sets.get(key);
        return set ? set.size : 0;
    }
}
exports.MockRedisClient = MockRedisClient;
//# sourceMappingURL=MockRedisClient.js.map