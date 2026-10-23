const { z } = require('zod');

const updateUserSchema = z.object({
  username: z.string().optional(),
  email: z.string().optional(),
  password: z.string().optional(),
  newPassword: z.string().optional(),
});

const photoKeySchema = z.object({
  imageKey: z
    .string({ required_error: 'imageKey is required', invalid_type_error: 'imageKey is required' })
    .min(1, 'imageKey is required'),
});

const emailParamsSchema = z.object({
  email: z.string().optional(),
});

module.exports = { updateUserSchema, photoKeySchema, emailParamsSchema };
