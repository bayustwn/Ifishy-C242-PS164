const express = require('express');
const { authenticateToken } = require('../../middleware/auth');
const upload = require('../../middleware/upload');
const { getArticleById, getAllArticles, getArticleFromUrl } = require('./articles.controller');

const router = express.Router();

router.get('/articles', getAllArticles);
router.get('/articles/:id', getArticleById);
router.get('/article/scrape/:url', getArticleFromUrl);

module.exports = router;
