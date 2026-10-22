const express = require('express');
const { limit, authLimiter } = require('../../shared/rateLimit');
const { registerUser, loginUser, logoutUser } = require('./auth.controller');

const router = express.Router();

const AUTH_LIMIT_MESSAGE = 'Too many login/register attempts, try again later';

router.post('/register', limit(authLimiter, AUTH_LIMIT_MESSAGE), registerUser);
router.post('/login', limit(authLimiter, AUTH_LIMIT_MESSAGE), loginUser);
router.post('/logout', logoutUser);

module.exports = router;
