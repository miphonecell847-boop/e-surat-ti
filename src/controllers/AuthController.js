const bcrypt = require('bcryptjs');
const UserModel = require('../models/UserModel');

class AuthController {
    static renderLogin(req, res) {
        return res.render('auth/login', {
            title: 'Login - E-Surat Administrasi TA',
            error: null,
            layout: 'layouts/auth'
        });
    }

    static async processLogin(req, res) {
        try {
            const { username, password } = req.body;
            if (!username || !password) {
                return res.render('auth/login', {
                    title: 'Login - E-Surat Administrasi TA',
                    error: 'Username dan Password wajib diisi!',
                    layout: 'layouts/auth'
                });
            }

            const user = await UserModel.findByUsername(username);
            if (!user) {
                return res.render('auth/login', {
                    title: 'Login - E-Surat Administrasi TA',
                    error: 'Username atau password salah!',
                    layout: 'layouts/auth'
                });
            }

            const isMatch = bcrypt.compareSync(password, user.password_hash);
            if (!isMatch) {
                return res.render('auth/login', {
                    title: 'Login - E-Surat Administrasi TA',
                    error: 'Username atau password salah!',
                    layout: 'layouts/auth'
                });
            }

            const fullUser = await UserModel.getUserProfile(user.id, user.role);

            req.session.user = {
                id: fullUser.id,
                username: fullUser.username,
                email: fullUser.email,
                role: fullUser.role,
                profile: fullUser.profile || null
            };

            const returnTo = req.session.returnTo || '/dashboard';
            delete req.session.returnTo;
            return res.redirect(returnTo);
        } catch (err) {
            console.error('Login error:', err);
            return res.render('auth/login', {
                title: 'Login - E-Surat Administrasi TA',
                error: 'Terjadi kesalahan sistem saat login.',
                layout: 'layouts/auth'
            });
        }
    }

    static renderProfile(req, res) {
        return res.render('auth/profile', {
            title: 'Profil Saya',
            user: req.session.user
        });
    }

    static logout(req, res) {
        req.session.destroy(() => {
            return res.redirect('/login');
        });
    }
}

module.exports = AuthController;
