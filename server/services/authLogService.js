const pool = require('../db/pool');

const ALLOWED_EVENTS = ['LOGIN_SUCCESS', 'LOGIN_FAIL', 'LOGOUT'];

async function logEvent({ adminId = null, usernameAttempted, eventType, ip, userAgent, failReason = null }) {
  await pool.execute(
    `INSERT INTO auth_logs (admin_id, username_attempted, event_type, ip_address, user_agent, fail_reason)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [adminId, usernameAttempted, eventType, ip, userAgent ? String(userAgent).slice(0, 500) : null, failReason]
  );
}

async function listLogs({ username, event, page = 1, limit = 50 } = {}) {
  const conditions = [];
  const params = [];

  if (username) {
    conditions.push('username_attempted = ?');
    params.push(username);
  }
  if (event && ALLOWED_EVENTS.includes(event)) {
    conditions.push('event_type = ?');
    params.push(event);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const offset = (safePage - 1) * safeLimit;

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM auth_logs ${whereClause}`,
    params
  );
  const total = countRows[0].total;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));

  const [rows] = await pool.execute(
    `SELECT id, username_attempted, event_type, ip_address, user_agent, fail_reason, created_at
     FROM auth_logs ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );

  return {
    logs: rows.map((row) => ({
      id: row.id,
      username: row.username_attempted,
      event: row.event_type,
      ip: row.ip_address,
      userAgent: row.user_agent,
      reason: row.fail_reason,
      createdAt: row.created_at,
    })),
    page: safePage,
    totalPages,
  };
}

module.exports = { logEvent, listLogs, ALLOWED_EVENTS };
