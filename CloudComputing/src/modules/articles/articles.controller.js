const guard = require('../../shared/guard');
const { parsePagination } = require('../../shared/pagination');
const { ok, fail } = require('../../shared/response');
const articlesService = require('./articles.service');
const { assertPublicHttpUrl } = require('../../shared/urlSafety');
const { scrapeParamsSchema } = require('./articles.schema');

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

const getArticleFromUrl = guard('Error scraping and saving article', 'Failed to scrape and save article', async (req, res) => {
  const parsed = scrapeParamsSchema.safeParse(req.params);
  if (!parsed.success || !parsed.data.url) {
    return fail(res, 400, 'VALIDATION_ERROR', 'URL parameter is required');
  }

  let fullUrl = parsed.data.url;
  if (!/^https?:\/\//i.test(fullUrl)) {
    fullUrl = 'https://' + fullUrl;
  }

  try {
    fullUrl = (await assertPublicHttpUrl(fullUrl)).toString();
  } catch (error) {
    if (error.code === 'UNSAFE_URL') {
      return fail(res, 400, 'VALIDATION_ERROR', 'URL must be a public http(s) address');
    }
    throw error;
  }

  const result = await articlesService.fetchAndSaveFromUrl(fullUrl);
  if (result.message) {
    return fail(res, 500, 'SCRAPE_FAILED', result.message);
  }

  return ok(res, { articleId: result.articleId }, 'Article scraped and saved successfully');
});

module.exports = { getArticleById, getAllArticles, getArticleFromUrl };
