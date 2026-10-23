const express = require('express');
const { authenticateToken } = require('../../middleware/auth');
const { getAllUsers, updateUser, deleteUserAccount, uploadProfilePhoto, updatePhotoProfile, getDashboardData, getUserProfile } = require('./users.controller');

const router = express.Router();

router.get('/users', getAllUsers);
router.put('/update', authenticateToken, updateUser);
router.delete('/delete', authenticateToken, deleteUserAccount);
router.post('/upload-photo', authenticateToken, uploadProfilePhoto);
router.put('/update-photo-profile', authenticateToken, updatePhotoProfile);
router.get('/dashboard/:email', authenticateToken, getDashboardData);
router.get('/profile/:email', authenticateToken, getUserProfile);

module.exports = router;
