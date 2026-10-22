const authService = require('./auth.service');
const { registerSchema, loginSchema } = require('./auth.schema');

const registerUser = async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    }

    const user = await authService.registerUser(parsed.data);

    return res.status(201).json({
      success: true,
      message: 'User successfully registered!',
      user,
    });
  } catch (error) {
    console.error('Error in registerUser:', error);
    return res.status(500).json({ success: false, message: 'Failed to create user' });
  }
};

const loginUser = async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error in loginUser:', error);
    return res.status(500).json({ success: false, message: 'Failed to login' });
  }
};

const logoutUser = async (req, res) => {
  try {
    return res.status(200).json({ success: true, message: 'Logout successful' });
  } catch (error) {
    console.error('Error in logoutUser:', error);
    return res.status(500).json({ success: false, message: 'Failed to logout' });
  }
};

module.exports = { registerUser, loginUser, logoutUser };
