const fs = require('fs/promises');
const path = require('path');

const ABOUT_PATH = path.resolve(__dirname, '..', '..', 'content', 'about.md');
const DEFAULT_CONTENT = '아직 작성된 소개글이 없습니다.';

async function getAbout() {
  try {
    const [content, stat] = await Promise.all([fs.readFile(ABOUT_PATH, 'utf8'), fs.stat(ABOUT_PATH)]);
    return { content, updatedAt: stat.mtime };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { content: DEFAULT_CONTENT, updatedAt: null };
    }
    throw err;
  }
}

async function saveAbout(content) {
  if (typeof content !== 'string') {
    const err = new Error('본문이 필요합니다.');
    err.status = 400;
    throw err;
  }

  await fs.mkdir(path.dirname(ABOUT_PATH), { recursive: true });
  const tempPath = `${ABOUT_PATH}.tmp-${Date.now()}`;
  await fs.writeFile(tempPath, content, 'utf8');
  await fs.rename(tempPath, ABOUT_PATH);

  const stat = await fs.stat(ABOUT_PATH);
  return { content, updatedAt: stat.mtime };
}

module.exports = { getAbout, saveAbout };
