const pool = require('../../config/database');
const { saveFileToDisk, profileFolder, postFolder, scanHistoryFolder } = require('../../shared/storage');

const getProfilePictureUrl = async (userId) => {
  try {
    const [result] = await pool.query('SELECT profile_photo FROM users WHERE id = ?', [userId]);
    if (result.length > 0 && result[0].profile_photo) {
      return result[0].profile_photo;
    }
    return '';
  } catch (error) {
    console.error('Error getting profile picture from database:', error);
    return '';
  }
};

const createPost = async (req, res) => {
  try {
    const { title, content } = req.body;
    const { user } = req;
    const file = req.file;

    let imageUrl = null;
    if (file) {
      imageUrl = await saveFileToDisk(req, file, postFolder);
    }

    const sql = 'INSERT INTO posts (user_id, title, content, image_url) VALUES (?, ?, ?, ?)';
    const [result] = await pool.query(sql, [user.id, title, content, imageUrl]);

    res.status(201).json({
      success: true,
      message: 'Post created successfully!',
      postId: result.insertId,
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
    const { title, content } = req.body;
    const { user } = req;
    const file = req.file;

    const [existingPost] = await pool.query('SELECT * FROM posts WHERE id = ? AND user_id = ?', [postId, user.id]);

    if (existingPost.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found or you do not have permission to edit this post',
      });
    }

    let imageUrl = existingPost[0].image_url;
    if (file) {
      imageUrl = await saveFileToDisk(req, file, postFolder);
    }

    const updateSql = 'UPDATE posts SET title = ?, content = ?, image_url = ? WHERE id = ? AND user_id = ?';
    await pool.query(updateSql, [title, content, imageUrl, postId, user.id]);

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

    const sqlPosts = `
      SELECT p.id, p.title, p.content, p.image_url, p.created_at, p.user_id, u.username,
             (SELECT COUNT(*) FROM post_votes WHERE post_id = p.id AND vote_type = 'upvote') AS likeCount,
             (SELECT COUNT(*) FROM shares WHERE post_id = p.id) AS shareCount,
             (SELECT COUNT(*) FROM post_votes WHERE post_id = p.id) AS voteCount,
             (SELECT vote_type FROM post_votes WHERE post_id = p.id AND user_id = ?) AS voteStatus
      FROM posts p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `;
    const [posts] = await pool.query(sqlPosts, [userId]);

    const sqlComments = `
      SELECT c.id, c.content, c.created_at, u.username, c.post_id
      FROM comments c
      JOIN users u ON c.user_id = u.id
      ORDER BY c.created_at ASC
    `;
    const [comments] = await pool.query(sqlComments);

    const postsWithDetails = posts.map(post => {
      const postComments = comments.filter(comment => comment.post_id === post.id)
        .map(comment => ({
          ...comment,
          timeSinceCommented: `${Math.floor((Date.now() - new Date(comment.created_at)) / 60000)} minutes ago`,
        }));

      return {
        ...post,
        comments: postComments,
        timeSincePosted: `${Math.floor((Date.now() - new Date(post.created_at)) / 60000)} minutes ago`,
      };
    });

    res.status(200).json({
      success: true,
      posts: postsWithDetails,
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
    const sqlPost = `
      SELECT p.id, p.title, p.content, p.image_url, p.created_at, p.user_id, u.username
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `;
    const [postResult] = await pool.query(sqlPost, [id]);

    if (postResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const post = postResult[0];

    const sqlComments = `
      SELECT c.id, c.content, c.created_at, u.username
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `;
    const [comments] = await pool.query(sqlComments, [id]);

    const sqlLikes = `
      SELECT COUNT(*) AS like_count
      FROM post_votes
      WHERE post_id = ? AND vote_type = 'upvote'
    `;
    const [likeResult] = await pool.query(sqlLikes, [id]);
    const likeCount = likeResult[0].like_count || 0;

    const sqlShares = `
      SELECT COUNT(*) AS share_count
      FROM post_votes
      WHERE post_id = ?
    `;
    const [shareResult] = await pool.query(sqlShares, [id]);
    const shareCount = shareResult[0].share_count || 0;

    const formattedComments = comments.map(comment => ({
      ...comment,
      timeSinceCommented: `${Math.floor((Date.now() - new Date(comment.created_at)) / 60000)} minutes ago`
    }));

    res.status(200).json({
      success: true,
      post: {
        ...post,
        comments: formattedComments,
        likeCount,
        shareCount,
        timeSincePosted: `${Math.floor((Date.now() - new Date(post.created_at)) / 60000)} minutes ago`,
      },
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

    const checkShareQuery = `SELECT * FROM shares WHERE post_id = ? AND user_id = ?`;
    const [existingShare] = await pool.query(checkShareQuery, [postId, userId]);

    if (existingShare.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have already shared this post',
      });
    }

    const insertShareQuery = `INSERT INTO shares (post_id, user_id) VALUES (?, ?)`;
    await pool.query(insertShareQuery, [postId, userId]);

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
    const { user } = req;
    const { postId } = req.params;

    if (!postId) {
      return res.status(400).json({
        success: false,
        message: 'Post ID is required',
      });
    }

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Content is required',
      });
    }

    const sql = 'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)';
    await pool.query(sql, [postId, user.id, content]);

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
    const { postId } = req.params;
    const userId = req.user.id; 

    const commentsSql = `
      SELECT c.id, c.content, c.created_at, c.user_id, u.username
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `;
    const [comments] = await pool.query(commentsSql, [postId]);

    const repliesSql = `
      SELECT r.id, r.content, r.created_at, r.parent_comment_id, r.user_id, u.username
      FROM replies r
      JOIN users u ON r.user_id = u.id
      WHERE r.parent_comment_id IN (SELECT id FROM comments WHERE post_id = ?)
      ORDER BY r.created_at ASC
    `;
    const [replies] = await pool.query(repliesSql, [postId]);

    const formattedComments = await Promise.all(
      comments.map(async (comment) => {
        const likeCountSql = `
          SELECT COUNT(*) AS like_count
          FROM likes
          WHERE comment_id = ?
        `;
        const [likeCountResult] = await pool.query(likeCountSql, [comment.id]);
        const likeCount = likeCountResult[0].like_count || 0;

        const userLikeSql = `
          SELECT id
          FROM likes
          WHERE comment_id = ? AND user_id = ?
        `;
        const [userLikeResult] = await pool.query(userLikeSql, [comment.id, userId]);
        const userLiked = userLikeResult.length > 0;

        const profilePictureUrl = await getProfilePictureUrl(comment.user_id);

        const commentReplies = await Promise.all(
          replies
            .filter((reply) => reply.parent_comment_id === comment.id)
            .map(async (reply) => ({
              id: reply.id,
              content: reply.content,
              created_at: reply.created_at,
              username: reply.username,
              profilePicture: await getProfilePictureUrl(reply.user_id),
              timeSinceReplied: `${Math.floor((Date.now() - new Date(reply.created_at)) / 60000)} minutes ago`,
            }))
        );

        return {
          ...comment,
          profilePicture: profilePictureUrl,
          timeSinceCommented: `${Math.floor((Date.now() - new Date(comment.created_at)) / 60000)} minutes ago`,
          likeCount,
          userLiked,
          replies: commentReplies,
        };
      })
    );

    res.status(200).json({
      success: true,
      comments: formattedComments,
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
    const userId = req.user.id;

    const commentSql = `
      SELECT c.id, c.content, c.created_at, c.user_id, u.username
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `;
    const [commentResult] = await pool.query(commentSql, [commentId]);

    if (commentResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    const comment = commentResult[0];

    const repliesSql = `
      SELECT r.id, r.content, r.created_at, r.parent_comment_id, r.user_id, u.username
      FROM replies r
      JOIN users u ON r.user_id = u.id
      WHERE r.parent_comment_id = ?
      ORDER BY r.created_at ASC
    `;
    const [replies] = await pool.query(repliesSql, [commentId]);

    const likeCountCommentSql = `
      SELECT COUNT(*) AS like_count
      FROM likes
      WHERE comment_id = ?
    `;
    const [likeCountCommentResult] = await pool.query(likeCountCommentSql, [commentId]);
    const likeCountComment = likeCountCommentResult[0].like_count || 0;

    const userLikeCommentSql = `
      SELECT id
      FROM likes
      WHERE comment_id = ? AND user_id = ?
    `;
    const [userLikeCommentResult] = await pool.query(userLikeCommentSql, [commentId, userId]);
    const userLikedComment = userLikeCommentResult.length > 0;

    const profilePictureUrlComment = await getProfilePictureUrl(comment.user_id);

    const formattedComment = {
      id: comment.id,
      content: comment.content,
      created_at: comment.created_at,
      username: comment.username,
      profilePicture: profilePictureUrlComment,
      timeSinceCommented: `${Math.floor((Date.now() - new Date(comment.created_at)) / 60000)} minutes ago`,
      likeCount: likeCountComment,
      userLiked: userLikedComment,
      replies: await Promise.all(
        replies.map(async (reply) => {
          const likeCountReplySql = `
            SELECT COUNT(*) AS like_count
            FROM likes
            WHERE comment_id = ?
          `;
          const [likeCountReplyResult] = await pool.query(likeCountReplySql, [reply.id]);
          const likeCountReply = likeCountReplyResult[0].like_count || 0;

          const userLikeReplySql = `
            SELECT id
            FROM likes
            WHERE comment_id = ? AND user_id = ?
          `;
          const [userLikeReplyResult] = await pool.query(userLikeReplySql, [reply.id, userId]);
          const userLikedReply = userLikeReplyResult.length > 0;

          const profilePictureUrlReply = await getProfilePictureUrl(reply.user_id);

          return {
            id: reply.id,
            content: reply.content,
            created_at: reply.created_at,
            username: reply.username,
            profilePicture: profilePictureUrlReply,
            timeSinceReplied: `${Math.floor((Date.now() - new Date(reply.created_at)) / 60000)} minutes ago`,
            likeCount: likeCountReply,
            userLiked: userLikedReply,
          };
        })
      ),
    };

    res.status(200).json({
      success: true,
      comment: formattedComment,
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
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.id

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Reply content is required',
      });
    }

    const sql = 'INSERT INTO replies (parent_comment_id, user_id, content) VALUES (?, ?, ?)';
    await pool.query(sql, [commentId, userId, content]);

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
    const { postId } = req.params;

    const commentsSql = `
      SELECT c.id, c.content, c.created_at, u.username,
             (SELECT COUNT(*) FROM likes WHERE comment_id = c.id) AS like_count
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `;
    const [comments] = await pool.query(commentsSql, [postId]);

    const repliesSql = `
      SELECT r.id, r.content, r.created_at, r.parent_comment_id, u.username
      FROM replies r
      JOIN users u ON r.user_id = u.id
      WHERE r.parent_comment_id IN (SELECT id FROM comments WHERE post_id = ?)
      ORDER BY r.created_at ASC
    `;
    const [replies] = await pool.query(repliesSql, [postId]);

    const commentsWithReplies = comments.map((comment) => {
      const commentReplies = replies
        .filter((reply) => reply.parent_comment_id === comment.id)
        .map((reply) => ({
          id: reply.id,
          content: reply.content,
          created_at: reply.created_at,
          username: reply.username,
          timeSinceReplied: `${Math.floor((Date.now() - new Date(reply.created_at)) / 60000)} minutes ago`,
        }));

      return {
        ...comment,
        timeSinceCommented: `${Math.floor((Date.now() - new Date(comment.created_at)) / 60000)} minutes ago`,
        replies: commentReplies,
      };
    });

    res.status(200).json({
      success: true,
      comments: commentsWithReplies,
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
    const { commentId } = req.params;
    const userId = req.user.id;

    const checkLikeQuery = 'SELECT * FROM likes WHERE comment_id = ? AND user_id = ?';
    const [existingLike] = await pool.query(checkLikeQuery, [commentId, userId]);

    if (existingLike.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have already liked this comment',
      });
    }

    const addLikeQuery = 'INSERT INTO likes (comment_id, user_id) VALUES (?, ?)';
    await pool.query(addLikeQuery, [commentId, userId]);

    const updateLikeCountQuery = 'UPDATE comments SET like_count = like_count + 1 WHERE id = ?';
    await pool.query(updateLikeCountQuery, [commentId]);

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
    const { commentId } = req.params;
    const userId = req.user.id;

    const checkLikeQuery = 'SELECT * FROM likes WHERE comment_id = ? AND user_id = ?';
    const [existingLike] = await pool.query(checkLikeQuery, [commentId, userId]);

    if (existingLike.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'You have not liked this comment yet',
      });
    }

    const removeLikeQuery = 'DELETE FROM likes WHERE comment_id = ? AND user_id = ?';
    await pool.query(removeLikeQuery, [commentId, userId]);

    const updateLikeCountQuery = 'UPDATE comments SET like_count = like_count - 1 WHERE id = ?';
    await pool.query(updateLikeCountQuery, [commentId]);

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
    const userId = req.user.id;

    const sql = `
      SELECT c.id, c.content, c.created_at, c.like_count, p.title AS post_title, p.id AS post_id
      FROM likes l
      JOIN comments c ON l.comment_id = c.id
      JOIN posts p ON c.post_id = p.id
      WHERE l.user_id = ?
      ORDER BY c.created_at DESC
    `;
    
    const [likedComments] = await pool.query(sql, [userId]);

    const formattedComments = likedComments.map(comment => ({
      ...comment,
      timeSinceLiked: `${Math.floor((Date.now() - new Date(comment.created_at)) / 60000)} minutes ago`
    }));

    res.status(200).json({
      success: true,
      likedComments: formattedComments,
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
    const { postId } = req.params;
    const userId = req.user.id; 

    const checkVoteQuery = 'SELECT vote_type FROM post_votes WHERE post_id = ? AND user_id = ?';
    const [existingVote] = await pool.query(checkVoteQuery, [postId, userId]);

    if (existingVote.length > 0) {
      if (existingVote[0].vote_type === 'upvote') {
        return res.status(400).json({ success: false, message: 'You have already upvoted this post' });
      } else if (existingVote[0].vote_type === 'downvote') {
        await pool.query('DELETE FROM post_votes WHERE post_id = ? AND user_id = ?', [postId, userId]);
      }
    }

    await pool.query('INSERT INTO post_votes (post_id, user_id, vote_type) VALUES (?, ?, ?)', [postId, userId, 'upvote']);
    await pool.query('UPDATE posts SET upvote_count = upvote_count + 1 WHERE id = ?', [postId]);

    res.status(200).json({ success: true, message: 'Upvote added successfully' });
  } catch (error) {
    console.error('Error adding upvote:', error);
    res.status(500).json({ success: false, message: 'Failed to add upvote' });
  }
};

const addDownvoteToPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const checkVoteQuery = 'SELECT vote_type FROM post_votes WHERE post_id = ? AND user_id = ?';
    const [existingVote] = await pool.query(checkVoteQuery, [postId, userId]);

    if (existingVote.length > 0) {
      if (existingVote[0].vote_type === 'downvote') {
        return res.status(400).json({ success: false, message: 'You have already downvoted this post' });
      } else if (existingVote[0].vote_type === 'upvote') {
        await pool.query('DELETE FROM post_votes WHERE post_id = ? AND user_id = ?', [postId, userId]);
        await pool.query('UPDATE posts SET upvote_count = upvote_count - 1 WHERE id = ?', [postId]);
      }
    }

    await pool.query('INSERT INTO post_votes (post_id, user_id, vote_type) VALUES (?, ?, ?)', [postId, userId, 'downvote']);
    await pool.query('UPDATE posts SET downvote_count = downvote_count + 1 WHERE id = ?', [postId]);

    res.status(200).json({ success: true, message: 'Downvote added successfully' });
  } catch (error) {
    console.error('Error adding downvote:', error);
    res.status(500).json({ success: false, message: 'Failed to add downvote' });
  }
};

