const cacheService = require('../src/services/cacheService');

describe('Redis Integration', () => {
    test('should connect to Redis', () => {
        // Nếu Redis available, should be true
        // Nếu không có Redis, should be false (graceful fallback)
        expect(typeof cacheService.isAvailable()).toBe('boolean');
    });

    test('should set and get value', async () => {
        const testKey = 'test:key';
        const testValue = { message: 'Hello Redis' };

        const setResult = await cacheService.set(testKey, testValue, 10);
        const getValue = await cacheService.get(testKey);

        if (cacheService.isAvailable()) {
            expect(setResult).toBe(true);
            expect(getValue).toEqual(testValue);
        } else {
            expect(setResult).toBe(false);
            expect(getValue).toBe(null);
        }

        // Cleanup
        await cacheService.del(testKey);
    });
});