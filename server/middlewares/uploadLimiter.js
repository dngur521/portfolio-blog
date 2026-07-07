const rateLimit = require('express-rate-limit');

const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, message: '이미지 업로드 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});

module.exports = uploadLimiter;
