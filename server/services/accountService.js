const pool = require('../db/pool');

async function getByUsername(username) {
  const [rows] = await pool.execute(
    'SELECT id, username, password_hash, display_name, is_active FROM admins WHERE username = ?',
    [username]
  );
  return rows[0] || null;
}

async function getById(id) {
  const [rows] = await pool.execute(
    'SELECT id, username, password_hash, display_name, is_active FROM admins WHERE id = ?',
    [id]
  );
  return rows[0] || null;
}

async function isActive(id) {
  const admin = await getById(id);
  return !!admin && !!admin.is_active;
}

async function listAccounts() {
  const [rows] = await pool.execute(
    'SELECT id, username, display_name, is_active, created_at FROM admins ORDER BY created_at ASC'
  );
  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    isActive: !!row.is_active,
    createdAt: row.created_at,
  }));
}

// CLI(createAdmin.js) 전용 — 웹 API로는 노출하지 않는다.
async function createAccount({ username, passwordHash, displayName }) {
  const [result] = await pool.execute(
    'INSERT INTO admins (username, password_hash, display_name) VALUES (?, ?, ?)',
    [username, passwordHash, displayName || username]
  );
  return { id: result.insertId, username, displayName: displayName || username };
}

async function updateAccount(id, { isActive: nextIsActive, displayName }) {
  const admin = await getById(id);
  if (!admin) {
    const err = new Error('계정을 찾을 수 없습니다.');
    err.status = 404;
    throw err;
  }

  const fields = [];
  const params = [];
  if (nextIsActive !== undefined) {
    fields.push('is_active = ?');
    params.push(!!nextIsActive);
  }
  if (displayName !== undefined) {
    fields.push('display_name = ?');
    params.push(displayName);
  }

  if (fields.length > 0) {
    params.push(id);
    await pool.execute(`UPDATE admins SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  const updated = await getById(id);
  return {
    id: updated.id,
    username: updated.username,
    displayName: updated.display_name,
    isActive: !!updated.is_active,
  };
}

module.exports = {
  getByUsername,
  getById,
  isActive,
  listAccounts,
  createAccount,
  updateAccount,
};
