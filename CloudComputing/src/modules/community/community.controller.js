const guard = require('../../shared/guard');
const firstIssueMessage = require('../../shared/validation');
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

  res.status(201).json({
    success: true,
    message: 'Post created successfully!',
    postId,
  });
});

const updatePost = guard('Error in updatePost', 'Failed to update post', async (req, res) => {
  const { postId } = req.params;
  const { user } = req;
  const file = req.file;

  if (!isNumericId(postId)) {
    return res.status(404).json({
      success: false,
      message: 'Post not found or you do not have permission to edit this post',
    });
  }

  const existingPost = await community.findPostByIdAndUser(Number(postId), user.id);

  if (!existingPost) {
    return res.status(404).json({
      success: false,
      message: 'Post not found or you do not have permission to edit this post',
    });
  }

  const { title, content } = postBodySchema.parse(req.body);

  let imageUrl = existingPost.imageUrl;
  if (file) {
    imageUrl = await saveFileToDisk(req, file, postFolder);
  }

  await community.updatePost(Number(postId), user.id, { title, content }, imageUrl);

  res.status(200).json({
    success: true,
    message: 'Post updated successfully!',
  });
});

const getPosts = guard('Error in getPosts', 'Failed to retrieve posts', async (req, res) => {
  const userId = req.user.id;

  const posts = await community.getPosts(userId);

  res.status(200).json({
    success: true,
    posts,
  });
});

const getPostById = guard('Error in getPostById', 'Failed to retrieve the post', async (req, res) => {
  const { id } = req.params;

  if (!isNumericId(id)) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  const post = await community.getPostById(Number(id));

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  res.status(200).json({
    success: true,
    post,
  });
});

const addShareToPost = guard('Error adding share to post', 'Failed to share post', async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;

  const result = await community.addShareToPost(Number(postId), userId);

  if (result === 'already_shared') {
    return res.status(400).json({
      success: false,
      message: 'You have already shared this post',
    });
  }

  res.status(201).json({
    success: true,
    message: 'Post successfully shared!',
  });
});

const addComment = guard('Error in addComment', 'Failed to add comment', async (req, res) => {
  const { content } = req.body;
  const { postId } = req.params;

  if (!postId) {
    return res.status(400).json({
      success: false,
      message: 'Post ID is required',
    });
  }

  const parsed = addCommentSchema.safeParse({ content });
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: firstIssueMessage(parsed),
    });
  }

  await community.addComment(Number(postId), req.user.id, parsed.data.content);

  res.status(201).json({
    success: true,
    message: 'Comment added successfully!',
  });
});

const getComments = guard('Error in getComments', 'Failed to retrieve comments', async (req, res) => {
  const rawPostId = req.params.postId;
  const postId = isNumericId(rawPostId) ? Number(rawPostId) : -1;
  const userId = req.user.id;

  const comments = await community.getComments(postId, userId);

  res.status(200).json({
    success: true,
    comments,
  });
});

const getCommentsById = guard('Error in getCommentsById', 'Failed to retrieve comment', async (req, res) => {
  const { commentId } = req.params;
  if (!isNumericId(commentId)) {
    return res.status(404).json({
      success: false,
      message: 'Comment not found',
    });
  }

  const userId = req.user.id;
  const comment = await community.getCommentsById(Number(commentId), userId);

  if (!comment) {
    return res.status(404).json({
      success: false,
      message: 'Comment not found',
    });
  }

  res.status(200).json({
    success: true,
    comment,
  });
});

const addReplyToComment = guard('Error adding reply to comment', 'Failed to add reply to comment', async (req, res) => {
  const parsed = addReplySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: firstIssueMessage(parsed),
    });
  }

  await community.addReplyToComment(Number(req.params.commentId), req.user.id, parsed.data.content);

  res.status(201).json({
    success: true,
    message: 'Reply added successfully',
  });
});

