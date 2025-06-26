const Redis = require('ioredis');

let redis = null;

// Chỉ kết nối Redis khi có config và không phải test environment
if (process.env.REDIS_HOST && process.env.NODE_ENV !== 'test') {
    try {
        redis = new Redis({
            // Thông tin kết nối cơ bản
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            
            // Database number (Redis có 16 DB từ 0-15, mặc định dùng DB 0)
            db: parseInt(process.env.REDIS_DB) || 0,
            
            // Cấu hình connection pooling
            connectTimeout: 60000,      // 60 giây timeout khi kết nối
            lazyConnect: true,          // Chỉ kết nối khi cần thiết
            maxRetriesPerRequest: 3,    // Retry tối đa 3 lần cho mỗi command
            
            // Retry strategy - cách xử lý khi mất kết nối
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000); // Tăng dần delay, tối đa 2s
                console.warn(`Redis retry attempt ${times}, waiting ${delay}ms`);
                return delay;
            },
            
            // Reconnect on fail - tự động kết nối lại
            reconnectOnError: (err) => {
                const targetError = 'READONLY';
                return err.message.includes(targetError);
            }
        });

        // Event listeners để monitor Redis connection
        redis.on('connect', () => {
            console.log('✅ Redis connected successfully');
        });

        redis.on('ready', () => {
            console.log('🚀 Redis ready to receive commands');
        });

        redis.on('error', (err) => {
            console.error('❌ Redis connection error:', err.message);
            // Không crash app, chỉ log lỗi để fallback gracefully
        });

        redis.on('close', () => {
            console.warn('⚠️ Redis connection closed');
        });

        redis.on('reconnecting', () => {
            console.log('🔄 Redis reconnecting...');
        });

    } catch (error) {
        console.error('Redis initialization failed:', error.message);
        redis = null; // Fallback to null nếu không thể init
    }
} else {
    console.log('ℹ️ Redis not configured or in test mode - using in-memory fallback');
}

// Export redis instance (có thể là null)
module.exports = redis;