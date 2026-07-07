const express = require('express');
const router = express.Router();
const categoryService = require('../services/categoryService');

router.get('/', async (req, res, next) => {
  try {
    const includeEmpty = req.query.includeEmpty === '1' || req.query.includeEmpty === 'true';
    const categories = await categoryService.listCategories({ includeEmpty });
    res.json({ categories });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
