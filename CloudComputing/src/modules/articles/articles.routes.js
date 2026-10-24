const express = require('express');
const { getArticleById, getAllArticles } = require('./articles.controller');

const router = express.Router();

router.get('/articles', getAllArticles);
router.get('/articles/:id', getArticleById);

module.exports = router;
