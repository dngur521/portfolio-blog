const express = require('express');
const router = express.Router();
const aboutService = require('../services/aboutService');

router.get('/', async (req, res, next) => {
  try {
    const about = await aboutService.getAbout();
    res.json(about);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
