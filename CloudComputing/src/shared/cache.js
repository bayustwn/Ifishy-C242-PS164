const redis = require('./redis');

const get = async (key) => {
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const set = async (key, value, ttlSeconds = 60) => {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {}
};

const del = async (key) => {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {}
};

module.exports = { get, set, del };
