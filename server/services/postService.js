const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const matter = require('gray-matter');
const pool = require('../db/pool');
const categoryService = require('./categoryService');
const tagService = require('./tagService');
const markdownToPlainText = require('../utils/markdownToPlainText');
const { assertValidSlug, safeResolve } = require('../utils/sanitizeSlug');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const POSTS_ROOT = path.resolve(PROJECT_ROOT, 'posts');

function buildFileContent({ title, slug, category, tags, content }) {
  return matter.stringify(content || '', {
    title,
    date: new Date().toISOString().slice(0, 10),
    slug,
    category,
    tags: tags || [],
  });
}

function toRelativePath(absPath) {
  return path.relative(PROJECT_ROOT, absPath);
}

async function getPostRow(categorySlug, postSlug) {
  const [rows] = await pool.execute(
    `SELECT p.id, p.category_id, p.slug, p.title, p.file_path, p.published_at, p.updated_at,
            c.slug AS category_slug, c.name AS category_name
     FROM posts p JOIN categories c ON c.id = p.category_id
     WHERE c.slug = ? AND p.slug = ?`,
    [categorySlug, postSlug]
  );
  return rows[0] || null;
}

async function readPostFileContent(relativeFilePath) {
  const absPath = path.resolve(PROJECT_ROOT, relativeFilePath);
  const raw = await fs.readFile(absPath, 'utf8');
  return matter(raw).content.replace(/^\n+/, '');
}

async function listPosts({ categorySlug } = {}) {
  let sql = `SELECT p.id, p.slug, p.title, p.published_at,
                    c.slug AS category_slug, c.name AS category_name
             FROM posts p JOIN categories c ON c.id = p.category_id`;
  const params = [];
  if (categorySlug) {
    assertValidSlug(categorySlug, 'category');
    sql += ' WHERE c.slug = ?';
    params.push(categorySlug);
  }
  sql += ' ORDER BY p.published_at DESC, p.id DESC';

  const [rows] = await pool.execute(sql, params);
  const tagsMap = await tagService.getTagsForPostIds(rows.map((r) => r.id));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: { slug: row.category_slug, name: row.category_name },
    tags: tagsMap.get(row.id) || [],
    publishedAt: row.published_at,
  }));
}

