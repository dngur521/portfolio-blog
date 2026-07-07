const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const loginRateLimiter = require('../middlewares/rateLimiter');

router.post('/login', loginRateLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(401).json({ error: true, message: authService.GENERIC_FAIL_MESSAGE });
    }

    const admin = await authService.attemptLogin({
      username: String(username),
      password: String(password),
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    req.session.adminId = admin.id;
    req.session.username = admin.username;
    req.session.displayName = admin.displayName;

    res.status(200).json({ authenticated: true, username: admin.username, displayName: admin.displayName });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    if (req.session && req.session.adminId) {
      await authService.logLogout({
        adminId: req.session.adminId,
        username: req.session.username,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    }
    req.session.destroy(() => {
      res.status(200).json({ ok: true });
    });
  } catch (err) {
    next(err);
  }
});

router.get('/status', (req, res) => {
  if (req.session && req.session.adminId) {
    return res.json({
      authenticated: true,
      username: req.session.username,
      displayName: req.session.displayName,
    });
  }
  res.json({ authenticated: false });
});

module.exports = router;
