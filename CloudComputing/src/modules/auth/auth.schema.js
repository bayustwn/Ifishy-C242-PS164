const { z } = require('zod');

const REQUIRED_FIELDS = 'Username, email, password, and confirm password are required.';

const registerSchema = z
  .object({
    username: z.string({ message: REQUIRED_FIELDS }).min(1, REQUIRED_FIELDS),
    email: z.string({ message: REQUIRED_FIELDS }).min(1, REQUIRED_FIELDS),
    password: z.string({ message: REQUIRED_FIELDS }).min(1, REQUIRED_FIELDS),
    confirmPassword: z.string({ message: REQUIRED_FIELDS }).min(1, REQUIRED_FIELDS),
  })
  .refine((b) => b.password === b.confirmPassword, { message: 'Passwords do not match' });

const loginSchema = z.object({
  email: z.string().optional(),
  password: z.string().optional(),
});

module.exports = { registerSchema, loginSchema };
