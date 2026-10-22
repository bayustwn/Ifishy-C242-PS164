const guard = require('../../shared/guard');
const firstIssueMessage = require('../../shared/validation');
const { parsePagination } = require('../../shared/pagination');
const { ok, fail } = require('../../shared/response');
const community = require('./community.service');
const { saveFileToDisk, postFolder } = require('../../shared/storage');
const { postBodySchema, addCommentSchema, addReplySchema } = require('./community.schema');

const isNumericId = (value) => /^\d+$/.test(String(value));

const createPost = guard('Error in createPost', 'Failed to create post', async (req, res) => {
  const { title, content } = postBodySchema.parse(req.body);
  const file = req.file;

  let imageUrl = null;
  if (file) {
    imageUrl = await saveFileToDisk(req, file, postFolder);
  }

  const postId = await community.createPost(req.user.id, { title, content }, imageUrl);

  return ok(res, { postId }, 'Post created successfully!', 201);
});

const updatePost = guard('Error in updatePost', 'Failed to update post', async (req, res) => {
  const { postId } = req.params;
  const { user } = req;
  const file = req.file;

  if (!isNumericId(postId)) {
    return fail(res, 404, 'NOT_FOUND', 'Post not found or you do not have permission to edit this post');
  }

  const existingPost = await community.findPostByIdAndUser(Number(postId), user.id);

  if (!existingPost) {
    return fail(res, 404, 'NOT_FOUND', 'Post not found or you do not have permission to edit this post');
  }

  const { title, content } = postBodySchema.parse(req.body);

  let imageUrl = existingPost.imageUrl;
  if (file) {
    imageUrl = await saveFileToDisk(req, file, postFolder);
  }

  await community.updatePost(Number(postId), user.id, { title, content }, imageUrl);

  return ok(res, null, 'Post updated successfully!');
});

const getPosts = guard('Error in getPosts', 'Failed to retrieve posts', async (req, res) => {
  const userId = req.user.id;

  const posts = await community.getPosts(userId, parsePagination(req.query));

  return ok(res, posts);
});

const getPostById = guard('Error in getPostById', 'Failed to retrieve the post', async (req, res) => {
  const { id } = req.params;

  if (!isNumericId(id)) {
    return fail(res, 404, 'NOT_FOUND', 'Post not found');
  }

  const post = await community.getPostById(Number(id));

  if (!post) {
    return fail(res, 404, 'NOT_FOUND', 'Post not found');
  }

  return ok(res, post);
});

const addShareToPost = guard('Error adding share to post', 'Failed to share post', async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;

  const result = await community.addShareToPost(Number(postId), userId);

  if (result === 'already_shared') {
    return fail(res, 400, 'ALREADY_SHARED', 'You have already shared this post');
  }

  return ok(res, null, 'Post successfully shared!', 201);
});

const addComment = guard('Error in addComment', 'Failed to add comment', async (req, res) => {
  const { content } = req.body;
  const { postId } = req.params;

  if (!postId) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Post ID is required');
  }

  const parsed = addCommentSchema.safeParse({ content });
  if (!parsed.success) {
    return fail(res, 400, 'VALIDATION_ERROR', firstIssueMessage(parsed));
  }

  await community.addComment(Number(postId), req.user.id, parsed.data.content);

  return ok(res, null, 'Comment added successfully!', 201);
});

const getComments = guard('Error in getComments', 'Failed to retrieve comments', async (req, res) => {
  const rawPostId = req.params.postId;
  const postId = isNumericId(rawPostId) ? Number(rawPostId) : -1;
  const userId = req.user.id;

  const comments = await community.getComments(postId, userId, parsePagination(req.query));

  return ok(res, comments);
});

const getCommentsById = guard('Error in getCommentsById', 'Failed to retrieve comment', async (req, res) => {
  const { commentId } = req.params;
  if (!isNumericId(commentId)) {
    return fail(res, 404, 'NOT_FOUND', 'Comment not found');
  }

  const userId = req.user.id;
  const comment = await community.getCommentsById(Number(commentId), userId);

  if (!comment) {
    return fail(res, 404, 'NOT_FOUND', 'Comment not found');
  }

  return ok(res, comment);
});

