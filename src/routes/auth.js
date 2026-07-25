const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const { isAuthenticated, isGuest } = require('../middlewares/authMiddleware');

router.get('/login', isGuest, AuthController.renderLogin);
router.post('/login', isGuest, AuthController.processLogin);
router.get('/logout', AuthController.logout);
router.get('/profile', isAuthenticated, AuthController.renderProfile);

module.exports = router;
