const guard = require('../../shared/guard');
const { parsePagination } = require('../../shared/pagination');
const { verifyToken } = require('../../shared/token');
const { ok, fail } = require('../../shared/response');
const usersService = require('./users.service');
const { updateUserSchema, photoUserIdSchema, emailParamsSchema } = require('./users.schema');
const { saveFileToDisk, profileFolder } = require('../../shared/storage');

const getUserIdFromToken = async (token) => (await verifyToken(token)).id;

const getAllUsers = guard('Error fetching users', 'Failed to fetch users', async (req, res) => {
  const users = await usersService.getAllUsers(parsePagination(req.query));
  return ok(res, users);
});

const updateUser = guard('Error in updateUserProfile', 'Failed to update user profile', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return fail(res, 401, 'UNAUTHORIZED', 'Token is required');
  }

  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to update user profile');
  }

  const userId = await getUserIdFromToken(token);
  const result = await usersService.updateUser(userId, parsed.data);

  if (result === 'not_found') {
    return fail(res, 404, 'NOT_FOUND', 'User not found');
  }
  if (result === 'incorrect_password') {
    return fail(res, 400, 'INVALID_CREDENTIALS', 'Incorrect password');
  }

  return ok(res, null, 'User profile updated successfully');
});

const deleteUserAccount = guard('Error in deleteUserAccount', 'Failed to delete user account', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return fail(res, 401, 'UNAUTHORIZED', 'Token is required');
  }

  const userId = await getUserIdFromToken(token);
  const result = await usersService.deleteUserAccount(userId);

  if (result === 'not_found') {
    return fail(res, 404, 'NOT_FOUND', 'User not found');
  }

  return ok(res, null, 'User account deleted successfully');
});

const uploadProfilePhoto = guard('Error in uploadProfilePhoto', 'Failed to upload profile photo', async (req, res) => {
  const parsed = photoUserIdSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return fail(res, 400, 'UPLOAD_ERROR', 'No file uploaded');
  }

  const file = req.file;
  if (!file) {
    return fail(res, 400, 'UPLOAD_ERROR', 'No file uploaded');
  }

  const publicUrl = await saveFileToDisk(req, file, profileFolder);
  await usersService.setProfilePhotoByUserId(parsed.data.userId, publicUrl);

  return ok(res, { photoUrl: publicUrl }, 'Profile photo uploaded successfully!');
});

const updatePhotoProfile = guard('Error in updatePhotoProfile', 'Failed to update profile photo', async (req, res) => {
  const file = req.file;
  if (!file) {
    return fail(res, 400, 'UPLOAD_ERROR', 'No file uploaded');
  }

  const newImageUrl = await saveFileToDisk(req, file, profileFolder);
  await usersService.setProfilePhotoByUserId(req.user.id, newImageUrl);

  return ok(res, { imageUrl: newImageUrl }, 'Profile photo updated successfully!');
});

const getDashboardData = guard('Error in getDashboardData', 'Failed to retrieve dashboard data', async (req, res) => {
  const parsed = emailParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return fail(res, 404, 'NOT_FOUND', 'User not found');
  }

  const data = await usersService.getDashboardByEmail(parsed.data.email);
  if (!data) {
    return fail(res, 404, 'NOT_FOUND', 'User not found');
  }

  return ok(res, data, 'Dashboard data retrieved successfully');
});

const getUserProfile = guard('Error in getUserProfile', 'Failed to retrieve user profile', async (req, res) => {
  const parsed = emailParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return fail(res, 404, 'NOT_FOUND', 'User not found');
  }

  const profile = await usersService.getProfileByEmail(parsed.data.email);
  if (!profile) {
    return fail(res, 404, 'NOT_FOUND', 'User not found');
  }

  return ok(res, profile, 'User profile retrieved successfully');
});

module.exports = { getAllUsers, updateUser, deleteUserAccount, uploadProfilePhoto, updatePhotoProfile, getDashboardData, getUserProfile };
