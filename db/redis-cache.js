const redis = require('redis');

const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        reconnectStrategy: (retries) => {
            if (retries > 10) {
                console.error('Redis connection retries exhausted.');
                return new Error('Retry exhausted');
            }
            // Exponential backoff strategy
            return Math.min(retries * 100, 3000);
        }
    }
});

redisClient.on('error', (err) => console.warn('Redis Cache Error (Non-Fatal):', err));
redisClient.on('connect', () => console.log('Successfully connected to Redis caching layer.'));

const getCachedData = async (key) => {
    try {
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    } catch (err) {
        console.error(`Cache read failed for key: ${key}`, err);
        return null;
    }
};

const setCachedData = async (key, value, ttlSeconds = 3600) => {
    try {
        await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
    } catch (err) {
        console.error(`Cache write failed for key: ${key}`, err);
    }
};

const invalidateCache = async (pattern) => {
    try {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
            await redisClient.del(keys);
        }
    } catch (err) {
        console.error(`Failed to invalidate cache pattern: ${pattern}`, err);
    }
};

module.exports = {
    redisClient,
    getCachedData,
    setCachedData,
    invalidateCache
};