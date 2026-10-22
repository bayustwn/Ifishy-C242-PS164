const pool = require('../../config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

async function registerUser(req, res) {
  const { username, email, password, confirmPassword } = req.body;

  if (!username || !email || !password || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'Username, email, password, and confirm password are required.',
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'Passwords do not match',
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const query = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
    const [result] = await pool.query(query, [username, email, hashedPassword]);

    res.status(201).json({
      success: true,
      message: 'User successfully registered!',
      user: {
        id: result.insertId,
        username,
        email,
      },
    });
  } catch (error) {
    console.error('Error in registerUser:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
    });
  }
}

async function loginUser(req, res) {
  const { email, password } = req.body;

  try {
    const query = 'SELECT * FROM users WHERE email = ?';
    const [rows] = await pool.query(query, [email]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = rows[0];

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error("JWT_SECRET is not defined in environment variables");
      throw new Error("JWT_SECRET is missing");
    }

    const token = jwt.sign({ id: user.id, email: user.email }, jwtSecret, { expiresIn: "2d" });


    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
    });
  } catch (error) {
    console.error('Error in loginUser:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to login',
    });
  }
}

const logoutUser = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error("Error in logoutUser:", error);
    res.status(500).json({
      success: false,
      message: "Failed to logout",
    });
  }
};

module.exports = { registerUser, loginUser, logoutUser };
