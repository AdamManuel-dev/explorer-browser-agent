import { RedisConfig } from '../types/crawler';
import { logger } from '../utils/logger';

export class MockRedisClient {
  private store = new Map<string, string>();

  private lists = new Map<string, string[]>();

  private sets = new Map<string, Set<string>>();

  constructor(private config: RedisConfig) {}

  async connect(): Promise<void> {
    logger.debug('Mock Redis connected');
  }

  async disconnect(): Promise<void> {
    logger.debug('Mock Redis disconnected');
  }

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    this.store.set(key, value);
    // In real implementation, would set expiration
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
    this.lists.delete(key);
    this.sets.delete(key);
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.store.keys()).filter((key) => regex.test(key));
  }

  async lpush(key: string, value: string): Promise<void> {
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }
    this.lists.get(key)!.unshift(value);
  }

  async rpop(key: string): Promise<string | null> {
    const list = this.lists.get(key);
    return list && list.length > 0 ? list.pop() || null : null;
  }

  async llen(key: string): Promise<number> {
    const list = this.lists.get(key);
    return list ? list.length : 0;
  }

  async sadd(key: string, value: string): Promise<void> {
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set());
    }
    this.sets.get(key)!.add(value);
  }

  async sismember(key: string, value: string): Promise<boolean> {
    const set = this.sets.get(key);
    return set ? set.has(value) : false;
  }

  async scard(key: string): Promise<number> {
    const set = this.sets.get(key);
    return set ? set.size : 0;
  }
}
