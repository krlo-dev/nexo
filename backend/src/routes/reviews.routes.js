const router = require('express').Router();
const { body } = require('express-validator');
const { create, listByStore } = require('../controllers/reviews.controller');
const { authenticate, requireRole } = require('../middlewares/auth');

router.post('/',
  authenticate,
  requireRole('cliente'),
  [
    body('appointment_id').isUUID(),
    body('rating').isInt({ min: 1, max: 5 }),
  ],
  create
);

router.get('/store/:storeId', listByStore);

module.exports = router;
