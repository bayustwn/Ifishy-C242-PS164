const { RateLimiterRedis, RateLimiterMemory } = require('rate-limiter-flexible');
const redis = require('./redis');
const { fail } = require('./response');

const createLimiter = (opts) =>
  redis
    ? new RateLimiterRedis({ storeClient: redis, ...opts, insuranceLimiter: new RateLimiterMemory(opts) })
    : new RateLimiterMemory(opts);

const globalLimiter = createLimiter({ keyPrefix: 'rl_global', points: 300, duration: 60 });
const authLimiter = createLimiter({ keyPrefix: 'rl_auth', points: 10, duration: 60, blockDuration: 60 });
const predictLimiter = createLimiter({ keyPrefix: 'rl_predict', points: 30, duration: 60 });

const limit = (limiter, message) => (req, res, next) => {
  limiter.consume(req.ip)
    .then(() => next())
    .catch(() => fail(res, 429, 'TOO_MANY_REQUESTS', message));
};

const closeLimiter = async () => {
  if (redis) redis.disconnect();
};

module.exports = { limit, globalLimiter, authLimiter, predictLimiter, closeLimiter };
