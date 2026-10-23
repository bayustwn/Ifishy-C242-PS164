const puppeteer = require('puppeteer');
const prisma = require('../../shared/prisma');
const cache = require('../../shared/cache');
const logger = require('../../shared/logger');
const { sliceArgs } = require('../../shared/pagination');
const { assertPublicHttpUrl } = require('../../shared/urlSafety');

const CACHE_KEY = 'articles:list:v1';

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

const getAllArticles = async (opts = {}) => {
  const paged = Object.keys(sliceArgs(opts)).length > 0;

  if (!paged) {
    const cached = await cache.get(CACHE_KEY);
    if (cached) return cached;
  }

  const articles = await prisma.article.findMany({
    orderBy: { publishedAt: 'desc' },
    ...sliceArgs(opts),
  });
  const rows = articles.map(toArticleRow);

  if (!paged) await cache.set(CACHE_KEY, rows, 60);
  return rows;
};

const scrapeArticle = async (url) => {
  let browser;
  try {
    browser = await puppeteer.launch();
    const page = await browser.newPage();
    const allowedOrigins = new Map();
    const isAllowed = (targetUrl) => {
      let origin;
      try {
        origin = new URL(targetUrl).origin;
      } catch {
        return Promise.resolve(false);
      }
      if (!allowedOrigins.has(origin)) {
        allowedOrigins.set(
          origin,
          assertPublicHttpUrl(targetUrl).then(() => true).catch(() => false),
        );
      }
      return allowedOrigins.get(origin);
    };

    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (!/^https?:\/\//i.test(request.url())) {
        request.continue();
        return;
      }
      isAllowed(request.url()).then((allowed) => {
        if (allowed) request.continue();
        else request.abort('blockedbyclient');
      });
    });
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
    logger.error({ err: error }, 'Error scraping article');
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

  await cache.del(CACHE_KEY);

  return { articleId: created.id };
};

module.exports = { getArticleById, getAllArticles, fetchAndSaveFromUrl };
