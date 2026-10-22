const { z } = require('zod');

const createBookmarkSchema = z.object({
  itemId: z.coerce.number().int().positive(),
  type: z.enum(['post', 'article']),
});

const bookmarkIdSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Bookmark ID is required'),
});

module.exports = { createBookmarkSchema, bookmarkIdSchema };
