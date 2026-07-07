const accountService = require('../services/accountService');

async function requireAuth(req, res, next) {
  try {
    if (!req.session || !req.session.adminId) {
      return res.status(401).json({ error: true, message: '인증이 필요합니다.' });
    }

    // 계정이 비활성화되면 기존 세션도 즉시 무효화되도록 매 요청마다 DB 상태를 재확인한다.
    const active = await accountService.isActive(req.session.adminId);
    if (!active) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: true, message: '인증이 필요합니다.' });
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireAuth;
