const Redis = require('ioredis');

const client = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: ({ attempt }) => (attempt > 5 ? null : Math.min(attempt * 200, 1000)),
    })
  : null;

if (client) client.on('error', () => {});

module.exports = client;
