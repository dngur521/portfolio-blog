const bcrypt = require('bcrypt');
const accountService = require('./accountService');
const authLogService = require('./authLogService');

const GENERIC_FAIL_MESSAGE = '아이디 또는 비밀번호가 올바르지 않습니다.';

function genericFailError() {
  const err = new Error(GENERIC_FAIL_MESSAGE);
  err.status = 401;
  return err;
}

async function attemptLogin({ username, password, ip, userAgent }) {
  const admin = await accountService.getByUsername(username);

  if (!admin) {
    await authLogService.logEvent({
      usernameAttempted: username,
      eventType: 'LOGIN_FAIL',
      ip,
      userAgent,
      failReason: 'no_such_user',
    });
    throw genericFailError();
  }

  if (!admin.is_active) {
    await authLogService.logEvent({
      adminId: admin.id,
      usernameAttempted: username,
      eventType: 'LOGIN_FAIL',
      ip,
      userAgent,
      failReason: 'inactive',
    });
    throw genericFailError();
  }

  const passwordMatches = await bcrypt.compare(password, admin.password_hash);
  if (!passwordMatches) {
    await authLogService.logEvent({
      adminId: admin.id,
      usernameAttempted: username,
      eventType: 'LOGIN_FAIL',
      ip,
      userAgent,
      failReason: 'invalid_password',
    });
    throw genericFailError();
  }

  await authLogService.logEvent({
    adminId: admin.id,
    usernameAttempted: username,
    eventType: 'LOGIN_SUCCESS',
    ip,
    userAgent,
  });

  return {
    id: admin.id,
    username: admin.username,
    displayName: admin.display_name,
  };
}

async function logLogout({ adminId, username, ip, userAgent }) {
  await authLogService.logEvent({
    adminId,
    usernameAttempted: username,
    eventType: 'LOGOUT',
    ip,
    userAgent,
  });
}

module.exports = { attemptLogin, logLogout, GENERIC_FAIL_MESSAGE };
