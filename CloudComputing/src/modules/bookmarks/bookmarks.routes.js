const express = require('express');
const { authenticateToken } = require('../../middleware/auth');
const upload = require('../../middleware/upload');
const { addBookmark, removeBookmark, getBookmarks, getBookmarkById } = require('./bookmarks.controller');

const router = express.Router();

router.post('/bookmark', authenticateToken, addBookmark);
router.delete('/bookmark', authenticateToken, removeBookmark);
router.get('/bookmarks', authenticateToken, getBookmarks);
router.get('/bookmark/:id', authenticateToken, getBookmarkById);

module.exports = router;
