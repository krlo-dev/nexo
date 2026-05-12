const router = require('express').Router();
const { get } = require('../controllers/recommendations.controller');
const { authenticate } = require('../middlewares/auth');

router.get('/', authenticate, get);

module.exports = router;
