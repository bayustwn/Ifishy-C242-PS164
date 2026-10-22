const pool = require('../../config/database');

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

module.exports = { addBookmark, removeBookmark, getBookmarks, getBookmarkById };
