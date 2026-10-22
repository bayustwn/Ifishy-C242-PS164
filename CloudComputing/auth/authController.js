const pool = require('../config/dbConfig');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const puppeteer = require('puppeteer');

// Local disk storage (replaces GCS for dev deploy)
const fs = require('fs');
const path = require('path');
const bucketName = 'uploads';
const profileFolder = 'photo-profile-user';
const postFolder = 'image-post';
const scanHistoryFolder = 'scan-history';

const saveFileToDisk = (req, file, folder) => new Promise((resolve, reject) => {
  try {
    const dir = path.join(__dirname, '..', 'uploads', folder);
    fs.mkdirSync(dir, { recursive: true });
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${Date.now()}-${safeName}`;
    fs.writeFileSync(path.join(dir, fileName), file.buffer);
    resolve(`${req.protocol}://${req.get('host')}/uploads/${folder}/${fileName}`);
  } catch (err) { reject(err); }
});

async function registerUser(req, res) {
  const { username, email, password, confirmPassword } = req.body;

  if (!username || !email || !password || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'Username, email, password, and confirm password are required.',
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'Passwords do not match',
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const query = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
    const [result] = await pool.query(query, [username, email, hashedPassword]);

    res.status(201).json({
      success: true,
      message: 'User successfully registered!',
      user: {
        id: result.insertId,
        username,
        email,
      },
    });
  } catch (error) {
    console.error('Error in registerUser:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
    });
  }
}

async function loginUser(req, res) {
  const { email, password } = req.body;

  try {
    const query = 'SELECT * FROM users WHERE email = ?';
    const [rows] = await pool.query(query, [email]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = rows[0];

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error("JWT_SECRET is not defined in environment variables");
      throw new Error("JWT_SECRET is missing");
    }

    const token = jwt.sign({ id: user.id, email: user.email }, jwtSecret, { expiresIn: "2d" });


    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
    });
  } catch (error) {
    console.error('Error in loginUser:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to login',
    });
  }
}

const getAllUsers = async (req, res) => {
  try {
      const [rows] = await pool.query("SELECT id, username, email FROM users");
      res.status(200).json({
          success: true,
          users: rows,
      });
  } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({
          success: false,
          message: "Failed to fetch users",
      });
  }
};

const updateUser = async (req, res) => {
  const { username, email, password, newPassword } = req.body;
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
      return res.status(401).json({
          success: false,
          message: "Token is required",
      });
  }

  try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;

      const [userRows] = await pool.query("SELECT * FROM users WHERE id = ?", [userId]);
      if (userRows.length === 0) {
          return res.status(404).json({
              success: false,
              message: "User not found",
          });
      }

      const updatedUsername = username || userRows[0].username;
      const updatedEmail = email || userRows[0].email;

      let updatedPassword = userRows[0].password;
      if (newPassword) {
          const isPasswordValid = await bcrypt.compare(password, userRows[0].password);
          if (!isPasswordValid) {
              return res.status(400).json({
                  success: false,
                  message: "Incorrect password",
              });
          }

          updatedPassword = await bcrypt.hash(newPassword, 10);
      }

      await pool.query(
          "UPDATE users SET username = ?, email = ?, password = ? WHERE id = ?",
          [updatedUsername, updatedEmail, updatedPassword, userId]
      );

      res.status(200).json({
          success: true,
          message: "User profile updated successfully",
      });
  } catch (error) {
      console.error("Error in updateUserProfile:", error);
      res.status(500).json({
          success: false,
          message: "Failed to update user profile",
      });
  }
};

const deleteUserAccount = async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
      return res.status(401).json({
          success: false,
          message: "Token is required",
      });
  }

  try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;

      const result = await pool.query("DELETE FROM users WHERE id = ?", [userId]);
      if (result.affectedRows === 0) {
          return res.status(404).json({
              success: false,
              message: "User not found",
          });
      }

      res.status(200).json({
          success: true,
          message: "User account deleted successfully",
      });
  } catch (error) {
      console.error("Error in deleteUserAccount:", error);
      res.status(500).json({
          success: false,
          message: "Failed to delete user account",
      });
  }
};

