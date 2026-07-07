const fs = require('fs/promises');
const path = require('path');
const pool = require('../db/pool');
const { assertValidSlug, safeResolve } = require('../utils/sanitizeSlug');

const POSTS_ROOT = path.resolve(__dirname, '..', '..', 'posts');

// includeEmpty가 false(기본)면 글이 하나도 없는 카테고리는 방문자에게 노출하지 않는다.
// 관리자 글쓰기 화면처럼 막 만든 빈 카테고리도 선택할 수 있어야 하는 곳에서는 true로 조회한다.
async function listCategories({ includeEmpty = false } = {}) {
  const havingClause = includeEmpty ? '' : 'HAVING post_count > 0';
  const [rows] = await pool.execute(
    `SELECT c.id, c.slug, c.name, c.sort_order,
            COUNT(p.id) AS post_count
     FROM categories c
     LEFT JOIN posts p ON p.category_id = c.id
     GROUP BY c.id, c.slug, c.name, c.sort_order
     ${havingClause}
     ORDER BY c.sort_order ASC, c.name ASC`
  );
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    postCount: row.post_count,
  }));
}

async function getCategoryBySlug(slug) {
  const [rows] = await pool.execute(
    'SELECT id, slug, name, sort_order FROM categories WHERE slug = ?',
    [slug]
  );
  return rows[0] || null;
}

async function createCategory({ slug, name }) {
  assertValidSlug(slug, 'category slug');
  if (!name || typeof name !== 'string' || !name.trim()) {
    const err = new Error('카테고리 이름이 필요합니다.');
    err.status = 400;
    throw err;
  }

  const existing = await getCategoryBySlug(slug);
  if (existing) {
    const err = new Error('이미 존재하는 카테고리 slug입니다.');
    err.status = 409;
    throw err;
  }

  const [result] = await pool.execute(
    'INSERT INTO categories (slug, name) VALUES (?, ?)',
    [slug, name.trim()]
  );

  const categoryDir = safeResolve(POSTS_ROOT, slug);
  await fs.mkdir(categoryDir, { recursive: true });

  return { id: result.insertId, slug, name: name.trim(), postCount: 0 };
}

async function deleteCategoryBySlug(slug) {
  assertValidSlug(slug, 'category slug');
  try {
    const [result] = await pool.execute('DELETE FROM categories WHERE slug = ?', [slug]);
    if (result.affectedRows === 0) {
      const err = new Error('카테고리를 찾을 수 없습니다.');
      err.status = 404;
      throw err;
    }
  } catch (e) {
    if (e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED') {
      const err = new Error('해당 카테고리에 글이 존재하여 삭제할 수 없습니다.');
      err.status = 409;
      throw err;
    }
    throw e;
  }
}

module.exports = {
  listCategories,
  getCategoryBySlug,
  createCategory,
  deleteCategoryBySlug,
};
