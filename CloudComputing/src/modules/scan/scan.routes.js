const express = require('express');
const { authenticateToken } = require('../../middleware/auth');
const { saveScanHistory, getScanHistoryById } = require('./scan.controller');

const router = express.Router();

router.post('/scan-history', authenticateToken, saveScanHistory);
router.get('/scan-history/:userId', getScanHistoryById);

module.exports = router;
