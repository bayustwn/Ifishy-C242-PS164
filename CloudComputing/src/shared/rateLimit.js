const Redis = require('ioredis');
const { RateLimiterRedis, RateLimiterMemory } = require('rate-limiter-flexible');

const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: ({ attempt }) => (attempt > 5 ? null : Math.min(attempt * 200, 1000)),
    })
  : null;
if (redis) redis.on('error', () => {});

const createLimiter = (opts) =>
  redis
    ? new RateLimiterRedis({ storeClient: redis, ...opts, insuranceLimiter: new RateLimiterMemory(opts) })
    : new RateLimiterMemory(opts);

const globalLimiter = createLimiter({ keyPrefix: 'rl_global', points: 300, duration: 60 });
const authLimiter = createLimiter({ keyPrefix: 'rl_auth', points: 10, duration: 60, blockDuration: 60 });

const limit = (limiter, message) => (req, res, next) => {
  limiter.consume(req.ip)
    .then(() => next())
    .catch(() => res.status(429).json({ success: false, message }));
};

const closeLimiter = async () => {
  if (redis) redis.disconnect();
};

module.exports = { limit, globalLimiter, authLimiter, closeLimiter };
