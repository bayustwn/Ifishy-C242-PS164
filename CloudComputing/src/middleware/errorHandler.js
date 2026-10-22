const logger = require('../shared/logger');
const { fail } = require('../shared/response');

const STATUS_CODES = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'TOO_MANY_REQUESTS',
};

const notFound = (req, res) => {
  fail(res, 404, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`);
};

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.type === 'entity.parse.failed') {
    return fail(res, 400, 'INVALID_JSON', 'Invalid JSON payload');
  }

  if (err.name === 'MulterError') {
    return fail(res, 400, 'UPLOAD_ERROR', err.message);
  }

  const status = err.status || err.statusCode || 500;
  logger.error({ err, method: req.method, url: req.originalUrl }, 'Request failed');

  if (status >= 500) {
    return fail(res, status, 'INTERNAL_ERROR', 'Internal server error');
  }

  return fail(res, status, STATUS_CODES[status] || 'BAD_REQUEST', err.message);
};

module.exports = { notFound, errorHandler };
