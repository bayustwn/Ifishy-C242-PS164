const express = require('express');
const { authenticateToken } = require('../../middleware/auth');
const upload = require('../../middleware/upload');
const { getAllUsers, updateUser, deleteUserAccount, uploadProfilePhoto, updatePhotoProfile, getDashboardData, getUserProfile } = require('./users.controller');

const router = express.Router();

router.get('/users', getAllUsers);
router.put('/update', updateUser);
router.delete('/delete', deleteUserAccount);
router.post('/upload-photo', authenticateToken, upload.single('photo'), uploadProfilePhoto);
router.put('/update-photo-profile', authenticateToken, upload.single('image'), updatePhotoProfile);
router.get('/dashboard/:email', authenticateToken, getDashboardData);
router.get('/profile/:email', authenticateToken, getUserProfile);

module.exports = router;
