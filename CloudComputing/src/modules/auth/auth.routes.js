const express = require('express');
const { authenticateToken } = require('../../middleware/auth');
const upload = require('../../middleware/upload');
const { body } = require('express-validator');
const { registerUser, loginUser, logoutUser } = require('./auth.controller');

const router = express.Router();

router.post('/register', [
  body('username').notEmpty().withMessage('Username is required'),
  body('email').isEmail().withMessage('Email is invalid'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
], registerUser);

router.post('/login', [
  body('email').isEmail().withMessage('Email is invalid'),
  body('password').notEmpty().withMessage('Password is required'),
], loginUser);

router.post('/logout', logoutUser);

module.exports = router;
