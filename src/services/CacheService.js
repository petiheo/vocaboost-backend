let Redis;
try {
    if (process.env.NODE_ENV !== 'test' && process.env.REDIS_HOST) {
        Redis = require('ioredis');
    }
} catch (err) {
    Redis = null;
}

class CacheService {
    constructor() {
        if (Redis) {
            this.redis = new Redis({
                host: process.env.REDIS_HOST,
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD,
                db: process.env.REDIS_DB || 0,
                retryStrategy: (times) => {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                }
            });

            // Handle connection events
            this.redis.on('connect', () => {
                console.log('Redis connected successfully');
            });

            this.redis.on('error', (err) => {
                console.error('Redis connection error:', err);
            });
        } else {
            // Fallback stub when Redis is unavailable
            this.redis = {
                get: async () => null,
                setex: async () => {},
                set: async () => {},
                del: async () => {},
                exists: async () => 0,
                expire: async () => 0,
                keys: async () => [],
                multi: function () {
                    return {
                        incr() { return this; },
                        expire() { return this; },
                        exec: async () => [[null, 1]]
                    };
                },
                on: () => {}
            };
        }

        this.defaultTTL = 300; // 5 minutes
    }
    
    // Basic cache operations
    async get(key) {
        try {
            const value = await this.redis.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error(`Cache get error for key ${key}:`, error);
            return null;
        }
    }
    
    async set(key, value, ttl = this.defaultTTL) {
        try {
            const serialized = JSON.stringify(value);
            if (ttl > 0) {
                await this.redis.setex(key, ttl, serialized);
            } else {
                await this.redis.set(key, serialized);
            }
            return true;
        } catch (error) {
            console.error(`Cache set error for key ${key}:`, error);
            return false;
        }
    }
    
    async del(key) {
        try {
            await this.redis.del(key);
            return true;
        } catch (error) {
            console.error(`Cache delete error for key ${key}:`, error);
            return false;
        }
    }
    
    async exists(key) {
        try {
            return await this.redis.exists(key);
        } catch (error) {
            console.error(`Cache exists error for key ${key}:`, error);
            return false;
        }
    }
    
    async expire(key, seconds) {
        try {
            return await this.redis.expire(key, seconds);
        } catch (error) {
            console.error(`Cache expire error for key ${key}:`, error);
            return false;
        }
    }
    
    // Pattern operations
    async delPattern(pattern) {
        try {
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
                await this.redis.del(...keys);
            }
            return keys.length;
        } catch (error) {
            console.error(`Cache delete pattern error for ${pattern}:`, error);
            return 0;
        }
    }
    
    // Specialized caching methods
    async cacheWithLoader(key, loader, ttl = this.defaultTTL) {
        try {
            // Try to get from cache
            const cached = await this.get(key);
            if (cached !== null) {
                return cached;
            }
            
            // Load data
            const data = await loader();
            
            // Cache the result
            await this.set(key, data, ttl);
            
            return data;
        } catch (error) {
            console.error(`Cache with loader error for key ${key}:`, error);
            throw error;
        }
    }
    
    // User-specific caching
    async getUserCache(userId, key) {
        return this.get(`user:${userId}:${key}`);
    }
    
    async setUserCache(userId, key, value, ttl) {
        return this.set(`user:${userId}:${key}`, value, ttl);
    }
    
    async clearUserCache(userId) {
        return this.delPattern(`user:${userId}:*`);
    }
    
    // Vocabulary caching
    async cacheVocabularyList(listId, data, ttl = 3600) {
        return this.set(`vocab:list:${listId}`, data, ttl);
    }
    
    async getVocabularyList(listId) {
        return this.get(`vocab:list:${listId}`);
    }
    
    // Review queue caching
    async cacheReviewQueue(userId, data, ttl = 300) {
        return this.set(`review:queue:${userId}`, data, ttl);
    }
    
    async getReviewQueue(userId) {
        return this.get(`review:queue:${userId}`);
    }
    
    async clearReviewQueue(userId) {
        return this.del(`review:queue:${userId}`);
    }
    
    // Statistics caching
    async cacheStats(type, id, data, ttl = 1800) {
        return this.set(`stats:${type}:${id}`, data, ttl);
    }
    
    async getStats(type, id) {
        return this.get(`stats:${type}:${id}`);
    }
    
    // Session management
    async setSession(sessionId, data, ttl = 86400) {
        return this.set(`session:${sessionId}`, data, ttl);
    }
    
    async getSession(sessionId) {
        return this.get(`session:${sessionId}`);
    }
    
    async deleteSession(sessionId) {
        return this.del(`session:${sessionId}`);
    }
    
    // Rate limiting helpers
    async incrementCounter(key, window = 60) {
        const multi = this.redis.multi();
        multi.incr(key);
        multi.expire(key, window);
        const results = await multi.exec();
        return results[0][1]; // Return the count
    }
    
    async getCounter(key) {
        const count = await this.redis.get(key);
        return parseInt(count) || 0;
    }
}

// Export singleton instance
module.exports = new CacheService();