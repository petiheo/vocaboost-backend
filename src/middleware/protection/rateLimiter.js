const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis'); // Sửa: Dùng destructuring cho version 4.x

// Import Redis config (có thể null)
const redis = require('../../config/redis');

// Base rate limiter factory với fallback
const createRateLimiter = (config) => {
    const options = {
        windowMs: config.windowMs,
        max: config.max,
        message: {
            error: 'Rate limit exceeded',
            message: config.message,
            retryAfter: Math.ceil(config.windowMs / 1000)
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            return req.user?.id || req.ip;
        }
    };

    // Chỉ sử dụng Redis store khi Redis available
    if (redis) {
        try {
            options.store = new RedisStore({ 
                sendCommand: (command, ...args) => redis.send_command(command, ...args), 
                prefix: `rl:${config.name}:`
            });
            console.log(`✅ Rate limiter "${config.name}" using Redis store`);
        } catch (error) {
            console.warn(`⚠️ Redis store failed for "${config.name}", using memory store:`, error.message);
        }
    } else {
        console.log(`ℹ️ Rate limiter "${config.name}" using in-memory store`);
    }

    return rateLimit(options);
};

// Rate limiters với fallback
const rateLimiters = {
    global: createRateLimiter({
        name: 'global',
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000,
        message: 'Too many requests from this IP'
    }),
    
    auth: createRateLimiter({
        name: 'auth',
        windowMs: 15 * 60 * 1000,
        max: 5,
        message: 'Too many authentication attempts'
    }),
    
    review: createRateLimiter({
        name: 'review',
        windowMs: 60 * 1000, // 1 minute
        max: 30,
        message: 'Please slow down your learning pace'
    }),
    
    upload: createRateLimiter({
        name: 'upload',
        windowMs: 60 * 1000,
        max: 5,
        message: 'Too many file uploads'
    }),
    
    email: createRateLimiter({
        name: 'email',
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 10,
        message: 'Email limit exceeded'
    }),
    
    admin: createRateLimiter({
        name: 'admin',
        windowMs: 60 * 1000,
        max: 100,
        message: 'Admin action rate limit'
    })
};

module.exports = rateLimiters;