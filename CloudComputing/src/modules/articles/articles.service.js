const prisma = require('../../shared/prisma');
const cache = require('../../shared/cache');
const { DEFAULT_LIMIT, sliceArgs } = require('../../shared/pagination');
const { isUuid } = require('../../shared/id');

const CACHE_KEY = 'articles:list:v2';

const toArticleRow = ({ id, title, content, author, publishedAt, coverImage }) => ({
  id,
  title,
  content,
  author,
  published_at: publishedAt,
  cover_image: coverImage,
});

const getArticleById = async (id) => {
  if (!isUuid(id)) return null;
  const article = await prisma.article.findUnique({ where: { id } });
  return article ? toArticleRow(article) : null;
};

const getAllArticles = async (opts = {}) => {
  const cacheKey = `${CACHE_KEY}:${opts.limit ?? DEFAULT_LIMIT}:${opts.offset ?? 0}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const articles = await prisma.article.findMany({
    orderBy: { publishedAt: 'desc' },
    ...sliceArgs(opts),
  });
  const rows = articles.map(toArticleRow);

  await cache.set(cacheKey, rows, 60);
  return rows;
};

module.exports = { getArticleById, getAllArticles };