const logoutUser = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error("Error in logoutUser:", error);
    res.status(500).json({
      success: false,
      message: "Failed to logout",
    });
  }
};

const uploadProfilePhoto = async (req, res) => {
  try {
    const { userId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const publicUrl = await saveFileToDisk(req, file, profileFolder);
    await pool.query('UPDATE users SET profile_photo = ? WHERE id = ?', [publicUrl, userId]);

    res.status(200).json({
      success: true,
      message: 'Profile photo uploaded successfully!',
      photoUrl: publicUrl,
    });
  } catch (error) {
    console.error('Error in uploadProfilePhoto:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile photo',
    });
  }
};

const updatePhotoProfile = async (req, res) => {
  try {
    const { user } = req;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const newImageUrl = await saveFileToDisk(req, file, profileFolder);
    await pool.query('UPDATE users SET profile_photo = ? WHERE id = ?', [newImageUrl, user.id]);

    res.status(200).json({
      success: true,
      message: 'Profile photo updated successfully!',
      imageUrl: newImageUrl,
    });
  } catch (error) {
    console.error('Error in updatePhotoProfile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile photo',
    });
  }
};

const getDashboardData = async (req, res) => {
  const { email } = req.params;

  try {
    const [rows] = await pool.query('SELECT id, username, email, profile_photo FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Dashboard data retrieved successfully',
      data: rows[0], 
    });
  } catch (error) {
    console.error('Error in getDashboardData:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard data',
    });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const { email } = req.params;

    const sql = 'SELECT id, username, email, profile_photo FROM users WHERE email = ?';
    const [rows] = await pool.query(sql, [email]); 

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'User profile retrieved successfully',
      profile: rows[0],
    });
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user profile',
    });
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

const getArticleById = async (req, res) => {
  try {
    const { id } = req.params;
    const sql = 'SELECT * FROM articles WHERE id = ?';
    const [article] = await pool.query(sql, [id]);

    if (article.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Article not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Article fetched successfully',
      data: article[0],
    });
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch article',
    });
  }
};

const getAllArticles = async (req, res) => {
  try {
    const sql = 'SELECT * FROM articles ORDER BY published_at DESC';
    const [articles] = await pool.query(sql);

    res.status(200).json({
      success: true,
      message: 'Articles fetched successfully',
      data: articles,
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch articles',
    });
  }
};

const scrapeArticle = async (url) => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);

    const result = await page.evaluate(() => {
      const title = document.querySelector('h1')?.innerText || '';
      const author = document.querySelector('.author-name')?.innerText || '';
      const content = document.querySelector('.content-body')?.innerHTML || '';
      const coverImage = document.querySelector('.lazyloaded')?.src || '';

      const publicationTime = document.querySelector('time[itemprop="datePublished"]')?.getAttribute('datetime') || 'Unknown publication date';

      const images = [];
      document.querySelectorAll('.placeholder-container').forEach((img) => {
        let imageUrl = img.getAttribute('data-src');
        
        if (!imageUrl) {
          const srcset = img.getAttribute('srcset');
          if (srcset) {
            const srcsetArray = srcset.split(',').map(item => item.trim());
            const highestResolution = srcsetArray[srcsetArray.length - 1];
            imageUrl = highestResolution.split(' ')[0];
          }
        }

        if (!imageUrl) {
          imageUrl = img.getAttribute('src');
        }

        const description = img.getAttribute('alt') || 'No description';

        if (imageUrl) {
          images.push({ imageUrl, description });
        }
      });

      return { title, content, author, coverImage, images, publicationTime };
    });

    await browser.close();
    return {
      ...result,
      success: true,
    };
  } catch (error) {
    console.error('Error scraping article:', error);
    return {
      success: false,
      message: 'Failed to scrape article',
    };
  }
};

