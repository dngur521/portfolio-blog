const env = require('../config/env');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: true, message: '업로드 파일 크기가 제한을 초과했습니다.' });
  }
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: true, message: '유효하지 않은 요청입니다.' });
  }

  const status = err.status || 500;

  if (status >= 500) {
    console.error(err);
  } else if (!env.isProduction) {
    console.error(err);
  }

  const message = status >= 500 ? '서버 오류가 발생했습니다.' : err.message || '요청을 처리할 수 없습니다.';
  res.status(status).json({ error: true, message });
}

module.exports = errorHandler;
