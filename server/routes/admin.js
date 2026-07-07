const express = require('express');
const router = express.Router();
const postService = require('../services/postService');
const categoryService = require('../services/categoryService');
const aboutService = require('../services/aboutService');
const activityLogService = require('../services/activityLogService');
const requireAuth = require('../middlewares/auth');

router.use(requireAuth);

function postTarget(post) {
  return `${post.category.slug}/${post.slug} - ${post.title}`;
}

// 활동 이력 기록은 부가 기능이므로, 여기서 실패하더라도 실제 글 작성/수정/삭제
// 응답에는 영향을 주지 않는다.
async function logActivity(req, eventType, target) {
  try {
    await activityLogService.logEvent({
      adminId: req.session.adminId,
      usernameAttempted: req.session.username,
      eventType,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      target,
    });
  } catch (err) {
    console.error('활동 이력 기록 실패:', err);
  }
}

router.post('/posts', async (req, res, next) => {
  try {
    const { title, category, slug, tags, content } = req.body || {};
    const post = await postService.createPost({
      title,
      category,
      slug,
      tags,
      content,
      authorId: req.session.adminId,
    });
    await logActivity(req, 'POST_CREATE', postTarget(post));
    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
});

router.put('/posts/:category/:slug', async (req, res, next) => {
  try {
    const { category, slug } = req.params;
    const post = await postService.updatePost(category, slug, req.body || {});
    await logActivity(req, 'POST_UPDATE', postTarget(post));
    res.status(200).json(post);
  } catch (err) {
    next(err);
  }
});

router.delete('/posts/:category/:slug', async (req, res, next) => {
  try {
    const { category, slug } = req.params;
    const post = await postService.getPostDetail(category, slug);
    await postService.deletePost(category, slug);
    await logActivity(req, 'POST_DELETE', postTarget(post));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post('/categories', async (req, res, next) => {
  try {
    const { slug, name } = req.body || {};
    const category = await categoryService.createCategory({ slug, name });
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
});

router.delete('/categories/:slug', async (req, res, next) => {
  try {
    await categoryService.deleteCategoryBySlug(req.params.slug);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.put('/about', async (req, res, next) => {
  try {
    const { content } = req.body || {};
    const about = await aboutService.saveAbout(content);
    res.json(about);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
