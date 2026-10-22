const articlesService = require('./articles.service');
const { scrapeParamsSchema } = require('./articles.schema');

const getArticleById = async (req, res) => {
  try {
    const article = await articlesService.getArticleById(req.params.id);
    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    return res.status(200).json({ success: true, message: 'Article fetched successfully', data: article });
  } catch (error) {
    console.error('Error fetching article:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch article' });
  }
};

const getAllArticles = async (req, res) => {
  try {
    const articles = await articlesService.getAllArticles();
    return res.status(200).json({ success: true, message: 'Articles fetched successfully', data: articles });
  } catch (error) {
    console.error('Error fetching articles:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch articles' });
  }
};

const getArticleFromUrl = async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error scraping and saving article:', error);
    return res.status(500).json({ success: false, message: 'Failed to scrape and save article' });
  }
};

module.exports = { getArticleById, getAllArticles, getArticleFromUrl };
