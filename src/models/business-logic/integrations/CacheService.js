const redis = require('../config/redis');

class CacheService {
    constructor() {
        this.redis = redis;
        this.defaultTTL = 3600; // 1 hour default expiration
    }

    // Check if Redis is available
    isAvailable() {
        return this.redis !== null && this.redis.status === 'ready';
    }

    // Get value by key
    async get(key) {
        if (!this.isAvailable()) return null;
        
        try {
            const value = await this.redis.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('Cache get error:', error);
            return null; // Graceful fallback
        }
    }

    // Set value with optional TTL
    async set(key, value, ttl = this.defaultTTL) {
        if (!this.isAvailable()) return false;
        
        try {
            const serialized = JSON.stringify(value);
            await this.redis.setex(key, ttl, serialized);
            return true;
        } catch (error) {
            console.error('Cache set error:', error);
            return false;
        }
    }

    // Delete key
    async del(key) {
        if (!this.isAvailable()) return false;
        
        try {
            await this.redis.del(key);
            return true;
        } catch (error) {
            console.error('Cache delete error:', error);
            return false;
        }
    }

    // Increment counter (for rate limiting)
    async incr(key, ttl = 60) {
        if (!this.isAvailable()) return null;
        
        try {
            const current = await this.redis.incr(key);
            if (current === 1) {
                await this.redis.expire(key, ttl);
            }
            return current;
        } catch (error) {
            console.error('Cache incr error:', error);
            return null;
        }
    }

    // Get multiple keys
    async mget(keys) {
        if (!this.isAvailable() || !keys.length) return [];
        
        try {
            const values = await this.redis.mget(keys);
            return values.map(value => value ? JSON.parse(value) : null);
        } catch (error) {
            console.error('Cache mget error:', error);
            return new Array(keys.length).fill(null);
        }
    }
}

module.exports = new CacheService();