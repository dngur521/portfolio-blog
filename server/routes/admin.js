const express = require('express');
const router = express.Router();
const postService = require('../services/postService');
const categoryService = require('../services/categoryService');
const aboutService = require('../services/aboutService');
const requireAuth = require('../middlewares/auth');

router.use(requireAuth);

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
    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
});

router.put('/posts/:category/:slug', async (req, res, next) => {
  try {
    const { category, slug } = req.params;
    const post = await postService.updatePost(category, slug, req.body || {});
    res.status(200).json(post);
  } catch (err) {
    next(err);
  }
});

router.delete('/posts/:category/:slug', async (req, res, next) => {
  try {
    const { category, slug } = req.params;
    await postService.deletePost(category, slug);
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
