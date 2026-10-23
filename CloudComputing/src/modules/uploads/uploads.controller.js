const guard = require('../../shared/guard');
const firstIssueMessage = require('../../shared/validation');
const { ok, fail } = require('../../shared/response');
const r2 = require('../../shared/r2');
const uploadsService = require('./uploads.service');
const { presignSchema, keyBodySchema } = require('./uploads.schema');

const isUploadNotFound = (error) =>
  error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404;

const storageUnavailable = (res) =>
  fail(res, 503, 'STORAGE_UNAVAILABLE', 'Object storage is not configured');

const presignUpload = guard('Error creating upload URL', 'Failed to create upload URL', async (req, res) => {
  if (!r2.isConfigured()) return storageUnavailable(res);

  const parsed = presignSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return fail(res, 400, 'VALIDATION_ERROR', firstIssueMessage(parsed));
  }

  const upload = await r2.presignUpload({ ...parsed.data, userId: req.user.id });
  return ok(res, upload, 'Upload URL created');
});

const completeUpload = guard('Error verifying upload', 'Failed to verify upload', async (req, res) => {
  if (!r2.isConfigured()) return storageUnavailable(res);

  const parsed = keyBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return fail(res, 400, 'VALIDATION_ERROR', firstIssueMessage(parsed));
  }

  const info = r2.parseKey(parsed.data.key);
  if (!info) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Invalid upload key');
  }
  if (info.userId !== Number(req.user.id)) {
    return fail(res, 403, 'FORBIDDEN', 'Upload does not belong to this user');
  }

  try {
    const verified = await r2.verifyUpload(parsed.data.key);
    const url = await r2.resolveMediaUrl(parsed.data.key);
    return ok(res, { key: parsed.data.key, url, contentType: verified.contentType, size: verified.size }, 'Upload verified');
  } catch (error) {
    if (error.code === 'INVALID_KEY') {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid upload key');
    }
    if (error.code === 'INVALID_UPLOAD') {
      return fail(res, 400, 'VALIDATION_ERROR', error.message);
    }
    if (isUploadNotFound(error)) {
      return fail(res, 404, 'NOT_FOUND', 'Upload not found');
    }
    throw error;
  }
});

const deleteUpload = guard('Error deleting upload', 'Failed to delete upload', async (req, res) => {
  if (!r2.isConfigured()) return storageUnavailable(res);

  const parsed = keyBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return fail(res, 400, 'VALIDATION_ERROR', firstIssueMessage(parsed));
  }

  const info = r2.parseKey(parsed.data.key);
  if (!info) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Invalid upload key');
  }
  if (info.userId !== Number(req.user.id)) {
    return fail(res, 403, 'FORBIDDEN', 'Upload does not belong to this user');
  }

  const usage = await uploadsService.findUsage(parsed.data.key);
  if (usage) {
    return fail(res, 409, 'CONFLICT', `Upload is still used by ${usage}`);
  }

  try {
    await r2.deleteObject(parsed.data.key);
  } catch (error) {
    if (isUploadNotFound(error)) {
      return fail(res, 404, 'NOT_FOUND', 'Upload not found');
    }
    throw error;
  }

  return ok(res, null, 'Upload deleted');
});

module.exports = { presignUpload, completeUpload, deleteUpload };
