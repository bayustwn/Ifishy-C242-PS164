delete process.env.REDIS_URL;

const cache = require('../cache');
const redis = require('../redis');

describe('cache tanpa Redis', () => {
  test('client null saat REDIS_URL tidak diset', () => {
    expect(redis).toBeNull();
  });

  test('get → null, set/del tidak melempar', async () => {
    await expect(cache.get('key')).resolves.toBeNull();
    await expect(cache.set('key', { a: 1 }, 60)).resolves.toBeUndefined();
    await expect(cache.del('key')).resolves.toBeUndefined();
  });
});
