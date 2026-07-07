const express = require('express');
const multer = require('multer');
const router = express.Router();
const requireAuth = require('../middlewares/auth');
const uploadLimiter = require('../middlewares/uploadLimiter');
const uploadService = require('../services/uploadService');
const env = require('../config/env');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.uploadMaxSizeMb * 1024 * 1024 },
});

router.post('/', requireAuth, uploadLimiter, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: true, message: '이미지 파일이 필요합니다.' });
    }
    const result = await uploadService.processUpload({
      buffer: req.file.buffer,
      uploadedBy: req.session.adminId,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
