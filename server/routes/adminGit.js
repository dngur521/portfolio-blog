const express = require('express');
const router = express.Router();
const path = require('path');
const requireAuth = require('../middlewares/auth');
const { assertValidSlug, safeResolve } = require('../utils/sanitizeSlug');
const postService = require('../services/postService');
const geminiService = require('../services/geminiService');
const gitService = require('../services/gitService');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const POSTS_ROOT = path.resolve(PROJECT_ROOT, 'posts');

router.use(requireAuth);

function postRelativePath(category, slug) {
  assertValidSlug(category, 'category');
  assertValidSlug(slug, 'slug');
  const absPath = safeResolve(POSTS_ROOT, category, `${slug}.md`);
  return path.relative(PROJECT_ROOT, absPath);
}

router.post('/suggest-message', async (req, res, next) => {
  try {
    const { category, slug, changeType } = req.body || {};
    const post = await postService.getPostDetail(category, slug);
    const message = await geminiService.suggestCommitMessage({
      title: post.title,
      content: post.content,
      changeType,
    });
    res.json({ message });
  } catch (err) {
    next(err);
  }
});

router.post('/commit-push', async (req, res, next) => {
  try {
    const { category, slug, message } = req.body || {};
    if (!message || !String(message).trim()) {
      const err = new Error('커밋 메시지를 입력해주세요.');
      err.status = 400;
      throw err;
    }
    const relPath = postRelativePath(category, slug);
    const result = await gitService.commitAndPush({ filePaths: [relPath], message: String(message).trim() });
    res.json({ ok: true, commitHash: result.commitHash });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
