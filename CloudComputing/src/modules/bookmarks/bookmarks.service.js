const prisma = require('../../shared/prisma');

const addBookmark = async (userId, { itemId, type }) => {
  const existingBookmark = await prisma.bookmark.findFirst({
    where: { userId, itemId, type },
  });

  if (existingBookmark) {
    await prisma.bookmark.delete({ where: { id: existingBookmark.id } });
    return 'removed';
  }

  await prisma.bookmark.create({ data: { userId, type, itemId } });
  return 'added';
};

const removeBookmark = async (userId, { itemId, type }) => {
  await prisma.bookmark.deleteMany({ where: { userId, itemId, type } });
};

const titleFor = async (type, itemId) => {
  if (type === 'post') {
    const post = await prisma.post.findUnique({ where: { id: itemId }, select: { title: true } });
    return post?.title ?? null;
  }
  if (type === 'article') {
    const article = await prisma.article.findUnique({ where: { id: itemId }, select: { title: true } });
    return article?.title ?? null;
  }
  return null;
};

const toBookmarkShape = ({ id, type, itemId, createdAt }, title) => ({
  id,
  type,
  item_id: itemId,
  title,
  created_at: createdAt,
});

const getBookmarks = async (userId) => {
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return Promise.all(
    bookmarks.map(async (b) => toBookmarkShape(b, await titleFor(b.type, b.itemId)))
  );
};

const getBookmarkById = async (userId, id) => {
  const bookmark = await prisma.bookmark.findFirst({ where: { userId, id } });
  if (!bookmark) return null;

  const title = await titleFor(bookmark.type, bookmark.itemId);
  return toBookmarkShape(bookmark, title);
};

module.exports = { addBookmark, removeBookmark, getBookmarks, getBookmarkById };
