const guard = require('../../shared/guard');
const firstIssueMessage = require('../../shared/validation');
const { parsePagination } = require('../../shared/pagination');
const { ok, fail } = require('../../shared/response');
const community = require('./community.service');
const logger = require('../../shared/logger');
const r2 = require('../../shared/r2');
const { isUuid } = require('../../shared/id');
const { createPostSchema, updatePostSchema, addCommentSchema, addReplySchema } = require('./community.schema');

const createPost = guard('Error in createPost', 'Failed to create post', async (req, res) => {
  const parsed = createPostSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return fail(res, 400, 'VALIDATION_ERROR', firstIssueMessage(parsed));
  }
  const { title, content, imageKey } = parsed.data;

  if (imageKey) {
    if (!r2.isOwnedKey(imageKey, 'post', req.user.id)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid imageKey');
    }
    try {
      await r2.verifyUpload(imageKey);
    } catch {
      return fail(res, 400, 'VALIDATION_ERROR', 'Upload not found or invalid');
    }
  }

  const postId = await community.createPost(req.user.id, { title, content }, imageKey ?? null);

  return ok(res, { postId }, 'Post created successfully!', 201);
});

const updatePost = guard('Error in updatePost', 'Failed to update post', async (req, res) => {
  const { postId } = req.params;
  const { user } = req;

  if (!isUuid(postId)) {
    return fail(res, 404, 'NOT_FOUND', 'Post not found or you do not have permission to edit this post');
  }

  const existingPost = await community.findPostByIdAndUser(postId, user.id);

  if (!existingPost) {
    return fail(res, 404, 'NOT_FOUND', 'Post not found or you do not have permission to edit this post');
  }

  const parsed = updatePostSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return fail(res, 400, 'VALIDATION_ERROR', firstIssueMessage(parsed));
  }
  const { title, content, imageKey } = parsed.data;

  if (imageKey) {
    if (!r2.isOwnedKey(imageKey, 'post', user.id)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid imageKey');
    }
    try {
      await r2.verifyUpload(imageKey);
    } catch {
      return fail(res, 400, 'VALIDATION_ERROR', 'Upload not found or invalid');
    }
  }

  const imageUrl = imageKey === undefined ? existingPost.imageUrl : (imageKey ?? null);

  await community.updatePost(postId, user.id, { title, content }, imageUrl);

  if (existingPost.imageUrl && existingPost.imageUrl !== imageUrl) {
    await r2.deleteOwned(existingPost.imageUrl, 'post', user.id).catch((error) => {
      logger.warn({ err: error, key: existingPost.imageUrl }, 'Failed to delete replaced post image');
    });
  }

  return ok(res, null, 'Post updated successfully!');
});

const getPosts = guard('Error in getPosts', 'Failed to retrieve posts', async (req, res) => {
  const userId = req.user.id;

  const posts = await community.getPosts(userId, parsePagination(req.query));

  return ok(res, posts);
});

const getPostById = guard('Error in getPostById', 'Failed to retrieve the post', async (req, res) => {
  const { id } = req.params;

  if (!isUuid(id)) {
    return fail(res, 404, 'NOT_FOUND', 'Post not found');
  }

  const post = await community.getPostById(id);

  if (!post) {
    return fail(res, 404, 'NOT_FOUND', 'Post not found');
  }

  return ok(res, post);
});

const addShareToPost = guard('Error adding share to post', 'Failed to share post', async (req, res) => {
  const { postId } = req.params;
  if (!isUuid(postId)) {
    return fail(res, 404, 'NOT_FOUND', 'Post not found');
  }
  const userId = req.user.id;

  const result = await community.addShareToPost(postId, userId);

  if (result === 'already_shared') {
    return fail(res, 400, 'ALREADY_SHARED', 'You have already shared this post');
  }

  return ok(res, null, 'Post successfully shared!', 201);
});

const addComment = guard('Error in addComment', 'Failed to add comment', async (req, res) => {
  const { content } = req.body;
  const { postId } = req.params;

  if (!isUuid(postId)) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Post ID is required');
  }

  const parsed = addCommentSchema.safeParse({ content });
  if (!parsed.success) {
    return fail(res, 400, 'VALIDATION_ERROR', firstIssueMessage(parsed));
  }

  await community.addComment(postId, req.user.id, parsed.data.content);

  return ok(res, null, 'Comment added successfully!', 201);
});

