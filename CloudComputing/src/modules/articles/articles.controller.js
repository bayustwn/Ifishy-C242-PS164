const guard = require('../../shared/guard');
const { parsePagination } = require('../../shared/pagination');
const articlesService = require('./articles.service');
const { scrapeParamsSchema } = require('./articles.schema');

const getArticleById = guard('Error fetching article', 'Failed to fetch article', async (req, res) => {
  const article = await articlesService.getArticleById(req.params.id);
  if (!article) {
    return res.status(404).json({ success: false, message: 'Article not found' });
  }

  return res.status(200).json({ success: true, message: 'Article fetched successfully', data: article });
});

const getAllArticles = guard('Error fetching articles', 'Failed to fetch articles', async (req, res) => {
  const articles = await articlesService.getAllArticles(parsePagination(req.query));
  return res.status(200).json({ success: true, message: 'Articles fetched successfully', data: articles });
});

const getArticleFromUrl = guard('Error scraping and saving article', 'Failed to scrape and save article', async (req, res) => {
  const parsed = scrapeParamsSchema.safeParse(req.params);
  if (!parsed.success || !parsed.data.url) {
    return res.status(400).json({ success: false, message: 'URL parameter is required' });
  }

  let fullUrl = parsed.data.url;
  if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
    fullUrl = 'https://' + fullUrl;
  }

  const result = await articlesService.fetchAndSaveFromUrl(fullUrl);
  if (result.message) {
    return res.status(500).json({ success: false, message: result.message });
  }

  return res.status(200).json({
    success: true,
    message: 'Article scraped and saved successfully',
    articleId: result.articleId,
  });
});

module.exports = { getArticleById, getAllArticles, getArticleFromUrl };
