const router = require('express').Router({ mergeParams: true });
const { get, upsert, availability } = require('../controllers/hours.controller');
const { authenticate, requireRole } = require('../middlewares/auth');

router.get('/', get);
router.put('/', authenticate, requireRole('emprendedor'), upsert);
router.get('/availability', availability);

module.exports = router;
