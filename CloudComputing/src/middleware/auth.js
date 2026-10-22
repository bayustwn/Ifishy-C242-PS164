const jwt = require('jsonwebtoken');
const secretKey = process.env.JWT_SECRET;

const authenticateToken = (req, res, next) => {
  const authHeader = req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied, token missing or invalid',
    });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const decoded = jwt.verify(token, secretKey);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Invalid token', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired, please login again',
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token, please login again',
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'An error occurred during token verification',
      });
    }
  }
};

module.exports = { authenticateToken };
