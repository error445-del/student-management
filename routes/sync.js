const express = require('express');
const { isConfigured, syncNow } = require('../services/googleSheets');

const router = express.Router();

router.get('/sync/google-sheets/status', (req, res) => {
  res.json({ success: true, configured: isConfigured() });
});

router.post('/sync/google-sheets', async (req, res) => {
  try {
    const result = await syncNow();
    res.json({ success: true, message: 'Google Sheets export completed.', ...result });
  } catch (error) {
    res.status(isConfigured() ? 502 : 503).json({ success: false, error: error.message });
  }
});

module.exports = router;
