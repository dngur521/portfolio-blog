const express = require('express');
const router = express.Router();
const postService = require('../services/postService');
const { isValidSlug } = require('../utils/sanitizeSlug');

router.get('/', async (req, res, next) => {
  try {
    const { category } = req.query;
    if (category && !isValidSlug(category)) {
      return res.status(400).json({ error: true, message: '유효하지 않은 카테고리입니다.' });
    }
    const posts = await postService.listPosts({ categorySlug: category });
    res.json({ posts });
  } catch (err) {
    next(err);
  }
});

router.get('/:category/:slug', async (req, res, next) => {
  try {
    const { category, slug } = req.params;
    if (!isValidSlug(category) || !isValidSlug(slug)) {
      return res.status(404).json({ error: true, message: '글을 찾을 수 없습니다.' });
    }
    const post = await postService.getPostDetail(category, slug);
    res.json(post);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
