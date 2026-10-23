const guard = require('../../shared/guard');
const firstIssueMessage = require('../../shared/validation');
const { ok, fail } = require('../../shared/response');
const logger = require('../../shared/logger');
const r2 = require('../../shared/r2');
const usersService = require('./users.service');
const { updateUserSchema, photoKeySchema, emailParamsSchema } = require('./users.schema');

const replacePhoto = async (userId, imageKey) => {
  if (!r2.isOwnedKey(imageKey, 'avatar', userId)) {
    return { error: 'Invalid imageKey' };
  }

  try {
    await r2.verifyUpload(imageKey);
  } catch {
    return { error: 'Upload not found or invalid' };
  }

  const previous = await usersService.replaceProfilePhoto(userId, imageKey);
  if (previous && previous !== imageKey) {
    await r2.deleteOwned(previous, 'avatar', userId).catch((err) => {
      logger.warn({ err, key: previous }, 'Failed to delete replaced profile photo');
    });
  }

  return { url: r2.resolveMediaUrl(imageKey) };
};

const updateUser = guard('Error in updateUserProfile', 'Failed to update user profile', async (req, res) => {
  const parsed = updateUserSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return fail(res, 400, 'VALIDATION_ERROR', firstIssueMessage(parsed));
  }

  const result = await usersService.updateUser(req.user.id, parsed.data);

  if (result === 'not_found') {
    return fail(res, 404, 'NOT_FOUND', 'User not found');
  }
  if (result === 'incorrect_password') {
    return fail(res, 400, 'INVALID_CREDENTIALS', 'Incorrect password');
  }
  if (result === 'conflict') {
    return fail(res, 409, 'CONFLICT', 'Username or email is already used');
  }

  return ok(res, null, 'User profile updated successfully');
});

const deleteUserAccount = guard('Error in deleteUserAccount', 'Failed to delete user account', async (req, res) => {
  const result = await usersService.deleteUserAccount(req.user.id);

  if (result === 'not_found') {
    return fail(res, 404, 'NOT_FOUND', 'User not found');
  }

  return ok(res, null, 'User account deleted successfully');
});

const uploadProfilePhoto = guard('Error in uploadProfilePhoto', 'Failed to upload profile photo', async (req, res) => {
  const parsed = photoKeySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return fail(res, 400, 'VALIDATION_ERROR', firstIssueMessage(parsed));
  }

  const result = await replacePhoto(req.user.id, parsed.data.imageKey);
  if (result.error) {
    return fail(res, 400, 'VALIDATION_ERROR', result.error);
  }

  return ok(res, { photoUrl: result.url }, 'Profile photo uploaded successfully!');
});

const updatePhotoProfile = guard('Error in updatePhotoProfile', 'Failed to update profile photo', async (req, res) => {
  const parsed = photoKeySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return fail(res, 400, 'VALIDATION_ERROR', firstIssueMessage(parsed));
  }

  const result = await replacePhoto(req.user.id, parsed.data.imageKey);
  if (result.error) {
    return fail(res, 400, 'VALIDATION_ERROR', result.error);
  }

  return ok(res, { imageUrl: result.url }, 'Profile photo updated successfully!');
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

module.exports = { updateUser, deleteUserAccount, uploadProfilePhoto, updatePhotoProfile, getDashboardData, getUserProfile };
