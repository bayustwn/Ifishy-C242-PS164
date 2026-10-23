const { z } = require('zod');

const updateUserSchema = z.object({
  username: z.string().trim().min(1, 'username must not be empty').max(100, 'username is too long').optional(),
  email: z.union([
    z.literal(''),
    z.string().trim().email('email is invalid').max(150, 'email is too long'),
  ]).optional(),
  password: z.string().max(128, 'password is too long').optional(),
  newPassword: z
    .string()
    .max(128, 'newPassword is too long')
    .optional()
    .refine((value) => !value || value.length >= 6, 'newPassword must be at least 6 characters'),
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
