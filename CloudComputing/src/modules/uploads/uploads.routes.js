const express = require('express');
const { authenticateToken } = require('../../middleware/auth');
const { presignUpload, completeUpload, deleteUpload } = require('./uploads.controller');
const { limit, uploadLimiter } = require('../../shared/rateLimit');

const router = express.Router();

router.post(
  '/uploads/presign',
  authenticateToken,
  limit(uploadLimiter, 'Too many upload requests, try again later'),
  presignUpload,
);
router.post('/uploads/complete', authenticateToken, completeUpload);
router.delete('/uploads', authenticateToken, deleteUpload);

module.exports = router;
