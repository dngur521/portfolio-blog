const express = require('express');
const router = express.Router();
const requireAuth = require('../middlewares/auth');
const accountService = require('../services/accountService');

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const accounts = await accountService.listAccounts();
    res.json({ accounts });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: true, message: '유효하지 않은 계정 id입니다.' });
    }
    const { isActive, displayName } = req.body || {};
    const account = await accountService.updateAccount(id, { isActive, displayName });
    res.json(account);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