const getArticleFromUrl = async (req, res) => {
  try {
    const { url } = req.params;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL parameter is required',
      });
    }

    let fullUrl = url;
    if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
      fullUrl = 'https://' + fullUrl;
    }

    const result = await scrapeArticle(fullUrl);

    if (result.success) {
      const { title, content, author, coverImage, publicationTime } = result;
      const formattedPublicationTime = new Date(publicationTime)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');

      const insertArticleSql = `
        INSERT INTO articles (title, content, author, published_at, cover_image)
        VALUES (?, ?, ?, ?, ?)
      `;

      const [insertResult] = await pool.query(insertArticleSql, [
        title,
        content,
        author,
        formattedPublicationTime,
        coverImage,
      ]);

      res.status(200).json({
        success: true,
        message: 'Article scraped and saved successfully',
        articleId: insertResult.insertId,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    console.error('Error scraping and saving article:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to scrape and save article',
    });
  }
};

const addBookmark = async (req, res) => {
  try {
    const { itemId, type } = req.body;
    const userId = req.user.id;
    if (!itemId || !type || !['post', 'article'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
      });
    }

    const checkBookmarkSql = `
      SELECT id FROM bookmarks WHERE user_id = ? AND item_id = ? AND type = ?
    `;
    const [existingBookmark] = await pool.query(checkBookmarkSql, [userId, itemId, type]);

    if (existingBookmark.length > 0) {
      const deleteBookmarkSql = `
        DELETE FROM bookmarks WHERE id = ?
      `;
      await pool.query(deleteBookmarkSql, [existingBookmark[0].id]);

      res.status(200).json({
        success: true,
        message: 'Bookmark removed successfully',
      });
    } else {
      const addBookmarkSql = `
        INSERT INTO bookmarks (user_id, type, item_id)
        VALUES (?, ?, ?)
      `;
      await pool.query(addBookmarkSql, [userId, type, itemId]);

      res.status(201).json({
        success: true,
        message: 'Bookmark added successfully',
      });
    }
  } catch (error) {
    console.error('Error handling bookmark:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to handle bookmark',
    });
  }
};

const removeBookmark = async (req, res) => {
  try {
    const { itemId, type } = req.body;
    const userId = req.user.id; 

    if (!itemId || !type || !['post', 'article'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
      });
    }

    const removeBookmarkSql = `
      DELETE FROM bookmarks WHERE user_id = ? AND item_id = ? AND type = ?
    `;
    await pool.query(removeBookmarkSql, [userId, itemId, type]);

    res.status(200).json({
      success: true,
      message: 'Bookmark removed successfully',
    });
  } catch (error) {
    console.error('Error removing bookmark:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove bookmark',
    });
  }
};

const getBookmarks = async (req, res) => {
  try {
    const userId = req.user.id;

    const getBookmarksSql = `
      SELECT b.id, b.type, b.item_id, 
        CASE 
          WHEN b.type = 'post' THEN (SELECT title FROM posts WHERE id = b.item_id)
          WHEN b.type = 'article' THEN (SELECT title FROM articles WHERE id = b.item_id)
        END AS title,
        b.created_at
      FROM bookmarks b
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
    `;
    const [bookmarks] = await pool.query(getBookmarksSql, [userId]);

    res.status(200).json({
      success: true,
      bookmarks,
    });
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve bookmarks',
    });
  }
};

const getBookmarkById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Bookmark ID is required',
      });
    }

    const getBookmarkSql = `
      SELECT b.id, b.type, b.item_id, 
        CASE 
          WHEN b.type = 'post' THEN (SELECT title FROM posts WHERE id = b.item_id)
          WHEN b.type = 'article' THEN (SELECT title FROM articles WHERE id = b.item_id)
        END AS title,
        b.created_at
      FROM bookmarks b
      WHERE b.user_id = ? AND b.id = ?
    `;

    const [bookmark] = await pool.query(getBookmarkSql, [userId, id]);

    if (bookmark.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bookmark not found',
      });
    }

    res.status(200).json({
      success: true,
      bookmark: bookmark[0],
    });
  } catch (error) {
    console.error('Error fetching bookmark:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve bookmark',
    });
  }
};

