const express = require('express');
const { authenticateToken } = require('../../middleware/auth');
const upload = require('../../middleware/upload');
const { createPost, updatePost, getPosts, getPostById, addShareToPost, addComment, getComments, getCommentsById, addReplyToComment, addLikeToComment, removeLikeFromComment, getLikedCommentsByUser, addUpvoteToPost, addDownvoteToPost, getVoteStatusById, removeUpvoteFromPost, removeDownvoteFromPost } = require('./community.controller');

const router = express.Router();

router.post('/community/posts', authenticateToken, upload.single('image'), createPost);
router.put('/community/posts/:postId', authenticateToken, upload.single('image'), updatePost);
router.get('/community/posts', authenticateToken, getPosts);
router.get('/community/posts/:id', authenticateToken, getPostById);
router.post('/community/posts/:postId/share', authenticateToken, addShareToPost);
router.post('/community/posts/:postId/comments', authenticateToken, addComment);
router.get('/community/posts/:postId/comments', authenticateToken, getComments);
router.get('/community/comments/:commentId', authenticateToken, getCommentsById);
router.post('/comments/:commentId/reply', authenticateToken, addReplyToComment);
router.post('/comments/:commentId/like', authenticateToken, addLikeToComment);
router.delete('/comments/:commentId/like', authenticateToken, removeLikeFromComment);
router.get('/users/likes', authenticateToken, getLikedCommentsByUser);
router.post('/community/posts/:postId/upvote', authenticateToken, addUpvoteToPost);
router.post('/community/posts/:postId/downvote', authenticateToken, addDownvoteToPost);
router.delete('/community/posts/:postId/upvote', authenticateToken, removeUpvoteFromPost);
router.delete('/community/posts/:postId/downvote', authenticateToken, removeDownvoteFromPost);
router.get('/community/posts/:postId/vote-status', authenticateToken, getVoteStatusById);

module.exports = router;
