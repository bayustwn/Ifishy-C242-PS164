const { jwtVerify } = require('jose');
const usersService = require('./users.service');
const { updateUserSchema, photoUserIdSchema, emailParamsSchema } = require('./users.schema');
const { saveFileToDisk, profileFolder } = require('../../shared/storage');

const encoder = new TextEncoder();

const getUserIdFromToken = async (token) => {
  const { payload } = await jwtVerify(token, encoder.encode(process.env.JWT_SECRET));
  return payload.id;
};

const getAllUsers = async (req, res) => {
  try {
    const users = await usersService.getAllUsers();
    return res.status(200).json({ success: true, users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};

const updateUser = async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token is required' });
  }

  try {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(500).json({ success: false, message: 'Failed to update user profile' });
    }

    const userId = await getUserIdFromToken(token);
    const result = await usersService.updateUser(userId, parsed.data);

    if (result === 'not_found') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (result === 'incorrect_password') {
      return res.status(400).json({ success: false, message: 'Incorrect password' });
    }

    return res.status(200).json({ success: true, message: 'User profile updated successfully' });
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
    return res.status(500).json({ success: false, message: 'Failed to update user profile' });
  }
};

const deleteUserAccount = async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token is required' });
  }

  try {
    const userId = await getUserIdFromToken(token);
    const result = await usersService.deleteUserAccount(userId);

    if (result === 'not_found') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({ success: true, message: 'User account deleted successfully' });
  } catch (error) {
    console.error('Error in deleteUserAccount:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete user account' });
  }
};

const uploadProfilePhoto = async (req, res) => {
  try {
    const parsed = photoUserIdSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const publicUrl = await saveFileToDisk(req, file, profileFolder);
    await usersService.setProfilePhotoByUserId(parsed.data.userId, publicUrl);

    return res.status(200).json({
      success: true,
      message: 'Profile photo uploaded successfully!',
      photoUrl: publicUrl,
    });
  } catch (error) {
    console.error('Error in uploadProfilePhoto:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload profile photo' });
  }
};

const updatePhotoProfile = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const newImageUrl = await saveFileToDisk(req, file, profileFolder);
    await usersService.setProfilePhotoByUserId(req.user.id, newImageUrl);

    return res.status(200).json({
      success: true,
      message: 'Profile photo updated successfully!',
      imageUrl: newImageUrl,
    });
  } catch (error) {
    console.error('Error in updatePhotoProfile:', error);
    return res.status(500).json({ success: false, message: 'Failed to update profile photo' });
  }
};

const getDashboardData = async (req, res) => {
  try {
    const parsed = emailParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const data = await usersService.getDashboardByEmail(parsed.data.email);
    if (!data) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Dashboard data retrieved successfully',
      data,
    });
  } catch (error) {
    console.error('Error in getDashboardData:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve dashboard data' });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const parsed = emailParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const profile = await usersService.getProfileByEmail(parsed.data.email);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'User profile retrieved successfully',
      profile,
    });
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve user profile' });
  }
};

module.exports = { getAllUsers, updateUser, deleteUserAccount, uploadProfilePhoto, updatePhotoProfile, getDashboardData, getUserProfile };
