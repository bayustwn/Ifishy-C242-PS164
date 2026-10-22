const guard = require('../../shared/guard');
const firstIssueMessage = require('../../shared/validation');
const authService = require('./auth.service');
const { registerSchema, loginSchema } = require('./auth.schema');

const registerUser = guard('Error in registerUser', 'Failed to create user', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: firstIssueMessage(parsed) });
  }

  const user = await authService.registerUser(parsed.data);

  return res.status(201).json({
    success: true,
    message: 'User successfully registered!',
    user,
  });
});

const loginUser = guard('Error in loginUser', 'Failed to login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Invalid input data' });
  }

  const result = await authService.loginUser(parsed.data);

  if (result === 'not_found') {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  if (result === 'invalid') {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  return res.status(200).json({
    success: true,
    message: 'Login successful',
    token: result.token,
  });
});

const logoutUser = guard('Error in logoutUser', 'Failed to logout', async (req, res) => {
  return res.status(200).json({ success: true, message: 'Logout successful' });
});

module.exports = { registerUser, loginUser, logoutUser };