async function getPostDetail(categorySlug, postSlug) {
  assertValidSlug(categorySlug, 'category');
  assertValidSlug(postSlug, 'slug');

  const row = await getPostRow(categorySlug, postSlug);
  if (!row) {
    const err = new Error('글을 찾을 수 없습니다.');
    err.status = 404;
    throw err;
  }

  const tagsMap = await tagService.getTagsForPostIds([row.id]);
  const content = await readPostFileContent(row.file_path);

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: { slug: row.category_slug, name: row.category_name },
    tags: tagsMap.get(row.id) || [],
    content,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

async function createPost({ title, category, slug, tags, content, authorId }) {
  assertValidSlug(category, 'category');
  assertValidSlug(slug, 'slug');
  if (!title || !String(title).trim()) {
    const err = new Error('제목이 필요합니다.');
    err.status = 400;
    throw err;
  }
  if (typeof content !== 'string') {
    const err = new Error('본문이 필요합니다.');
    err.status = 400;
    throw err;
  }

  const categoryRow = await categoryService.getCategoryBySlug(category);
  if (!categoryRow) {
    const err = new Error('존재하지 않는 카테고리입니다.');
    err.status = 400;
    throw err;
  }

  const existing = await getPostRow(category, slug);
  if (existing) {
    const err = new Error('이미 존재하는 slug입니다.');
    err.status = 409;
    throw err;
  }

  const finalPath = safeResolve(POSTS_ROOT, category, `${slug}.md`);
  const tempPath = `${finalPath}.tmp-${crypto.randomUUID()}`;
  const fileContent = buildFileContent({ title: title.trim(), slug, category, tags, content });

  await fs.mkdir(path.dirname(finalPath), { recursive: true });
  await fs.writeFile(tempPath, fileContent, 'utf8');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const searchText = markdownToPlainText(content);
    const [result] = await conn.execute(
      `INSERT INTO posts (category_id, slug, title, file_path, search_text, author_id, published_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [categoryRow.id, slug, title.trim(), toRelativePath(finalPath), searchText, authorId]
    );
    const postId = result.insertId;

    const tagIds = await tagService.upsertTags(tags, conn);
    await tagService.setPostTags(postId, tagIds, conn);

    // 커밋 성공 시에만 임시 파일을 최종 경로로 이동한다.
    // 커밋 이후 이동이 실패하면 되돌릴 방법이 없으므로, 이동을 커밋 직전에 수행하여
    // 이동 실패 시에도 트랜잭션을 롤백할 수 있게 한다.
    await fs.rename(tempPath, finalPath);
    try {
      await conn.commit();
    } catch (commitErr) {
      await fs.unlink(finalPath).catch(() => {});
      throw commitErr;
    }

    return getPostDetail(category, slug);
  } catch (err) {
    await conn.rollback();
    await fs.unlink(tempPath).catch(() => {});
    await fs.unlink(finalPath).catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

async function updatePost(categorySlug, postSlug, updates) {
  assertValidSlug(categorySlug, 'category');
  assertValidSlug(postSlug, 'slug');

  const existing = await getPostRow(categorySlug, postSlug);
  if (!existing) {
    const err = new Error('글을 찾을 수 없습니다.');
    err.status = 404;
    throw err;
  }

  const newCategorySlug = updates.category !== undefined ? updates.category : categorySlug;
  const newSlug = updates.slug !== undefined ? updates.slug : postSlug;
  assertValidSlug(newCategorySlug, 'category');
  assertValidSlug(newSlug, 'slug');

  const newTitle = updates.title !== undefined ? String(updates.title).trim() : existing.title;

  let newContent = updates.content;
  if (newContent === undefined) {
    newContent = await readPostFileContent(existing.file_path);
  }

  let newTagNames = updates.tags;
  if (newTagNames === undefined) {
    const tagsMap = await tagService.getTagsForPostIds([existing.id]);
    newTagNames = tagsMap.get(existing.id) || [];
  }

  const categoryRow = await categoryService.getCategoryBySlug(newCategorySlug);
  if (!categoryRow) {
    const err = new Error('존재하지 않는 카테고리입니다.');
    err.status = 400;
    throw err;
  }

  if (newCategorySlug !== categorySlug || newSlug !== postSlug) {
    const conflict = await getPostRow(newCategorySlug, newSlug);
    if (conflict) {
      const err = new Error('이미 존재하는 slug입니다.');
      err.status = 409;
      throw err;
    }
  }

  const oldAbsPath = path.resolve(PROJECT_ROOT, existing.file_path);
  const finalPath = safeResolve(POSTS_ROOT, newCategorySlug, `${newSlug}.md`);
  const pathChanged = oldAbsPath !== finalPath;
  const tempPath = `${finalPath}.tmp-${crypto.randomUUID()}`;
  const fileContent = buildFileContent({
    title: newTitle,
    slug: newSlug,
    category: newCategorySlug,
    tags: newTagNames,
    content: newContent,
  });

  await fs.mkdir(path.dirname(finalPath), { recursive: true });
  await fs.writeFile(tempPath, fileContent, 'utf8');

  let backupPath = null;
  if (!pathChanged) {
    // 같은 경로를 덮어써야 하는 경우, 커밋 실패 시 복구할 수 있도록 백업해둔다.
    backupPath = `${finalPath}.bak-${crypto.randomUUID()}`;
    await fs.copyFile(oldAbsPath, backupPath);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const searchText = markdownToPlainText(newContent);
    await conn.execute(
      `UPDATE posts SET category_id = ?, slug = ?, title = ?, file_path = ?, search_text = ?
       WHERE id = ?`,
      [categoryRow.id, newSlug, newTitle, toRelativePath(finalPath), searchText, existing.id]
    );

    const tagIds = await tagService.upsertTags(newTagNames, conn);
    await tagService.setPostTags(existing.id, tagIds, conn);

    await fs.rename(tempPath, finalPath);
    try {
      await conn.commit();
    } catch (commitErr) {
      if (backupPath) {
        await fs.rename(backupPath, finalPath).catch(() => {});
      } else if (pathChanged) {
        await fs.unlink(finalPath).catch(() => {});
      }
      throw commitErr;
    }

    if (backupPath) await fs.unlink(backupPath).catch(() => {});
    if (pathChanged) await fs.unlink(oldAbsPath).catch(() => {});

    return getPostDetail(newCategorySlug, newSlug);
  } catch (err) {
    await conn.rollback();
    await fs.unlink(tempPath).catch(() => {});
    if (backupPath) await fs.unlink(backupPath).catch(() => {});
    if (pathChanged) await fs.unlink(finalPath).catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

async function deletePost(categorySlug, postSlug) {
  assertValidSlug(categorySlug, 'category');
  assertValidSlug(postSlug, 'slug');

  const existing = await getPostRow(categorySlug, postSlug);
  if (!existing) {
    const err = new Error('글을 찾을 수 없습니다.');
    err.status = 404;
    throw err;
  }

  await pool.execute('DELETE FROM posts WHERE id = ?', [existing.id]);

  const absPath = path.resolve(PROJECT_ROOT, existing.file_path);
  await fs.unlink(absPath).catch(() => {});
}

module.exports = {
  listPosts,
  getPostDetail,
  createPost,
  updatePost,
  deletePost,
};
