const express = require('express');
const { getArticleById, getAllArticles, getArticleFromUrl } = require('./articles.controller');
const { authenticateToken } = require('../../middleware/auth');

const router = express.Router();

router.get('/articles', getAllArticles);
router.get('/articles/:id', getArticleById);
router.get('/article/scrape/:url', authenticateToken, getArticleFromUrl);

module.exports = router;
