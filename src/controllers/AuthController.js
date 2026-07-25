const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const UserModel = require('../models/UserModel');
const EmailService = require('../services/EmailService');

class AuthController {
    static renderLogin(req, res) {
        return res.render('auth/login', {
            title: 'Login - E-Surat Administrasi TA',
            error: req.query.error || null,
            success: req.query.success || null,
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
                    success: null,
                    layout: 'layouts/auth'
                });
            }

            const user = await UserModel.findByUsername(username);
            if (!user) {
                return res.render('auth/login', {
                    title: 'Login - E-Surat Administrasi TA',
                    error: 'Username atau password salah!',
                    success: null,
                    layout: 'layouts/auth'
                });
            }

            // Check if email is verified
            if (user.is_email_verified === 0) {
                return res.render('auth/login', {
                    title: 'Login - E-Surat Administrasi TA',
                    error: 'Akun Anda belum diverifikasi via Email. Silakan periksa inbox/spam email Anda.',
                    success: null,
                    layout: 'layouts/auth'
                });
            }

            const isMatch = bcrypt.compareSync(password, user.password_hash);
            if (!isMatch) {
                return res.render('auth/login', {
                    title: 'Login - E-Surat Administrasi TA',
                    error: 'Username atau password salah!',
                    success: null,
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
                success: null,
                layout: 'layouts/auth'
            });
        }
    }

    static renderRegister(req, res) {
        return res.render('auth/register', {
            title: 'Pendaftaran Akun Baru - E-Surat TA',
            error: null,
            layout: 'layouts/auth'
        });
    }

    static async processRegister(req, res) {
        try {
            const { role, username, email, password, confirm_password, nim, nama_lengkap, angkatan, no_hp, nip_nidn, nama_dosen, jabatan } = req.body;

            if (password !== confirm_password) {
                return res.render('auth/register', {
                    title: 'Pendaftaran Akun Baru',
                    error: 'Konfirmasi password tidak cocok!',
                    layout: 'layouts/auth'
                });
            }

            const existingUser = await UserModel.findByUsername(username);
            if (existingUser) {
                return res.render('auth/register', {
                    title: 'Pendaftaran Akun Baru',
                    error: `Username "${username}" sudah terdaftar. Gunakan username lain.`,
                    layout: 'layouts/auth'
                });
            }

            const existingEmail = await UserModel.findByEmail(email);
            if (existingEmail) {
                return res.render('auth/register', {
                    title: 'Pendaftaran Akun Baru',
                    error: `Email "${email}" sudah terdaftar.`,
                    layout: 'layouts/auth'
                });
            }

            const token = uuidv4();

            if (role === 'mahasiswa') {
                if (!nim || !nama_lengkap || !angkatan) {
                    return res.render('auth/register', {
                        title: 'Pendaftaran Akun Baru',
                        error: 'Data NIM, Nama Lengkap, dan Angkatan wajib diisi!',
                        layout: 'layouts/auth'
                    });
                }
                await UserModel.registerMahasiswa({ username, email, password, nim, nama_lengkap, angkatan, no_hp, token });
            } else if (role === 'dosen') {
                if (!nip_nidn || !nama_dosen) {
                    return res.render('auth/register', {
                        title: 'Pendaftaran Akun Baru',
                        error: 'Data NIP/NIDN dan Nama Dosen wajib diisi!',
                        layout: 'layouts/auth'
                    });
                }
                await UserModel.registerDosen({ username, email, password, nip_nidn, nama_dosen, jabatan, token });
            } else {
                return res.render('auth/register', {
                    title: 'Pendaftaran Akun Baru',
                    error: 'Pilihan peran tidak valid. Registrasi publik hanya untuk Mahasiswa dan Dosen.',
                    layout: 'layouts/auth'
                });
            }

            // Send Verification Email
            const verifyUrl = await EmailService.sendVerificationEmail(email, token, username);

            return res.render('auth/email_verification_notice', {
                title: 'Verifikasi Email Dikirim',
                email,
                username,
                verifyUrl,
                layout: 'layouts/auth'
            });
        } catch (err) {
            console.error('Register error:', err);
            return res.render('auth/register', {
                title: 'Pendaftaran Akun Baru',
                error: 'Gagal melakukan pendaftaran: ' + err.message,
                layout: 'layouts/auth'
            });
        }
    }

    static async verifyEmail(req, res) {
        try {
            const { token } = req.params;
            const user = await UserModel.findByVerificationToken(token);

            if (!user) {
                return res.render('auth/login', {
                    title: 'Login',
                    error: 'Token verifikasi email tidak valid atau sudah kadaluwarsa.',
                    success: null,
                    layout: 'layouts/auth'
                });
            }

            await UserModel.markEmailAsVerified(user.id);

            return res.render('auth/login', {
                title: 'Login',
                error: null,
                success: `Selamat! Email Anda (${user.email}) telah berhasil diverifikasi. Silakan login.`,
                layout: 'layouts/auth'
            });
        } catch (err) {
            console.error('Verify email error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static renderChangePassword(req, res) {
        return res.render('auth/change_password', {
            title: 'Ganti Password',
            user: req.session.user,
            error: null,
            success: null
        });
    }

    static async processChangePassword(req, res) {
        try {
            const { current_password, new_password, confirm_password } = req.body;
            const userId = req.session.user.id;

            if (new_password !== confirm_password) {
                return res.render('auth/change_password', {
                    title: 'Ganti Password',
                    user: req.session.user,
                    error: 'Konfirmasi password baru tidak cocok!',
                    success: null
                });
            }

            const user = await UserModel.findById(userId);
            const isMatch = bcrypt.compareSync(current_password, user.password_hash);

            if (!isMatch) {
                return res.render('auth/change_password', {
                    title: 'Ganti Password',
                    user: req.session.user,
                    error: 'Password saat ini (lama) tidak sesuai!',
                    success: null
                });
            }

            await UserModel.updatePassword(userId, new_password);

            return res.render('auth/change_password', {
                title: 'Ganti Password',
                user: req.session.user,
                error: null,
                success: 'Password berhasil diperbarui!'
            });
        } catch (err) {
            console.error('Change password error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static renderForgotPassword(req, res) {
        return res.render('auth/forgot_password', {
            title: 'Lupa Password',
            error: null,
            success: null,
            resetUrl: null,
            layout: 'layouts/auth'
        });
    }

    static async processForgotPassword(req, res) {
        try {
            const { email } = req.body;
            const user = await UserModel.findByEmail(email);

            if (!user) {
                return res.render('auth/forgot_password', {
                    title: 'Lupa Password',
                    error: `Alamat email "${email}" tidak terdaftar di sistem.`,
                    success: null,
                    resetUrl: null,
                    layout: 'layouts/auth'
                });
            }

            const token = uuidv4();
            const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

            await UserModel.setResetToken(user.id, token, expires);

            const resetUrl = await EmailService.sendPasswordResetEmail(email, token, user.username);

            return res.render('auth/forgot_password', {
                title: 'Tautan Reset Terkirim',
                error: null,
                success: `Tautan reset password telah dikirimkan ke email ${email}.`,
                resetUrl,
                layout: 'layouts/auth'
            });
        } catch (err) {
            console.error('Forgot password error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async renderResetPassword(req, res) {
        try {
            const { token } = req.params;
            const user = await UserModel.findByResetToken(token);

            if (!user) {
                return res.render('auth/forgot_password', {
                    title: 'Lupa Password',
                    error: 'Token reset password tidak valid atau sudah kadaluwarsa (lebih dari 1 jam).',
                    success: null,
                    resetUrl: null,
                    layout: 'layouts/auth'
                });
            }

            return res.render('auth/reset_password', {
                title: 'Reset Password Baru',
                token,
                error: null,
                layout: 'layouts/auth'
            });
        } catch (err) {
            console.error('Render reset password error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async processResetPassword(req, res) {
        try {
            const { token } = req.params;
            const { new_password, confirm_password } = req.body;

            if (new_password !== confirm_password) {
                return res.render('auth/reset_password', {
                    title: 'Reset Password Baru',
                    token,
                    error: 'Konfirmasi password tidak cocok!',
                    layout: 'layouts/auth'
                });
            }

            const user = await UserModel.findByResetToken(token);
            if (!user) {
                return res.render('auth/forgot_password', {
                    title: 'Lupa Password',
                    error: 'Token reset password tidak valid.',
                    success: null,
                    resetUrl: null,
                    layout: 'layouts/auth'
                });
            }

            await UserModel.updatePassword(user.id, new_password);

            return res.render('auth/login', {
                title: 'Login',
                error: null,
                success: 'Password berhasil di-reset! Silakan login dengan password baru Anda.',
                layout: 'layouts/auth'
            });
        } catch (err) {
            console.error('Process reset password error:', err);
            return res.status(500).send('Internal Server Error');
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
