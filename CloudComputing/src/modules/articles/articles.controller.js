const guard = require('../../shared/guard');
const { parsePagination } = require('../../shared/pagination');
const { ok, fail } = require('../../shared/response');
const articlesService = require('./articles.service');

const getArticleById = guard('Error fetching article', 'Failed to fetch article', async (req, res) => {
  const article = await articlesService.getArticleById(req.params.id);
  if (!article) {
    return fail(res, 404, 'NOT_FOUND', 'Article not found');
  }

  return ok(res, article, 'Article fetched successfully');
});

const getAllArticles = guard('Error fetching articles', 'Failed to fetch articles', async (req, res) => {
  const articles = await articlesService.getAllArticles(parsePagination(req.query));
  return ok(res, articles, 'Articles fetched successfully');
});

module.exports = { getArticleById, getAllArticles };
