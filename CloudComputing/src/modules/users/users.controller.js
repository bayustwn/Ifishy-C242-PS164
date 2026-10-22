const pool = require('../../config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { saveFileToDisk, profileFolder, postFolder, scanHistoryFolder } = require('../../shared/storage');

const getAllUsers = async (req, res) => {
  try {
      const [rows] = await pool.query("SELECT id, username, email FROM users");
      res.status(200).json({
          success: true,
          users: rows,
      });
  } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({
          success: false,
          message: "Failed to fetch users",
      });
  }
};

const updateUser = async (req, res) => {
  const { username, email, password, newPassword } = req.body;
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
      return res.status(401).json({
          success: false,
          message: "Token is required",
      });
  }

  try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;

      const [userRows] = await pool.query("SELECT * FROM users WHERE id = ?", [userId]);
      if (userRows.length === 0) {
          return res.status(404).json({
              success: false,
              message: "User not found",
          });
      }

      const updatedUsername = username || userRows[0].username;
      const updatedEmail = email || userRows[0].email;

      let updatedPassword = userRows[0].password;
      if (newPassword) {
          const isPasswordValid = await bcrypt.compare(password, userRows[0].password);
          if (!isPasswordValid) {
              return res.status(400).json({
                  success: false,
                  message: "Incorrect password",
              });
          }

          updatedPassword = await bcrypt.hash(newPassword, 10);
      }

      await pool.query(
          "UPDATE users SET username = ?, email = ?, password = ? WHERE id = ?",
          [updatedUsername, updatedEmail, updatedPassword, userId]
      );

      res.status(200).json({
          success: true,
          message: "User profile updated successfully",
      });
  } catch (error) {
      console.error("Error in updateUserProfile:", error);
      res.status(500).json({
          success: false,
          message: "Failed to update user profile",
      });
  }
};

const deleteUserAccount = async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
      return res.status(401).json({
          success: false,
          message: "Token is required",
      });
  }

  try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;

      const result = await pool.query("DELETE FROM users WHERE id = ?", [userId]);
      if (result.affectedRows === 0) {
          return res.status(404).json({
              success: false,
              message: "User not found",
          });
      }

      res.status(200).json({
          success: true,
          message: "User account deleted successfully",
      });
  } catch (error) {
      console.error("Error in deleteUserAccount:", error);
      res.status(500).json({
          success: false,
          message: "Failed to delete user account",
      });
  }
};

const uploadProfilePhoto = async (req, res) => {
  try {
    const { userId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const publicUrl = await saveFileToDisk(req, file, profileFolder);
    await pool.query('UPDATE users SET profile_photo = ? WHERE id = ?', [publicUrl, userId]);

    res.status(200).json({
      success: true,
      message: 'Profile photo uploaded successfully!',
      photoUrl: publicUrl,
    });
  } catch (error) {
    console.error('Error in uploadProfilePhoto:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile photo',
    });
  }
};

const updatePhotoProfile = async (req, res) => {
  try {
    const { user } = req;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const newImageUrl = await saveFileToDisk(req, file, profileFolder);
    await pool.query('UPDATE users SET profile_photo = ? WHERE id = ?', [newImageUrl, user.id]);

    res.status(200).json({
      success: true,
      message: 'Profile photo updated successfully!',
      imageUrl: newImageUrl,
    });
  } catch (error) {
    console.error('Error in updatePhotoProfile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile photo',
    });
  }
};

const getDashboardData = async (req, res) => {
  const { email } = req.params;

  try {
    const [rows] = await pool.query('SELECT id, username, email, profile_photo FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Dashboard data retrieved successfully',
      data: rows[0], 
    });
  } catch (error) {
    console.error('Error in getDashboardData:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard data',
    });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const { email } = req.params;

    const sql = 'SELECT id, username, email, profile_photo FROM users WHERE email = ?';
    const [rows] = await pool.query(sql, [email]); 

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'User profile retrieved successfully',
      profile: rows[0],
    });
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user profile',
    });
  }
};

module.exports = { getAllUsers, updateUser, deleteUserAccount, uploadProfilePhoto, updatePhotoProfile, getDashboardData, getUserProfile };
