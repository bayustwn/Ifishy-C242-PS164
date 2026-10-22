const bookmarkService = require('./bookmarks.service');
const { createBookmarkSchema, bookmarkIdSchema } = require('./bookmarks.schema');

const addBookmark = async (req, res) => {
  try {
    const parsed = createBookmarkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid input data' });
    }

    const outcome = await bookmarkService.addBookmark(req.user.id, parsed.data);
    if (outcome === 'removed') {
      return res.status(200).json({ success: true, message: 'Bookmark removed successfully' });
    }

    return res.status(201).json({ success: true, message: 'Bookmark added successfully' });
  } catch (error) {
    console.error('Error handling bookmark:', error);
    return res.status(500).json({ success: false, message: 'Failed to handle bookmark' });
  }
};

const removeBookmark = async (req, res) => {
  try {
    const parsed = createBookmarkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid input data' });
    }

    await bookmarkService.removeBookmark(req.user.id, parsed.data);
    return res.status(200).json({ success: true, message: 'Bookmark removed successfully' });
  } catch (error) {
    console.error('Error removing bookmark:', error);
    return res.status(500).json({ success: false, message: 'Failed to remove bookmark' });
  }
};

const getBookmarks = async (req, res) => {
  try {
    const bookmarks = await bookmarkService.getBookmarks(req.user.id);
    return res.status(200).json({ success: true, bookmarks });
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve bookmarks' });
  }
};

const getBookmarkById = async (req, res) => {
  try {
    const parsed = bookmarkIdSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Bookmark ID is required' });
    }

    const bookmark = await bookmarkService.getBookmarkById(req.user.id, Number(parsed.data.id));
    if (!bookmark) {
      return res.status(404).json({ success: false, message: 'Bookmark not found' });
    }

    return res.status(200).json({ success: true, bookmark });
  } catch (error) {
    console.error('Error fetching bookmark:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve bookmark' });
  }
};

module.exports = { addBookmark, removeBookmark, getBookmarks, getBookmarkById };
