import { RedisConfig } from '../types/crawler';
export declare class MockRedisClient {
    private config;
    private store;
    private lists;
    private sets;
    constructor(config: RedisConfig);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    setex(key: string, seconds: number, value: string): Promise<void>;
    del(key: string): Promise<void>;
    keys(pattern: string): Promise<string[]>;
    lpush(key: string, value: string): Promise<void>;
    rpop(key: string): Promise<string | null>;
    llen(key: string): Promise<number>;
    sadd(key: string, value: string): Promise<void>;
    sismember(key: string, value: string): Promise<boolean>;
    scard(key: string): Promise<number>;
}
//# sourceMappingURL=MockRedisClient.d.ts.map