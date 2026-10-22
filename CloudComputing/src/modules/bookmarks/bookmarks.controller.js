const guard = require('../../shared/guard');
const { parsePagination } = require('../../shared/pagination');
const { ok, fail } = require('../../shared/response');
const bookmarkService = require('./bookmarks.service');
const { createBookmarkSchema, bookmarkIdSchema } = require('./bookmarks.schema');

const addBookmark = guard('Error handling bookmark', 'Failed to handle bookmark', async (req, res) => {
  const parsed = createBookmarkSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Invalid input data');
  }

  const outcome = await bookmarkService.addBookmark(req.user.id, parsed.data);
  if (outcome === 'removed') {
    return ok(res, null, 'Bookmark removed successfully');
  }

  return ok(res, null, 'Bookmark added successfully', 201);
});

const removeBookmark = guard('Error removing bookmark', 'Failed to remove bookmark', async (req, res) => {
  const parsed = createBookmarkSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Invalid input data');
  }

  await bookmarkService.removeBookmark(req.user.id, parsed.data);
  return ok(res, null, 'Bookmark removed successfully');
});

const getBookmarks = guard('Error fetching bookmarks', 'Failed to retrieve bookmarks', async (req, res) => {
  const bookmarks = await bookmarkService.getBookmarks(req.user.id, parsePagination(req.query));
  return ok(res, bookmarks);
});

const getBookmarkById = guard('Error fetching bookmark', 'Failed to retrieve bookmark', async (req, res) => {
  const parsed = bookmarkIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Bookmark ID is required');
  }

  const bookmark = await bookmarkService.getBookmarkById(req.user.id, Number(parsed.data.id));
  if (!bookmark) {
    return fail(res, 404, 'NOT_FOUND', 'Bookmark not found');
  }

  return ok(res, bookmark);
});

module.exports = { addBookmark, removeBookmark, getBookmarks, getBookmarkById };
