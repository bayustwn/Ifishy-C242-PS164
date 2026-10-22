const guard = require('../../shared/guard');
const { parsePagination } = require('../../shared/pagination');
const { verifyToken } = require('../../shared/token');
const usersService = require('./users.service');
const { updateUserSchema, photoUserIdSchema, emailParamsSchema } = require('./users.schema');
const { saveFileToDisk, profileFolder } = require('../../shared/storage');

const getUserIdFromToken = async (token) => (await verifyToken(token)).id;

const getAllUsers = guard('Error fetching users', 'Failed to fetch users', async (req, res) => {
  const users = await usersService.getAllUsers(parsePagination(req.query));
  return res.status(200).json({ success: true, users });
});

const updateUser = guard('Error in updateUserProfile', 'Failed to update user profile', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token is required' });
  }

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
});

const deleteUserAccount = guard('Error in deleteUserAccount', 'Failed to delete user account', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token is required' });
  }

  const userId = await getUserIdFromToken(token);
  const result = await usersService.deleteUserAccount(userId);

  if (result === 'not_found') {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  return res.status(200).json({ success: true, message: 'User account deleted successfully' });
});

const uploadProfilePhoto = guard('Error in uploadProfilePhoto', 'Failed to upload profile photo', async (req, res) => {
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
});

const updatePhotoProfile = guard('Error in updatePhotoProfile', 'Failed to update profile photo', async (req, res) => {
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
});

const getDashboardData = guard('Error in getDashboardData', 'Failed to retrieve dashboard data', async (req, res) => {
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
});

const getUserProfile = guard('Error in getUserProfile', 'Failed to retrieve user profile', async (req, res) => {
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
});

module.exports = { getAllUsers, updateUser, deleteUserAccount, uploadProfilePhoto, updatePhotoProfile, getDashboardData, getUserProfile };
