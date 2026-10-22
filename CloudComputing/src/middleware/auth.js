const logger = require('../shared/logger');
const { verifyToken } = require('../shared/token');

const authenticateToken = (req, res, next) => {
  const authHeader = req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied, token missing or invalid',
    });
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
        return res.status(401).json({
          success: false,
          message: 'Token expired, please login again',
        });
      }
      if (error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' || error.code === 'ERR_JWS_INVALID') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token, please login again',
        });
      }
      return res.status(500).json({
        success: false,
        message: 'An error occurred during token verification',
      });
    });
};

module.exports = { authenticateToken };
