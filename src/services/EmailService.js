const nodemailer = require('nodemailer');
const appConfig = require('../../config/app');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.ethereal.email',
            port: process.env.SMTP_PORT || 587,
            auth: {
                user: process.env.SMTP_USER || '',
                pass: process.env.SMTP_PASS || ''
            }
        });
    }

    static async sendVerificationEmail(email, token, username) {
        const verifyUrl = `${appConfig.baseUrl}/verify-email/${token}`;
        console.log(`\n=======================================================`);
        console.log(`📧 [EMAIL VERIFICATION DISPATCH]`);
        console.log(`To: ${email} (${username})`);
        console.log(`Verification URL: ${verifyUrl}`);
        console.log(`=======================================================\n`);

        try {
            if (process.env.SMTP_USER) {
                const mailOptions = {
                    from: '"E-Surat Teknik Informatika" <noreply@ti.ac.id>',
                    to: email,
                    subject: 'Verifikasi Akun E-Surat Administrasi TA',
                    html: `
                        <h3>Halo ${username},</h3>
                        <p>Terima kasih telah mendaftar di Sistem E-Surat Administrasi Tugas Akhir (Teknik Informatika).</p>
                        <p>Silakan klik tautan di bawah untuk memverifikasi alamat email Anda:</p>
                        <p><a href="${verifyUrl}" style="padding: 10px 20px; background: #6b21a8; color: white; text-decoration: none; border-radius: 8px;">Verifikasi Email Akun Saya</a></p>
                        <p>Atau buka URL berikut: <br> ${verifyUrl}</p>
                    `
                };
                const instance = new EmailService();
                await instance.transporter.sendMail(mailOptions);
            }
        } catch (err) {
            console.warn('SMTP Dispatch warning (menggunakan fallback console link):', err.message);
        }
        return verifyUrl;
    }

    static async sendPasswordResetEmail(email, token, username) {
        const resetUrl = `${appConfig.baseUrl}/reset-password/${token}`;
        console.log(`\n=======================================================`);
        console.log(`🔑 [PASSWORD RESET DISPATCH]`);
        console.log(`To: ${email} (${username})`);
        console.log(`Reset URL: ${resetUrl}`);
        console.log(`=======================================================\n`);

        try {
            if (process.env.SMTP_USER) {
                const mailOptions = {
                    from: '"E-Surat Teknik Informatika" <noreply@ti.ac.id>',
                    to: email,
                    subject: 'Permintaan Reset Password E-Surat TA',
                    html: `
                        <h3>Halo ${username},</h3>
                        <p>Kami menerima permintaan untuk mereset password akun E-Surat TA Anda.</p>
                        <p>Klik tombol di bawah untuk membuat password baru:</p>
                        <p><a href="${resetUrl}" style="padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px;">Reset Password Saya</a></p>
                        <p>URL Reset: ${resetUrl}</p>
                    `
                };
                const instance = new EmailService();
                await instance.transporter.sendMail(mailOptions);
            }
        } catch (err) {
            console.warn('SMTP Reset Dispatch warning:', err.message);
        }
        return resetUrl;
    }
}

module.exports = EmailService;
