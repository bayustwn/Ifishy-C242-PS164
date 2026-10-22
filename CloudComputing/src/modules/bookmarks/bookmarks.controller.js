const guard = require('../../shared/guard');
const { parsePagination } = require('../../shared/pagination');
const bookmarkService = require('./bookmarks.service');
const { createBookmarkSchema, bookmarkIdSchema } = require('./bookmarks.schema');

const addBookmark = guard('Error handling bookmark', 'Failed to handle bookmark', async (req, res) => {
  const parsed = createBookmarkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Invalid input data' });
  }

  const outcome = await bookmarkService.addBookmark(req.user.id, parsed.data);
  if (outcome === 'removed') {
    return res.status(200).json({ success: true, message: 'Bookmark removed successfully' });
  }

  return res.status(201).json({ success: true, message: 'Bookmark added successfully' });
});

const removeBookmark = guard('Error removing bookmark', 'Failed to remove bookmark', async (req, res) => {
  const parsed = createBookmarkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Invalid input data' });
  }

  await bookmarkService.removeBookmark(req.user.id, parsed.data);
  return res.status(200).json({ success: true, message: 'Bookmark removed successfully' });
});

const getBookmarks = guard('Error fetching bookmarks', 'Failed to retrieve bookmarks', async (req, res) => {
  const bookmarks = await bookmarkService.getBookmarks(req.user.id, parsePagination(req.query));
  return res.status(200).json({ success: true, bookmarks });
});

const getBookmarkById = guard('Error fetching bookmark', 'Failed to retrieve bookmark', async (req, res) => {
  const parsed = bookmarkIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Bookmark ID is required' });
  }

  const bookmark = await bookmarkService.getBookmarkById(req.user.id, Number(parsed.data.id));
  if (!bookmark) {
    return res.status(404).json({ success: false, message: 'Bookmark not found' });
  }

  return res.status(200).json({ success: true, bookmark });
});

module.exports = { addBookmark, removeBookmark, getBookmarks, getBookmarkById };
