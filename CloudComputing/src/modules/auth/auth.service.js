const { SignJWT } = require('jose');
const bcrypt = require('bcrypt');
const prisma = require('../../shared/prisma');

const encoder = new TextEncoder();

const signJwt = async (payload) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET is missing');

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2d')
    .sign(encoder.encode(jwtSecret));
};

const registerUser = async ({ username, email, password }) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { username, email, password: hashedPassword } });

  return { id: user.id, username, email };
};

const findUserByEmail = (email) => {
  if (typeof email !== 'string' || !email) return null;
  return prisma.user.findUnique({ where: { email } });
};

const loginUser = async ({ email, password }) => {
  const user = await findUserByEmail(email);
  if (!user) return 'not_found';

  const isPasswordValid = await bcrypt.compare(password ?? '', user.password);
  if (!isPasswordValid) return 'invalid';

  return { token: await signJwt({ id: user.id, email: user.email }) };
};

module.exports = { signJwt, registerUser, loginUser };
