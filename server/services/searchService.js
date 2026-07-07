const pool = require('../db/pool');

function buildSnippet(text, query, radius = 60) {
  if (!text) return '';
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);

  if (idx === -1) {
    const truncated = text.slice(0, radius * 2).trim();
    return text.length > radius * 2 ? `${truncated}...` : truncated;
  }

  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + lowerQuery.length + radius);
  let snippet = text.slice(start, end).trim();
  if (start > 0) snippet = `...${snippet}`;
  if (end < text.length) snippet = `${snippet}...`;
  return snippet;
}

function escapeLikePattern(str) {
  return str.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

async function search(query) {
  const pattern = `%${escapeLikePattern(query)}%`;
  const [rows] = await pool.execute(
    `SELECT p.id, p.slug, p.title, p.search_text,
            c.slug AS category_slug, c.name AS category_name,
            (CASE WHEN p.title LIKE ? THEN 1 ELSE 0 END) AS title_match
     FROM posts p JOIN categories c ON c.id = p.category_id
     WHERE p.title LIKE ? OR p.search_text LIKE ?
     ORDER BY title_match DESC, p.published_at DESC
     LIMIT 50`,
    [pattern, pattern, pattern]
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: { slug: row.category_slug, name: row.category_name },
    snippet: buildSnippet(row.search_text, query),
  }));
}

module.exports = { search };
