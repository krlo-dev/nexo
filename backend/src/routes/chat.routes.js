const router = require('express').Router();
const { chat } = require('../controllers/chat.controller');
const { authenticate } = require('../middlewares/auth');

router.post('/', authenticate, chat);

module.exports = router;
