const prisma = require('../../shared/prisma');

const findUsage = async (key) => {
  const [avatar, post, scan] = await Promise.all([
    prisma.user.findFirst({ where: { profilePhoto: key }, select: { id: true } }),
    prisma.post.findFirst({ where: { imageUrl: key }, select: { id: true } }),
    prisma.scanHistory.findFirst({ where: { fishImage: key }, select: { id: true } }),
  ]);

  if (avatar) return 'avatar';
  if (post) return 'post';
  if (scan) return 'scan';
  return null;
};

module.exports = { findUsage };