const addReplyToComment = guard('Error adding reply to comment', 'Failed to add reply to comment', async (req, res) => {
  const parsed = addReplySchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, 'VALIDATION_ERROR', firstIssueMessage(parsed));
  }

  await community.addReplyToComment(Number(req.params.commentId), req.user.id, parsed.data.content);

  return ok(res, null, 'Reply added successfully', 201);
});

const addLikeToComment = guard('Error adding like to comment', 'Failed to add like to comment', async (req, res) => {
  const result = await community.addLikeToComment(Number(req.params.commentId), req.user.id);

  if (result === 'already_liked') {
    return fail(res, 400, 'ALREADY_LIKED', 'You have already liked this comment');
  }

  return ok(res, null, 'Like added to comment successfully');
});

const removeLikeFromComment = guard('Error removing like from comment', 'Failed to remove like from comment', async (req, res) => {
  const result = await community.removeLikeFromComment(Number(req.params.commentId), req.user.id);

  if (result === 'not_liked') {
    return fail(res, 400, 'NOT_LIKED', 'You have not liked this comment yet');
  }

  return ok(res, null, 'Like removed from comment successfully');
});

const getLikedCommentsByUser = guard('Error in getLikedCommentsByUser', 'Failed to retrieve liked comments', async (req, res) => {
  const likedComments = await community.getLikedCommentsByUser(req.user.id, parsePagination(req.query));

  return ok(res, likedComments);
});

const addUpvoteToPost = guard('Error adding upvote', 'Failed to add upvote', async (req, res) => {
  const result = await community.addUpvoteToPost(Number(req.params.postId), req.user.id);

  if (result === 'already_upvoted') {
    return fail(res, 400, 'ALREADY_UPVOTED', 'You have already upvoted this post');
  }

  return ok(res, null, 'Upvote added successfully');
});

const addDownvoteToPost = guard('Error adding downvote', 'Failed to add downvote', async (req, res) => {
  const result = await community.addDownvoteToPost(Number(req.params.postId), req.user.id);

  if (result === 'already_downvoted') {
    return fail(res, 400, 'ALREADY_DOWNVOTED', 'You have already downvoted this post');
  }

  return ok(res, null, 'Downvote added successfully');
});

const getVoteStatusById = guard('Error retrieving vote status', 'Failed to retrieve vote status', async (req, res) => {
  const status = await community.getVoteStatusById(Number(req.params.postId), req.user.id);

  if (status === 'no vote') {
    return ok(res, { vote_status: status }, 'User has not voted yet');
  }

  return ok(res, { vote_status: status }, 'Vote status retrieved successfully');
});

const removeUpvoteFromPost = guard('Error removing upvote', 'Failed to remove upvote', async (req, res) => {
  const result = await community.removeUpvoteFromPost(Number(req.params.postId), req.user.id);

  if (result === 'not_upvote') {
    return fail(res, 400, 'NOT_UPVOTED', 'You have not upvoted this post yet');
  }

  return ok(res, null, 'Upvote removed from post successfully');
});

const removeDownvoteFromPost = guard('Error removing downvote', 'Failed to remove downvote', async (req, res) => {
  const result = await community.removeDownvoteFromPost(Number(req.params.postId), req.user.id);

  if (result === 'not_downvote') {
    return fail(res, 400, 'NOT_DOWNVOTED', 'You have not downvoted this post yet');
  }

  return ok(res, null, 'Downvote removed from post successfully');
});

module.exports = { createPost, updatePost, getPosts, getPostById, addShareToPost, addComment, getComments, getCommentsById, addReplyToComment, addLikeToComment, removeLikeFromComment, getLikedCommentsByUser, addUpvoteToPost, addDownvoteToPost, getVoteStatusById, removeUpvoteFromPost, removeDownvoteFromPost };
