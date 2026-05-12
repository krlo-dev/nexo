const router = require('express').Router();
const { listUsers, updateUserRole, listStores, toggleStore } = require('../controllers/admin.controller');
const { authenticate, requireRole } = require('../middlewares/auth');

router.use(authenticate, requireRole('admin'));

router.get('/users', listUsers);
router.patch('/users/:id/role', updateUserRole);
router.get('/stores', listStores);
router.patch('/stores/:id/active', toggleStore);

module.exports = router;
