const router = require('express').Router();
const { body } = require('express-validator');
const { list, create, reschedule, cancel, updateStatus, toggleReschedule } = require('../controllers/appointments.controller');
const { authenticate } = require('../middlewares/auth');

router.use(authenticate);

router.get('/', list);

router.post('/',
  [
    body('service_id').isUUID(),
    body('store_id').isUUID(),
    body('start_time').isISO8601(),
  ],
  create
);

router.put('/:id', reschedule);
router.delete('/:id', cancel);
router.patch('/:id/status', updateStatus);
router.patch('/:id/reschedule-toggle', toggleReschedule);

module.exports = router;
