const puppeteer = require('puppeteer');
const prisma = require('../../shared/prisma');

const toArticleRow = ({ id, title, content, author, publishedAt, coverImage }) => ({
  id,
  title,
  content,
  author,
  published_at: publishedAt,
  cover_image: coverImage,
});

const getArticleById = async (id) => {
  if (!/^\d+$/.test(String(id ?? ''))) return null;
  const article = await prisma.article.findUnique({ where: { id: Number(id) } });
  return article ? toArticleRow(article) : null;
};

const getAllArticles = async () => {
  const articles = await prisma.article.findMany({ orderBy: { publishedAt: 'desc' } });
  return articles.map(toArticleRow);
};

const scrapeArticle = async (url) => {
  let browser;
  try {
    browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);

    const result = await page.evaluate(() => {
      const title = document.querySelector('h1')?.innerText || '';
      const author = document.querySelector('.author-name')?.innerText || '';
      const content = document.querySelector('.content-body')?.innerHTML || '';
      const coverImage = document.querySelector('.lazyloaded')?.src || '';

      const publicationTime = document.querySelector('time[itemprop="datePublished"]')?.getAttribute('datetime') || 'Unknown publication date';

      const images = [];
      document.querySelectorAll('.placeholder-container').forEach((img) => {
        let imageUrl = img.getAttribute('data-src');

        if (!imageUrl) {
          const srcset = img.getAttribute('srcset');
          if (srcset) {
            const srcsetArray = srcset.split(',').map((item) => item.trim());
            const highestResolution = srcsetArray[srcsetArray.length - 1];
            imageUrl = highestResolution.split(' ')[0];
          }
        }

        if (!imageUrl) {
          imageUrl = img.getAttribute('src');
        }

        const description = img.getAttribute('alt') || 'No description';

        if (imageUrl) {
          images.push({ imageUrl, description });
        }
      });

      return { title, content, author, coverImage, images, publicationTime };
    });

    return { ...result, success: true };
  } catch (error) {
    console.error('Error scraping article:', error);
    return { success: false, message: 'Failed to scrape article' };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
};

const fetchAndSaveFromUrl = async (fullUrl) => {
  const scraped = await scrapeArticle(fullUrl);
  if (!scraped.success) {
    return { message: scraped.message };
  }

  const { title, content, author, coverImage, publicationTime } = scraped;
  const publishedAt = new Date(publicationTime);
  if (Number.isNaN(publishedAt.getTime())) throw publishedAt;

  const created = await prisma.article.create({
    data: { title, content, author, publishedAt, coverImage },
  });

  return { articleId: created.id };
};

module.exports = { getArticleById, getAllArticles, fetchAndSaveFromUrl };
