const { jwtVerify } = require('jose');

const encoder = new TextEncoder();

const verifyToken = async (token) => {
  const { payload } = await jwtVerify(token, encoder.encode(process.env.JWT_SECRET));
  return payload;
};

module.exports = { verifyToken };