const getCommentsWithReplies = guard('Error in getCommentsWithReplies', 'Failed to retrieve comments and replies', async (req, res) => {
  const rawPostId = req.params.postId;
  const postId = isNumericId(rawPostId) ? Number(rawPostId) : -1;

  const comments = await community.getCommentsWithReplies(postId);

  res.status(200).json({
    success: true,
    comments,
  });
});

const addLikeToComment = guard('Error adding like to comment', 'Failed to add like to comment', async (req, res) => {
  const result = await community.addLikeToComment(Number(req.params.commentId), req.user.id);

  if (result === 'already_liked') {
    return res.status(400).json({
      success: false,
      message: 'You have already liked this comment',
    });
  }

  res.status(200).json({
    success: true,
    message: 'Like added to comment successfully',
  });
});

const removeLikeFromComment = guard('Error removing like from comment', 'Failed to remove like from comment', async (req, res) => {
  const result = await community.removeLikeFromComment(Number(req.params.commentId), req.user.id);

  if (result === 'not_liked') {
    return res.status(400).json({
      success: false,
      message: 'You have not liked this comment yet',
    });
  }

  res.status(200).json({
    success: true,
    message: 'Like removed from comment successfully',
  });
});

const getLikedCommentsByUser = guard('Error in getLikedCommentsByUser', 'Failed to retrieve liked comments', async (req, res) => {
  const likedComments = await community.getLikedCommentsByUser(req.user.id);

  res.status(200).json({
    success: true,
    likedComments,
  });
});

const addUpvoteToPost = guard('Error adding upvote', 'Failed to add upvote', async (req, res) => {
  const result = await community.addUpvoteToPost(Number(req.params.postId), req.user.id);

  if (result === 'already_upvoted') {
    return res.status(400).json({ success: false, message: 'You have already upvoted this post' });
  }

  res.status(200).json({ success: true, message: 'Upvote added successfully' });
});

const addDownvoteToPost = guard('Error adding downvote', 'Failed to add downvote', async (req, res) => {
  const result = await community.addDownvoteToPost(Number(req.params.postId), req.user.id);

  if (result === 'already_downvoted') {
    return res.status(400).json({ success: false, message: 'You have already downvoted this post' });
  }

  res.status(200).json({ success: true, message: 'Downvote added successfully' });
});

const getVoteStatusById = guard('Error retrieving vote status', 'Failed to retrieve vote status', async (req, res) => {
  const status = await community.getVoteStatusById(Number(req.params.postId), req.user.id);

  if (status === 'no vote') {
    return res.status(200).json({
      success: true,
      message: 'User has not voted yet',
      vote_status: 'no vote',
    });
  }

  res.status(200).json({
    success: true,
    message: 'Vote status retrieved successfully',
    vote_status: status,
  });
});

const removeUpvoteFromPost = guard('Error removing upvote', 'Failed to remove upvote', async (req, res) => {
  const result = await community.removeUpvoteFromPost(Number(req.params.postId), req.user.id);

  if (result === 'not_upvote') {
    return res.status(400).json({
      success: false,
      message: 'You have not upvoted this post yet',
    });
  }

  res.status(200).json({
    success: true,
    message: 'Upvote removed from post successfully',
  });
});

const removeDownvoteFromPost = guard('Error removing downvote', 'Failed to remove downvote', async (req, res) => {
  const result = await community.removeDownvoteFromPost(Number(req.params.postId), req.user.id);

  if (result === 'not_downvote') {
    return res.status(400).json({
      success: false,
      message: 'You have not downvoted this post yet',
    });
  }

  res.status(200).json({
    success: true,
    message: 'Downvote removed from post successfully',
  });
});

module.exports = { createPost, updatePost, getPosts, getPostById, addShareToPost, addComment, getComments, getCommentsById, addReplyToComment, getCommentsWithReplies, addLikeToComment, removeLikeFromComment, getLikedCommentsByUser, addUpvoteToPost, addDownvoteToPost, getVoteStatusById, removeUpvoteFromPost, removeDownvoteFromPost };
