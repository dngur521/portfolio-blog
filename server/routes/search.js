const express = require('express');
const router = express.Router();
const searchService = require('../services/searchService');

router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (q.length < 1) {
      return res.status(400).json({ error: true, message: '검색어를 입력해주세요.' });
    }
    if (q.length > 100) {
      return res.status(400).json({ error: true, message: '검색어는 100자를 초과할 수 없습니다.' });
    }
    const results = await searchService.search(q);
    res.json({ query: q, results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
