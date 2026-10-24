const { z } = require('zod');
const { UUID_PATTERN } = require('../../shared/id');

const createBookmarkSchema = z.object({
  itemId: z.string().regex(UUID_PATTERN, 'Item ID is required'),
  type: z.enum(['post', 'article']),
});

const bookmarkIdSchema = z.object({
  id: z.string().regex(UUID_PATTERN, 'Bookmark ID is required'),
});

module.exports = { createBookmarkSchema, bookmarkIdSchema };
