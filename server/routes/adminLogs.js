const express = require('express');
const router = express.Router();
const requireAuth = require('../middlewares/auth');
const activityLogService = require('../services/activityLogService');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { username, event, page, limit } = req.query;
    const result = await activityLogService.listLogs({ username, event, page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