const getComments = guard('Error in getComments', 'Failed to retrieve comments', async (req, res) => {
  const { postId } = req.params;
  if (!isUuid(postId)) {
    return ok(res, []);
  }

  const comments = await community.getComments(postId, req.user.id, parsePagination(req.query));

  return ok(res, comments);
});

const getCommentsById = guard('Error in getCommentsById', 'Failed to retrieve comment', async (req, res) => {
  const { commentId } = req.params;
  if (!isUuid(commentId)) {
    return fail(res, 404, 'NOT_FOUND', 'Comment not found');
  }

  const userId = req.user.id;
  const comment = await community.getCommentsById(commentId, userId);

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
  if (!isUuid(req.params.commentId)) {
    return fail(res, 404, 'NOT_FOUND', 'Comment not found');
  }

  await community.addReplyToComment(req.params.commentId, req.user.id, parsed.data.content);

  return ok(res, null, 'Reply added successfully', 201);
});

const addLikeToComment = guard('Error adding like to comment', 'Failed to add like to comment', async (req, res) => {
  if (!isUuid(req.params.commentId)) {
    return fail(res, 404, 'NOT_FOUND', 'Comment not found');
  }
  const result = await community.addLikeToComment(req.params.commentId, req.user.id);

  if (result === 'already_liked') {
    return fail(res, 400, 'ALREADY_LIKED', 'You have already liked this comment');
  }

  return ok(res, null, 'Like added to comment successfully');
});

const removeLikeFromComment = guard('Error removing like from comment', 'Failed to remove like from comment', async (req, res) => {
  if (!isUuid(req.params.commentId)) {
    return fail(res, 404, 'NOT_FOUND', 'Comment not found');
  }
  const result = await community.removeLikeFromComment(req.params.commentId, req.user.id);

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
  if (!isUuid(req.params.postId)) {
    return fail(res, 404, 'NOT_FOUND', 'Post not found');
  }
  const result = await community.addUpvoteToPost(req.params.postId, req.user.id);

  if (result === 'already_upvoted') {
    return fail(res, 400, 'ALREADY_UPVOTED', 'You have already upvoted this post');
  }

  return ok(res, null, 'Upvote added successfully');
});

const addDownvoteToPost = guard('Error adding downvote', 'Failed to add downvote', async (req, res) => {
  if (!isUuid(req.params.postId)) {
    return fail(res, 404, 'NOT_FOUND', 'Post not found');
  }
  const result = await community.addDownvoteToPost(req.params.postId, req.user.id);

  if (result === 'already_downvoted') {
    return fail(res, 400, 'ALREADY_DOWNVOTED', 'You have already downvoted this post');
  }

  return ok(res, null, 'Downvote added successfully');
});

const getVoteStatusById = guard('Error retrieving vote status', 'Failed to retrieve vote status', async (req, res) => {
  if (!isUuid(req.params.postId)) {
    return fail(res, 404, 'NOT_FOUND', 'Post not found');
  }
  const status = await community.getVoteStatusById(req.params.postId, req.user.id);

  if (status === 'no vote') {
    return ok(res, { vote_status: status }, 'User has not voted yet');
  }

  return ok(res, { vote_status: status }, 'Vote status retrieved successfully');
});

const removeUpvoteFromPost = guard('Error removing upvote', 'Failed to remove upvote', async (req, res) => {
  if (!isUuid(req.params.postId)) {
    return fail(res, 404, 'NOT_FOUND', 'Post not found');
  }
  const result = await community.removeUpvoteFromPost(req.params.postId, req.user.id);

  if (result === 'not_upvote') {
    return fail(res, 400, 'NOT_UPVOTED', 'You have not upvoted this post yet');
  }

  return ok(res, null, 'Upvote removed from post successfully');
});

const removeDownvoteFromPost = guard('Error removing downvote', 'Failed to remove downvote', async (req, res) => {
  if (!isUuid(req.params.postId)) {
    return fail(res, 404, 'NOT_FOUND', 'Post not found');
  }
  const result = await community.removeDownvoteFromPost(req.params.postId, req.user.id);

  if (result === 'not_downvote') {
    return fail(res, 400, 'NOT_DOWNVOTED', 'You have not downvoted this post yet');
  }

  return ok(res, null, 'Downvote removed from post successfully');
});

module.exports = { createPost, updatePost, getPosts, getPostById, addShareToPost, addComment, getComments, getCommentsById, addReplyToComment, addLikeToComment, removeLikeFromComment, getLikedCommentsByUser, addUpvoteToPost, addDownvoteToPost, getVoteStatusById, removeUpvoteFromPost, removeDownvoteFromPost };
