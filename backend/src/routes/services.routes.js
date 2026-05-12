const router = require('express').Router({ mergeParams: true });
const { body } = require('express-validator');
const { list, create, update, remove } = require('../controllers/services.controller');
const { authenticate, requireRole } = require('../middlewares/auth');

router.get('/', list);

router.post('/',
  authenticate,
  requireRole('emprendedor'),
  [
    body('name').notEmpty(),
    body('duration_minutes').isInt({ min: 1 }),
  ],
  create
);

router.put('/:id', authenticate, requireRole('emprendedor'), update);
router.delete('/:id', authenticate, requireRole('emprendedor'), remove);

module.exports = router;
