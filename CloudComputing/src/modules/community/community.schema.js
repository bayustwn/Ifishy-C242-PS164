const { z } = require('zod');

const title = z
  .string({ required_error: 'Title is required', invalid_type_error: 'Title is required' })
  .trim()
  .min(1, 'Title is required')
  .max(200, 'Title is too long');

const content = z
  .string({ required_error: 'Content is required', invalid_type_error: 'Content is required' })
  .trim()
  .min(1, 'Content is required');

const imageKey = z.string().max(500).nullish();

const createPostSchema = z.object({ title, content, imageKey });

const updatePostSchema = z
  .object({ title: title.optional(), content: content.optional(), imageKey })
  .refine((body) => body.title !== undefined || body.content !== undefined || body.imageKey !== undefined, {
    message: 'No fields to update',
  });

const addCommentSchema = z.object({
  content: z
    .string({ required_error: 'Content is required', invalid_type_error: 'Content is required' })
    .trim()
    .min(1, 'Content is required'),
});

const addReplySchema = z.object({
  content: z
    .string({ required_error: 'Reply content is required', invalid_type_error: 'Reply content is required' })
    .trim()
    .min(1, 'Reply content is required'),
});

module.exports = { createPostSchema, updatePostSchema, addCommentSchema, addReplySchema };
