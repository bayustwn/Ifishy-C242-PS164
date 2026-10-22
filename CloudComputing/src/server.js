const dotenv = require('dotenv');
dotenv.config();
const app = require('./app');
const prisma = require('./shared/prisma');
const { closeLimiter } = require('./shared/rateLimit');

const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const shutdown = async () => {
  server.close(async () => {
    await closeLimiter();
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
