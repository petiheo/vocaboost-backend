// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
let RedisStore;
let Redis;
try {
  RedisStore = require('rate-limit-redis');
  Redis = require('ioredis');
} catch (err) {
  RedisStore = null;
  Redis = null;
}

// Redis client cho distributed rate limiting (optional)
const redis = Redis
  ? new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    })
  : null;

// Rate limit configurations cho các endpoint khác nhau
const rateLimitConfigs = {
  // Strict limits for authentication
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: {
      success: false,
      message: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút.',
      retryAfter: 15 * 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true
  },

  // API calls for logged-in users
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: {
      success: false,
      message: 'Quá nhiều yêu cầu API. Vui lòng thử lại sau.',
      retryAfter: 15 * 60
    }
  },

  // Review submissions - more lenient for learning
  review: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 reviews per minute (fast learners)
    message: {
      success: false,
      message: 'Bạn đang ôn tập quá nhanh. Hãy nghỉ ngơi 1 phút.',
      retryAfter: 60
    }
  },

  // Email operations - strict to prevent spam
  email: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 emails per hour
    message: {
      success: false,
      message: 'Quá nhiều email được gửi. Vui lòng thử lại sau 1 giờ.',
      retryAfter: 60 * 60
    }
  },

  // File uploads
  upload: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 uploads per window
    message: {
      success: false,
      message: 'Quá nhiều tải lên. Vui lòng thử lại sau.',
      retryAfter: 15 * 60
    }
  },

  // AI service calls - expensive operations
  ai: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // 50 AI calls per hour
    message: {
      success: false,
      message: 'Bạn đã sử dụng hết quota AI cho giờ này. Vui lòng thử lại sau.',
      retryAfter: 60 * 60
    }
  }
};

// Custom key generator based on user and IP
const generateKey = (req) => {
  if (req.user && req.user.id) {
    return `rate_limit:${req.user.id}`;
  }
  return `rate_limit:${req.ip}`;
};

// Enhanced rate limiter with user role considerations
const createRateLimiter = (configName, options = {}) => {
  const baseConfig = rateLimitConfigs[configName];
  if (!baseConfig) {
    throw new Error(`Rate limit configuration '${configName}' not found`);
  }

  return rateLimit({
    store: RedisStore && redis ? new RedisStore({
      client: redis,
      prefix: `rl:${configName}:`
    }) : undefined,
    keyGenerator: generateKey,
    ...baseConfig,
    ...options,
    
    // Role-based rate limiting
    max: (req) => {
      const baseMax = baseConfig.max;
      
      // Admin và teacher có limits cao hơn
      if (req.user) {
        switch (req.user.role) {
          case 'admin':
            return baseMax * 5; // Admin có gấp 5 lần limit
          case 'teacher':
            return baseMax * 3; // Teacher có gấp 3 lần limit
          case 'student':
          default:
            return baseMax;
        }
      }
      
      return baseMax;
    },

    // Custom handler với logging
    handler: (req, res) => {
      console.warn(`Rate limit exceeded for ${req.ip} (${req.user?.email || 'anonymous'}) on ${configName}`);
      
      res.status(429).json({
        ...baseConfig.message,
        limit: baseConfig.max,
        windowMs: baseConfig.windowMs,
        remaining: 0
      });
    },

    // Bypass function for special cases
    skip: (req) => {
      // Skip rate limiting for health checks
      if (req.path === '/health' || req.path === '/api/health') {
        return true;
      }
      
      // Skip for admin in development
      if (process.env.NODE_ENV === 'development' && req.user?.role === 'admin') {
        return true;
      }
      
      return false;
    }
  });
};

// Specific rate limiters for different endpoints
const authLimiter = createRateLimiter('auth');
const apiLimiter = createRateLimiter('api');
const reviewLimiter = createRateLimiter('review');
const emailLimiter = createRateLimiter('email');
const uploadLimiter = createRateLimiter('upload');
const aiLimiter = createRateLimiter('ai');

