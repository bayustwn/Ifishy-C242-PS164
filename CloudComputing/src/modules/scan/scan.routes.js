const express = require('express');
const upload = require('../../middleware/upload');
const { saveScanHistory, getScanHistoryById } = require('./scan.controller');

const router = express.Router();

router.post('/scan-history', upload.single('fishImage'), saveScanHistory);
router.get('/scan-history/:userId', getScanHistoryById);

module.exports = router;
