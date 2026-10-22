const { z } = require('zod');

const updateUserSchema = z.object({
  username: z.string().optional(),
  email: z.string().optional(),
  password: z.string().optional(),
  newPassword: z.string().optional(),
});

const photoUserIdSchema = z.object({
  userId: z.coerce.number().int().optional(),
});

const emailParamsSchema = z.object({
  email: z.string().optional(),
});

module.exports = { updateUserSchema, photoUserIdSchema, emailParamsSchema };
