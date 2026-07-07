const rateLimit = require('express-rate-limit');
const authLogService = require('../services/authLogService');

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: async (req, res) => {
    await authLogService.logEvent({
      usernameAttempted: (req.body && req.body.username) || '',
      eventType: 'LOGIN_FAIL',
      ip: req.ip,
      userAgent: req.get('user-agent'),
      failReason: 'rate_limited',
    });
    res.status(429).json({
      error: true,
      message: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
    });
  },
});

module.exports = loginRateLimiter;
