const { jwtVerify } = require('jose');

const encoder = new TextEncoder();

const authenticateToken = (req, res, next) => {
  const authHeader = req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied, token missing or invalid',
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const secret = encoder.encode(process.env.JWT_SECRET);

  return jwtVerify(token, secret)
    .then(({ payload }) => {
      req.user = payload;
      next();
    })
    .catch((error) => {
      console.error('Invalid token', error);

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
