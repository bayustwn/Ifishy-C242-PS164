const logger = require('../shared/logger');

const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON payload' });
  }

  if (err.name === 'MulterError') {
    return res.status(400).json({ success: false, message: err.message });
  }

  const status = err.status || err.statusCode || 500;
  logger.error({ err, method: req.method, url: req.originalUrl }, 'Request failed');

  return res.status(status).json({
    success: false,
    message: status >= 500 ? 'Internal server error' : err.message,
  });
};

module.exports = { notFound, errorHandler };