const saveScanHistory = async (req, res) => {
  const { userId, disease, confidence, description, treatment, validation } = req.body;

  if (!userId || !disease || !confidence || !description || !treatment || !req.file) {
    return res.status(400).json({ message: "Semua data harus diisi!" });
  }

  const confidenceValue = parseFloat(confidence);
  if (isNaN(confidenceValue)) {
    return res.status(400).json({ message: "Confidence harus berupa angka desimal!" });
  }

  if (description.length > 1000) {
    return res.status(400).json({ message: "Deskripsi terlalu panjang (maksimal 1000 karakter)." });
  }
  if (treatment.length > 1000) {
    return res.status(400).json({ message: "Langkah penanganan terlalu panjang (maksimal 1000 karakter)." });
  }
  if (validation && validation.length > 1000) {
    return res.status(400).json({ message: "Validasi terlalu panjang (maksimal 1000 karakter)." });
  }

  try {
    const fishImageUrl = await saveFileToDisk(req, req.file, scanHistoryFolder);
    const query = `
      INSERT INTO scan_history (user_id, fish_image, disease, confidence, description, treatment, validation, scan_timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    await pool.query(query, [userId, fishImageUrl, disease, confidenceValue, description, treatment, validation || null]);

    res.status(201).json({
      message: "Riwayat scan berhasil disimpan!",
      data: { imageUrl: fishImageUrl, fishName: disease, accuracy: confidenceValue },
    });
  } catch (error) {
    console.error('Error saat menyimpan scan history:', error.message);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

const getScanHistoryById = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ message: "User ID diperlukan!" });
  }

  try {
    const query = `
      SELECT id, user_id, fish_image, disease, confidence, description, treatment, validation, scan_timestamp 
      FROM scan_history 
      WHERE user_id = ? 
      ORDER BY scan_timestamp DESC
    `;

    const [results] = await pool.query(query, [userId]);

    if (results.length === 0) {
      return res.status(404).json({ message: "Scan history tidak ditemukan untuk user ini." });
    }

    res.status(200).json({
      message: "Scan history berhasil diambil!",
      data: results.map((history) => ({
        id: history.id,
        userId: history.user_id,
        fishImage: history.fish_image,
        disease: history.disease,
        confidence: parseFloat(history.confidence),
        description: history.description,
        treatment: history.treatment,
        validation: history.validation,
        scanTimestamp: history.scan_timestamp,
      })),
    });
  } catch (error) {
    console.error("Error saat mengambil scan history:", error.message);
    res.status(500).json({ message: "Gagal mengambil scan history." });
  }
};

module.exports = { 
  registerUser, 
  loginUser, 
  getAllUsers, 
  updateUser, 
  deleteUserAccount,
  logoutUser,
  uploadProfilePhoto,
  updatePhotoProfile,
  getDashboardData,
  getUserProfile,
  createPost,
  getPosts,
  updatePost,
  getPostById,
  addShareToPost,
  addComment,
  getComments,
  getCommentsById,
  addReplyToComment,
  getCommentsWithReplies,
  addLikeToComment,
  removeLikeFromComment,
  getLikedCommentsByUser,
  addUpvoteToPost,
  addDownvoteToPost,
  removeUpvoteFromPost,
  removeDownvoteFromPost,
  getVoteStatusById,
  getArticleById,
  getAllArticles,
  getArticleFromUrl,
  addBookmark,
  removeBookmark,
  getBookmarks,
  getBookmarkById,
  saveScanHistory,
  getScanHistoryById }