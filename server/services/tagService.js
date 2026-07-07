const pool = require('../db/pool');

function slugifyTag(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// 태그 이름 배열을 받아 존재하지 않는 태그는 생성하고, 전체 태그 id 목록을 반환한다.
// conn이 주어지면 트랜잭션 커넥션을 사용한다.
async function upsertTags(names, conn = pool) {
  const cleanNames = [...new Set((names || []).map((n) => String(n).trim()).filter(Boolean))];
  const tagIds = [];

  for (const name of cleanNames) {
    const slug = slugifyTag(name);
    if (!slug) continue;

    const [existingRows] = await conn.execute('SELECT id FROM tags WHERE slug = ?', [slug]);
    if (existingRows.length > 0) {
      tagIds.push(existingRows[0].id);
      continue;
    }

    const [result] = await conn.execute(
      'INSERT INTO tags (name, slug) VALUES (?, ?)',
      [name, slug]
    );
    tagIds.push(result.insertId);
  }

  return tagIds;
}

async function setPostTags(postId, tagIds, conn = pool) {
  await conn.execute('DELETE FROM post_tags WHERE post_id = ?', [postId]);
  for (const tagId of tagIds) {
    await conn.execute('INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)', [postId, tagId]);
  }
}

async function getTagsForPostIds(postIds, conn = pool) {
  if (postIds.length === 0) return new Map();
  const placeholders = postIds.map(() => '?').join(',');
  const [rows] = await conn.execute(
    `SELECT pt.post_id, t.name FROM post_tags pt
     JOIN tags t ON t.id = pt.tag_id
     WHERE pt.post_id IN (${placeholders})`,
    postIds
  );
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.post_id)) map.set(row.post_id, []);
    map.get(row.post_id).push(row.name);
  }
  return map;
}

module.exports = { upsertTags, setPostTags, getTagsForPostIds, slugifyTag };
