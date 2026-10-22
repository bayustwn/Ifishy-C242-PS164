const guard = require('../../shared/guard');
const firstIssueMessage = require('../../shared/validation');
const { ok, fail } = require('../../shared/response');
const authService = require('./auth.service');
const { registerSchema, loginSchema } = require('./auth.schema');

const registerUser = guard('Error in registerUser', 'Failed to create user', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, 'VALIDATION_ERROR', firstIssueMessage(parsed));
  }

  const user = await authService.registerUser(parsed.data);

  return ok(res, user, 'User successfully registered!', 201);
});

const loginUser = guard('Error in loginUser', 'Failed to login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Invalid input data');
  }

  const result = await authService.loginUser(parsed.data);

  if (result === 'not_found') {
    return fail(res, 404, 'NOT_FOUND', 'User not found');
  }
  if (result === 'invalid') {
    return fail(res, 401, 'INVALID_CREDENTIALS', 'Invalid credentials');
  }

  return ok(res, { token: result.token }, 'Login successful');
});

const logoutUser = guard('Error in logoutUser', 'Failed to logout', async (req, res) => {
  return ok(res, null, 'Logout successful');
});

module.exports = { registerUser, loginUser, logoutUser };
