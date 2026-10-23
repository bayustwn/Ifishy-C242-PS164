const { z } = require('zod');

const postBodySchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  imageKey: z.string().max(500).nullish(),
});

const addCommentSchema = z.object({
  content: z
    .string({ required_error: 'Content is required', invalid_type_error: 'Content is required' })
    .min(1, 'Content is required'),
});

const addReplySchema = z.object({
  content: z
    .string({ required_error: 'Reply content is required', invalid_type_error: 'Reply content is required' })
    .min(1, 'Reply content is required'),
});

module.exports = { postBodySchema, addCommentSchema, addReplySchema };
