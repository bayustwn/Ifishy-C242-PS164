const community = require('./community.service');
const { saveFileToDisk, postFolder } = require('../../shared/storage');
const { postBodySchema, addCommentSchema, addReplySchema } = require('./community.schema');

const isNumericId = (value) => /^\d+$/.test(String(value));
const firstMessage = (parsed) => parsed.error.issues[0].message;

const createPost = async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error in createPost:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create post',
    });
  }
};

const updatePost = async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error in updatePost:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update post',
    });
  }
};

const getPosts = async (req, res) => {
  try {
    const userId = req.user.id;

    const posts = await community.getPosts(userId);

    res.status(200).json({
      success: true,
      posts,
    });
  } catch (error) {
    console.error('Error in getPosts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve posts',
    });
  }
};

const getPostById = async (req, res) => {
  const { id } = req.params;

  try {
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
  } catch (error) {
    console.error('Error in getPostById:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve the post',
    });
  }
};

const addShareToPost = async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error adding share to post:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to share post',
    });
  }
};

const addComment = async (req, res) => {
  try {
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
        message: firstMessage(parsed),
      });
    }

    await community.addComment(Number(postId), req.user.id, parsed.data.content);

    res.status(201).json({
      success: true,
      message: 'Comment added successfully!',
    });
  } catch (error) {
    console.error('Error in addComment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment',
    });
  }
};

const getComments = async (req, res) => {
  try {
    const rawPostId = req.params.postId;
    const postId = isNumericId(rawPostId) ? Number(rawPostId) : -1;
    const userId = req.user.id;

    const comments = await community.getComments(postId, userId);

    res.status(200).json({
      success: true,
      comments,
    });
  } catch (error) {
    console.error('Error in getComments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve comments',
    });
  }
};

const getCommentsById = async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error in getCommentsById:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve comment',
    });
  }
};

const addReplyToComment = async (req, res) => {
  try {
    const parsed = addReplySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: firstMessage(parsed),
      });
    }

    await community.addReplyToComment(Number(req.params.commentId), req.user.id, parsed.data.content);

    res.status(201).json({
      success: true,
      message: 'Reply added successfully',
    });
  } catch (error) {
    console.error('Error adding reply to comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add reply to comment',
    });
  }
};

const getCommentsWithReplies = async (req, res) => {
  try {
    const rawPostId = req.params.postId;
    const postId = isNumericId(rawPostId) ? Number(rawPostId) : -1;

    const comments = await community.getCommentsWithReplies(postId);

    res.status(200).json({
      success: true,
      comments,
    });
  } catch (error) {
    console.error('Error in getCommentsWithReplies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve comments and replies',
    });
  }
};

const addLikeToComment = async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error adding like to comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add like to comment',
    });
  }
};

const removeLikeFromComment = async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error removing like from comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove like from comment',
    });
  }
};

const getLikedCommentsByUser = async (req, res) => {
  try {
    const likedComments = await community.getLikedCommentsByUser(req.user.id);

    res.status(200).json({
      success: true,
      likedComments,
    });
  } catch (error) {
    console.error('Error in getLikedCommentsByUser:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve liked comments',
    });
  }
};

const addUpvoteToPost = async (req, res) => {
  try {
    const result = await community.addUpvoteToPost(Number(req.params.postId), req.user.id);

    if (result === 'already_upvoted') {
      return res.status(400).json({ success: false, message: 'You have already upvoted this post' });
    }

    res.status(200).json({ success: true, message: 'Upvote added successfully' });
  } catch (error) {
    console.error('Error adding upvote:', error);
    res.status(500).json({ success: false, message: 'Failed to add upvote' });
  }
};

const addDownvoteToPost = async (req, res) => {
  try {
    const result = await community.addDownvoteToPost(Number(req.params.postId), req.user.id);

    if (result === 'already_downvoted') {
      return res.status(400).json({ success: false, message: 'You have already downvoted this post' });
    }

    res.status(200).json({ success: true, message: 'Downvote added successfully' });
  } catch (error) {
    console.error('Error adding downvote:', error);
    res.status(500).json({ success: false, message: 'Failed to add downvote' });
  }
};

const getVoteStatusById = async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error retrieving vote status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve vote status',
    });
  }
};

const removeUpvoteFromPost = async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error removing upvote:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove upvote',
    });
  }
};

const removeDownvoteFromPost = async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error removing downvote:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove downvote',
    });
  }
};

module.exports = { createPost, updatePost, getPosts, getPostById, addShareToPost, addComment, getComments, getCommentsById, addReplyToComment, getCommentsWithReplies, addLikeToComment, removeLikeFromComment, getLikedCommentsByUser, addUpvoteToPost, addDownvoteToPost, getVoteStatusById, removeUpvoteFromPost, removeDownvoteFromPost };
