const logger = require('../shared/logger');
const { verifyToken } = require('../shared/token');
const { fail } = require('../shared/response');

const authenticateToken = (req, res, next) => {
  const authHeader = req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return fail(res, 401, 'UNAUTHORIZED', 'Access denied, token missing or invalid');
  }

  const token = authHeader.replace('Bearer ', '');

  return verifyToken(token)
    .then((payload) => {
      req.user = payload;
      next();
    })
    .catch((error) => {
      logger.error({ err: error }, 'Invalid token');

      if (error.code === 'ERR_JWT_EXPIRED') {
        return fail(res, 401, 'TOKEN_EXPIRED', 'Token expired, please login again');
      }
      if (error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' || error.code === 'ERR_JWS_INVALID') {
        return fail(res, 401, 'INVALID_TOKEN', 'Invalid token, please login again');
      }
      return fail(res, 500, 'INTERNAL_ERROR', 'An error occurred during token verification');
    });
};

module.exports = { authenticateToken };
