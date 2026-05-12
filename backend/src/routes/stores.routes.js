const router = require('express').Router();
const { body } = require('express-validator');
const { list, getBySlug, create, update, remove } = require('../controllers/stores.controller');
const { authenticate, requireRole } = require('../middlewares/auth');

router.get('/', list);
router.get('/:slug', getBySlug);

router.post('/',
  authenticate,
  requireRole('emprendedor'),
  [
    body('name').notEmpty().withMessage('Nombre requerido'),
    body('category').notEmpty().withMessage('Categoría requerida'),
  ],
  create
);

router.put('/:id', authenticate, requireRole('emprendedor'), update);
router.delete('/:id', authenticate, requireRole('emprendedor'), remove);

module.exports = router;
