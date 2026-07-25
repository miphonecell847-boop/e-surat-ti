const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const { isAuthenticated, isGuest } = require('../middlewares/authMiddleware');

// Auth & Login
router.get('/login', isGuest, AuthController.renderLogin);
router.post('/login', isGuest, AuthController.processLogin);
router.get('/logout', AuthController.logout);
router.get('/profile', isAuthenticated, AuthController.renderProfile);

// Registration & Email Verification
router.get('/register', isGuest, AuthController.renderRegister);
router.post('/register', isGuest, AuthController.processRegister);
router.get('/verify-email/:token', AuthController.verifyEmail);

// Change Password (In App)
router.get('/change-password', isAuthenticated, AuthController.renderChangePassword);
router.post('/change-password', isAuthenticated, AuthController.processChangePassword);

// Forgot & Reset Password
router.get('/forgot-password', isGuest, AuthController.renderForgotPassword);
router.post('/forgot-password', isGuest, AuthController.processForgotPassword);
router.get('/reset-password/:token', isGuest, AuthController.renderResetPassword);
router.post('/reset-password/:token', isGuest, AuthController.processResetPassword);

module.exports = router;
