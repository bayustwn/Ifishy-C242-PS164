const express = require('express');
const { authenticateToken } = require('../../middleware/auth');
const { presignUpload, completeUpload, deleteUpload } = require('./uploads.controller');

const router = express.Router();

router.post('/uploads/presign', authenticateToken, presignUpload);
router.post('/uploads/complete', authenticateToken, completeUpload);
router.delete('/uploads', authenticateToken, deleteUpload);

module.exports = router;