const getVoteStatusById = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const checkVoteQuery = 'SELECT vote_type FROM post_votes WHERE post_id = ? AND user_id = ?';
    const [existingVote] = await pool.query(checkVoteQuery, [postId, userId]);

    if (existingVote.length > 0) {
      return res.status(200).json({
        success: true,
        message: 'Vote status retrieved successfully',
        vote_status: existingVote[0].vote_type,
      });
    }
    res.status(200).json({
      success: true,
      message: 'User has not voted yet',
      vote_status: 'no vote',
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
    const { postId } = req.params;
    const userId = req.user.id;

    const checkVoteQuery = 'SELECT vote_type FROM post_votes WHERE post_id = ? AND user_id = ?';
    const [existingVote] = await pool.query(checkVoteQuery, [postId, userId]);

    if (existingVote.length === 0 || existingVote[0].vote_type !== 'upvote') {
      return res.status(400).json({
        success: false,
        message: 'You have not upvoted this post yet',
      });
    }

    const removeUpvoteQuery = 'DELETE FROM post_votes WHERE post_id = ? AND user_id = ?';
    await pool.query(removeUpvoteQuery, [postId, userId]);

    const updateUpvoteCountQuery = 'UPDATE posts SET upvote_count = upvote_count - 1 WHERE id = ?';
    await pool.query(updateUpvoteCountQuery, [postId]);

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
    const { postId } = req.params;
    const userId = req.user.id;

    const checkVoteQuery = 'SELECT vote_type FROM post_votes WHERE post_id = ? AND user_id = ?';
    const [existingVote] = await pool.query(checkVoteQuery, [postId, userId]);

    if (existingVote.length === 0 || existingVote[0].vote_type !== 'downvote') {
      return res.status(400).json({
        success: false,
        message: 'You have not downvoted this post yet',
      });
    }

    const removeDownvoteQuery = 'DELETE FROM post_votes WHERE post_id = ? AND user_id = ?';
    await pool.query(removeDownvoteQuery, [postId, userId]);

    const updateDownvoteCountQuery = 'UPDATE posts SET downvote_count = downvote_count - 1 WHERE id = ?';
    await pool.query(updateDownvoteCountQuery, [postId]);

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
