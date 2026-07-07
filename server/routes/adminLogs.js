const express = require('express');
const router = express.Router();
const requireAuth = require('../middlewares/auth');
const authLogService = require('../services/authLogService');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { username, event, page, limit } = req.query;
    const result = await authLogService.listLogs({ username, event, page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
