const db = require('../../config/database');
const bcrypt = require('bcryptjs');

class UserModel {
    static async findByUsername(username) {
        return await db.get('SELECT * FROM users WHERE username = ?', [username]);
    }

    static async findByEmail(email) {
        return await db.get('SELECT * FROM users WHERE email = ?', [email]);
    }

    static async findById(id) {
        return await db.get('SELECT * FROM users WHERE id = ?', [id]);
    }

    static async findByVerificationToken(token) {
        return await db.get('SELECT * FROM users WHERE email_verification_token = ?', [token]);
    }

    static async findByResetToken(token) {
        return await db.get('SELECT * FROM users WHERE password_reset_token = ? AND password_reset_expires > CURRENT_TIMESTAMP', [token]);
    }

    static async getUserProfile(userId, role) {
        const user = await this.findById(userId);
        if (!user) return null;

        if (role === 'mahasiswa') {
            user.profile = await db.get('SELECT * FROM mahasiswa WHERE user_id = ?', [userId]);
        } else if (role === 'dosen' || role === 'kaprodi') {
            user.profile = await db.get('SELECT * FROM dosen WHERE user_id = ?', [userId]);
        }
        return user;
    }

    static async registerMahasiswa({ username, email, password, nim, nama_lengkap, angkatan, no_hp, token }) {
        const passHash = bcrypt.hashSync(password, 10);
        // Create user with is_email_verified = 0, is_active = 0
        const userSql = `
            INSERT INTO users (username, email, password_hash, role, is_active, is_email_verified, email_verification_token)
            VALUES (?, ?, ?, 'mahasiswa', 0, 0, ?)
        `;
        await db.run(userSql, [username, email, passHash, token]);
        const user = await this.findByUsername(username);

        const mhsSql = `
            INSERT INTO mahasiswa (user_id, nim, nama_lengkap, angkatan, no_hp)
            VALUES (?, ?, ?, ?, ?)
        `;
        await db.run(mhsSql, [user.id, nim, nama_lengkap, parseInt(angkatan, 10), no_hp || null]);
        return user;
    }

    static async registerDosen({ username, email, password, nip_nidn, nama_dosen, jabatan, token }) {
        const passHash = bcrypt.hashSync(password, 10);
        const userSql = `
            INSERT INTO users (username, email, password_hash, role, is_active, is_email_verified, email_verification_token)
            VALUES (?, ?, ?, 'dosen', 0, 0, ?)
        `;
        await db.run(userSql, [username, email, passHash, token]);
        const user = await this.findByUsername(username);

        const dosenSql = `
            INSERT INTO dosen (user_id, nip_nidn, nama_dosen, jabatan)
            VALUES (?, ?, ?, ?)
        `;
        await db.run(dosenSql, [user.id, nip_nidn, nama_dosen, jabatan || 'Dosen Pengajar']);
        return user;
    }

    static async markEmailAsVerified(userId) {
        const sql = `
            UPDATE users
            SET is_email_verified = 1, is_active = 1, email_verification_token = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        await db.run(sql, [userId]);
    }

    static async updatePassword(userId, newPassword) {
        const passHash = bcrypt.hashSync(newPassword, 10);
        const sql = `
            UPDATE users
            SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        await db.run(sql, [passHash, userId]);
    }

    static async setResetToken(userId, token, expires) {
        const sql = `
            UPDATE users
            SET password_reset_token = ?, password_reset_expires = ?
            WHERE id = ?
        `;
        await db.run(sql, [token, expires, userId]);
    }
}

module.exports = UserModel;
