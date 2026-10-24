const prisma = require('../../shared/prisma');
const { sliceArgs } = require('../../shared/pagination');

const addBookmark = async (userId, { itemId, type }) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const existingBookmark = await tx.bookmark.findFirst({
        where: { userId, itemId, type },
      });

      if (existingBookmark) {
        await tx.bookmark.deleteMany({ where: { id: existingBookmark.id } });
        return 'removed';
      }

      await tx.bookmark.create({ data: { userId, type, itemId } });
      return 'added';
    });
  } catch (error) {
    if (error.code === 'P2002') return 'added';
    throw error;
  }
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

const getBookmarks = async (userId, opts = {}) => {
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    ...sliceArgs(opts),
  });

  const postIds = [...new Set(bookmarks.filter((b) => b.type === 'post').map((b) => b.itemId))];
  const articleIds = [...new Set(bookmarks.filter((b) => b.type === 'article').map((b) => b.itemId))];

  const [posts, articles] = await Promise.all([
    postIds.length ? prisma.post.findMany({ where: { id: { in: postIds } }, select: { id: true, title: true } }) : [],
    articleIds.length ? prisma.article.findMany({ where: { id: { in: articleIds } }, select: { id: true, title: true } }) : [],
  ]);

  const titles = new Map();
  for (const post of posts) titles.set(`post:${post.id}`, post.title);
  for (const article of articles) titles.set(`article:${article.id}`, article.title);

  return bookmarks.map((b) => toBookmarkShape(b, titles.get(`${b.type}:${b.itemId}`) ?? null));
};

const getBookmarkById = async (userId, id) => {
  const bookmark = await prisma.bookmark.findFirst({ where: { userId, id } });
  if (!bookmark) return null;

  const title = await titleFor(bookmark.type, bookmark.itemId);
  return toBookmarkShape(bookmark, title);
};

module.exports = { addBookmark, removeBookmark, getBookmarks, getBookmarkById };
