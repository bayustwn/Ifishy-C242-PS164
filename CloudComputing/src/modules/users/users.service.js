const bcrypt = require('bcrypt');
const prisma = require('../../shared/prisma');
const logger = require('../../shared/logger');
const { publicUrl, deleteUserObjects } = require('../../shared/r2');
const { sliceArgs } = require('../../shared/pagination');

const publicColumns = { id: true, username: true, email: true };

const getAllUsers = async (opts = {}) =>
  prisma.user.findMany({ select: publicColumns, ...sliceArgs(opts) });

const toProfileRow = ({ id, username, email, profilePhoto }) => ({
  id,
  username,
  email,
  profile_photo: publicUrl(profilePhoto),
});

const updateUser = async (userId, { username, email, password, newPassword }) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return 'not_found';

  let nextPassword = user.password;
  if (newPassword) {
    const isPasswordValid = await bcrypt.compare(password ?? '', user.password);
    if (!isPasswordValid) return 'incorrect_password';

    nextPassword = await bcrypt.hash(newPassword, 10);
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        username: username || user.username,
        email: email || user.email,
        password: nextPassword,
      },
    });
  } catch (error) {
    if (error.code === 'P2002') return 'conflict';
    throw error;
  }

  return 'ok';
};

const deleteUserAccount = async (userId) => {
  const result = await prisma.user.deleteMany({ where: { id: userId } });
  if (result.count === 0) return 'not_found';

  await deleteUserObjects(userId).catch((error) => {
    logger.warn({ err: error, userId }, 'Failed to delete user objects from storage');
  });

  return 'ok';
};

const replaceProfilePhoto = async (userId, photoUrl) => {
  const targetId = Number.isInteger(userId) ? userId : -1;
  const user = await prisma.user.findUnique({
    where: { id: targetId },
    select: { profilePhoto: true },
  });
  if (!user) return null;

  await prisma.user.update({ where: { id: targetId }, data: { profilePhoto: photoUrl } });
  return user.profilePhoto;
};

const getDashboardByEmail = async (email) => {
  const user = await prisma.user.findUnique({
    where: { email: typeof email === 'string' ? email : '' },
    select: { id: true, username: true, email: true, profilePhoto: true },
  });
  return user ? toProfileRow(user) : null;
};

const getProfileByEmail = getDashboardByEmail;

module.exports = { getAllUsers, updateUser, deleteUserAccount, replaceProfilePhoto, getDashboardByEmail, getProfileByEmail };
