const express = require('express');
const router = express.Router();
const fs = require('fs/promises');
const path = require('path');
const requireAuth = require('../middlewares/auth');
const { assertValidSlug, safeResolve } = require('../utils/sanitizeSlug');
const geminiService = require('../services/geminiService');
const gitService = require('../services/gitService');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const POSTS_ROOT = path.resolve(PROJECT_ROOT, 'posts');
const ABOUT_RELATIVE_PATH = 'content/about.md';

router.use(requireAuth);

// git status/commit 대상으로 넘어온 경로가 posts/{category}/{slug}.md 또는 content/about.md인지
// 검증하고, 검증된 절대경로를 돌려준다. 그 외 경로는 전부 거부한다 - 클라이언트가 보낸 경로를
// 그대로 git 명령에 흘려보내지 않기 위한 이 기능의 유일한 방어선이다.
function validateRelativePath(relPath) {
  if (typeof relPath !== 'string') {
    const err = new Error('잘못된 경로입니다.');
    err.status = 400;
    throw err;
  }
  if (relPath === ABOUT_RELATIVE_PATH) {
    return path.resolve(PROJECT_ROOT, ABOUT_RELATIVE_PATH);
  }
  const match = /^posts\/([^/]+)\/([^/]+)\.md$/.exec(relPath);
  if (!match) {
    const err = new Error(`허용되지 않은 경로입니다: ${relPath}`);
    err.status = 400;
    throw err;
  }
  const [, category, slug] = match;
  assertValidSlug(category, 'category');
  assertValidSlug(slug, 'slug');
  return safeResolve(POSTS_ROOT, category, `${slug}.md`);
}

router.get('/status', async (req, res, next) => {
  try {
    const changes = await gitService.getStatus(['posts', ABOUT_RELATIVE_PATH]);
    res.json({ changes });
  } catch (err) {
    next(err);
  }
});

router.post('/suggest-message', async (req, res, next) => {
  try {
    const { paths } = req.body || {};
    if (!Array.isArray(paths) || paths.length === 0) {
      const err = new Error('커밋할 파일을 선택해주세요.');
      err.status = 400;
      throw err;
    }

    const items = await Promise.all(
      paths.map(async (relPath) => {
        const absPath = validateRelativePath(relPath);
        try {
          const content = await fs.readFile(absPath, 'utf8');
          return { path: relPath, content };
        } catch (err) {
          return { path: relPath, content: null };
        }
      })
    );

    const message = await geminiService.suggestCommitMessage(items);
    res.json({ message });
  } catch (err) {
    next(err);
  }
});

router.post('/commit-push', async (req, res, next) => {
  try {
    const { paths, message } = req.body || {};
    if (!Array.isArray(paths) || paths.length === 0) {
      const err = new Error('커밋할 파일을 선택해주세요.');
      err.status = 400;
      throw err;
    }
    if (!message || !String(message).trim()) {
      const err = new Error('커밋 메시지를 입력해주세요.');
      err.status = 400;
      throw err;
    }
    paths.forEach(validateRelativePath);

    const result = await gitService.commitAndPush({ filePaths: paths, message: String(message).trim() });
    res.json({ ok: true, commitHash: result.commitHash });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
