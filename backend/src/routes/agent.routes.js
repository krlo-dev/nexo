const router = require('express').Router();
const { agentChat } = require('../controllers/agent.controller');
const { authenticate } = require('../middlewares/auth');

router.post('/chat', authenticate, agentChat);

module.exports = router;
