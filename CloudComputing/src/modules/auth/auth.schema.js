const { z } = require('zod');

const REQUIRED_FIELDS = 'Username, email, password, and confirm password are required.';

const registerSchema = z
  .object({
    username: z.string({ message: REQUIRED_FIELDS }).trim().min(3, 'Username must be at least 3 characters').max(100, 'Username is too long'),
    email: z.string({ message: REQUIRED_FIELDS }).trim().email('Invalid email format').max(150, 'Email is too long'),
    password: z.string({ message: REQUIRED_FIELDS }).min(8, 'Password must be at least 8 characters').max(128, 'Password is too long'),
    confirmPassword: z.string({ message: REQUIRED_FIELDS }).min(1, REQUIRED_FIELDS),
  })
  .refine((b) => b.password === b.confirmPassword, { message: 'Passwords do not match' });

const loginSchema = z.object({
  email: z.string({ message: 'Email and password are required' }).trim().email('Invalid email format'),
  password: z.string({ message: 'Email and password are required' }).min(1, 'Email and password are required'),
});

module.exports = { registerSchema, loginSchema };
