const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const pinoHttp = require('pino-http');
const routes = require('./routes');
const logger = require('./shared/logger');
const { limit, globalLimiter } = require('./shared/rateLimit');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, callback) => callback(null, allowedOrigins.length === 0 || !origin || allowedOrigins.includes(origin)),
}));
if (allowedOrigins.length === 0) logger.warn('CORS_ORIGINS is not set: every origin is allowed');
app.use(compression());
app.use(pinoHttp({ logger }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(['/api/auth', '/api'], limit(globalLimiter, 'Too many requests, please try again later'), routes);

app.get('/', (req, res) => {
  res.send('Welcome to the Ifihsy Backend API!');
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
