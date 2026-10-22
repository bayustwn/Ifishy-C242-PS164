const pool = require('../../config/database');
const puppeteer = require('puppeteer');

const getArticleById = async (req, res) => {
  try {
    const { id } = req.params;
    const sql = 'SELECT * FROM articles WHERE id = ?';
    const [article] = await pool.query(sql, [id]);

    if (article.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Article not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Article fetched successfully',
      data: article[0],
    });
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch article',
    });
  }
};

const getAllArticles = async (req, res) => {
  try {
    const sql = 'SELECT * FROM articles ORDER BY published_at DESC';
    const [articles] = await pool.query(sql);

    res.status(200).json({
      success: true,
      message: 'Articles fetched successfully',
      data: articles,
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch articles',
    });
  }
};

const scrapeArticle = async (url) => {
  try {
    const browser = await puppeteer.launch();
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
            const srcsetArray = srcset.split(',').map(item => item.trim());
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

    await browser.close();
    return {
      ...result,
      success: true,
    };
  } catch (error) {
    console.error('Error scraping article:', error);
    return {
      success: false,
      message: 'Failed to scrape article',
    };
  }
};

const getArticleFromUrl = async (req, res) => {
  try {
    const { url } = req.params;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL parameter is required',
      });
    }

    let fullUrl = url;
    if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
      fullUrl = 'https://' + fullUrl;
    }

    const result = await scrapeArticle(fullUrl);

    if (result.success) {
      const { title, content, author, coverImage, publicationTime } = result;
      const formattedPublicationTime = new Date(publicationTime)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');

      const insertArticleSql = `
        INSERT INTO articles (title, content, author, published_at, cover_image)
        VALUES (?, ?, ?, ?, ?)
      `;

      const [insertResult] = await pool.query(insertArticleSql, [
        title,
        content,
        author,
        formattedPublicationTime,
        coverImage,
      ]);

      res.status(200).json({
        success: true,
        message: 'Article scraped and saved successfully',
        articleId: insertResult.insertId,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    console.error('Error scraping and saving article:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to scrape and save article',
    });
  }
};

module.exports = { getArticleById, getAllArticles, getArticleFromUrl };
