const router = require('express').Router();
const { authenticate } = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const { uploadImage } = require('../controllers/upload.controller');

router.post('/image', authenticate, upload.single('image'), uploadImage);

module.exports = router;