// Progressive rate limiting for repeated violations
const createProgressiveLimiter = (baseLimiter, escalationFactor = 2) => {
  return [
    baseLimiter,
    rateLimit({
      store: RedisStore && redis ? new RedisStore({
        client: redis,
        prefix: 'rl:progressive:'
      }) : undefined,
      keyGenerator: generateKey,
      windowMs: 60 * 60 * 1000, // 1 hour window for escalation
      max: (req) => {
        const violations = parseInt(req.headers['x-ratelimit-violations'] || '0');
        return Math.max(1, Math.floor(baseLimiter.max / Math.pow(escalationFactor, violations)));
      },
      skip: (req) => req.rateLimit?.remaining > 0, // Only apply if base limiter was hit
      handler: (req, res) => {
        const violations = parseInt(req.headers['x-ratelimit-violations'] || '0') + 1;
        
        console.warn(`Progressive rate limit violation #${violations} for ${req.ip}`);
        
        res.status(429).json({
          success: false,
          message: `Vi phạm rate limit lần thứ ${violations}. Thời gian chờ sẽ tăng lên.`,
          violations,
          retryAfter: Math.pow(escalationFactor, violations) * 60
        });
      }
    })
  ];
};

// Distributed rate limiting với Redis clustering
class DistributedRateLimiter {
  constructor(name, config) {
    this.name = name;
    this.config = config;
    this.redis = redis;
  }

  async checkLimit(key, windowMs = this.config.windowMs, max = this.config.max) {
    const now = Date.now();
    const window = Math.floor(now / windowMs);
    const redisKey = `rate_limit:${this.name}:${key}:${window}`;

    if (!this.redis) {
      return { allowed: true, count: 0, remaining: max, resetTime: now + windowMs };
    }

    try {
      const current = await this.redis.incr(redisKey);
      
      if (current === 1) {
        await this.redis.expire(redisKey, Math.ceil(windowMs / 1000));
      }

      return {
        allowed: current <= max,
        count: current,
        remaining: Math.max(0, max - current),
        resetTime: (window + 1) * windowMs
      };
    } catch (error) {
      console.error('Redis rate limit error:', error);
      // Fallback: allow request if Redis is down
      return { allowed: true, count: 0, remaining: max, resetTime: now + windowMs };
    }
  }

  middleware() {
    return async (req, res, next) => {
      const key = generateKey(req);
      const result = await this.checkLimit(key);

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': this.config.max,
        'X-RateLimit-Remaining': result.remaining,
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
      });

      if (!result.allowed) {
        return res.status(429).json({
          success: false,
          message: this.config.message?.message || 'Rate limit exceeded',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        });
      }

      req.rateLimit = result;
      next();
    };
  }
}

// Rate limit monitoring và alerting
const rateLimitMonitor = {
  async logViolation(req, configName) {
    const violation = {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      email: req.user?.email,
      endpoint: req.path,
      method: req.method,
      configName
    };

    // Log to console (có thể gửi tới logging service)
    console.warn('Rate limit violation:', violation);

    // Store in Redis for analysis if available
    if (redis) {
      await redis.lpush('rate_limit_violations', JSON.stringify(violation));
      await redis.ltrim('rate_limit_violations', 0, 999); // Keep last 1000 violations
    }
  },

  async getViolationStats(timeRange = '1h') {
    try {
      const violations = redis ? await redis.lrange('rate_limit_violations', 0, -1) : [];
      const parsed = violations.map(v => JSON.parse(v));
      
      const cutoff = new Date();
      switch(timeRange) {
        case '1h': cutoff.setHours(cutoff.getHours() - 1); break;
        case '24h': cutoff.setDate(cutoff.getDate() - 1); break;
        case '7d': cutoff.setDate(cutoff.getDate() - 7); break;
      }

      const recent = parsed.filter(v => new Date(v.timestamp) > cutoff);
      
      return {
        total: recent.length,
        byIP: this.groupBy(recent, 'ip'),
        byUser: this.groupBy(recent, 'userId'),
        byEndpoint: this.groupBy(recent, 'endpoint'),
        timeRange
      };
    } catch (error) {
      console.error('Failed to get violation stats:', error);
      return null;
    }
  },

  groupBy(array, key) {
    return array.reduce((groups, item) => {
      const group = item[key] || 'unknown';
      groups[group] = (groups[group] || 0) + 1;
      return groups;
    }, {});
  }
};

module.exports = apiLimiter;
module.exports.authLimiter = authLimiter;
module.exports.apiLimiter = apiLimiter;
module.exports.reviewLimiter = reviewLimiter;
module.exports.emailLimiter = emailLimiter;
module.exports.uploadLimiter = uploadLimiter;
module.exports.aiLimiter = aiLimiter;
module.exports.createRateLimiter = createRateLimiter;
module.exports.createProgressiveLimiter = createProgressiveLimiter;
module.exports.DistributedRateLimiter = DistributedRateLimiter;
module.exports.rateLimitMonitor = rateLimitMonitor;
