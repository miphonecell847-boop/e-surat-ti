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
        // Self-registered Mahasiswa requires Staff TU approval (status = 'pending_approval', is_active = 0)
        const userSql = `
            INSERT INTO users (username, email, password_hash, role, is_active, is_email_verified, status)
            VALUES (?, ?, ?, 'mahasiswa', 0, 1, 'pending_approval')
        `;
        await db.run(userSql, [username, email, passHash]);
        const user = await this.findByUsername(username);

        const mhsSql = `
            INSERT INTO mahasiswa (user_id, nim, nama_lengkap, angkatan, no_hp)
            VALUES (?, ?, ?, ?, ?)
        `;
        await db.run(mhsSql, [user.id, nim, nama_lengkap, parseInt(angkatan, 10), no_hp || null]);
        return user;
    }

    static async createDosenByTu({ username, email, password, nip_nidn, nama_dosen, jabatan, no_hp }) {
        const passHash = bcrypt.hashSync(password, 10);
        const userSql = `
            INSERT INTO users (username, email, password_hash, role, is_active, is_email_verified, status)
            VALUES (?, ?, ?, 'dosen', 1, 1, 'active')
        `;
        await db.run(userSql, [username, email, passHash]);
        const user = await this.findByUsername(username);

        const dosenSql = `
            INSERT INTO dosen (user_id, nip_nidn, nama_dosen, jabatan, no_hp)
            VALUES (?, ?, ?, ?, ?)
        `;
        await db.run(dosenSql, [user.id, nip_nidn, nama_dosen, jabatan || 'Dosen Pengajar', no_hp || null]);
        return user;
    }

    static async createMahasiswaByTu({ username, email, password, nim, nama_lengkap, angkatan, no_hp }) {
        const passHash = bcrypt.hashSync(password, 10);
        const userSql = `
            INSERT INTO users (username, email, password_hash, role, is_active, is_email_verified, status)
            VALUES (?, ?, ?, 'mahasiswa', 1, 1, 'active')
        `;
        await db.run(userSql, [username, email, passHash]);
        const user = await this.findByUsername(username);

        const mhsSql = `
            INSERT INTO mahasiswa (user_id, nim, nama_lengkap, angkatan, no_hp)
            VALUES (?, ?, ?, ?, ?)
        `;
        await db.run(mhsSql, [user.id, nim, nama_lengkap, parseInt(angkatan, 10), no_hp || null]);
        return user;
    }

    static async getPendingMahasiswa() {
        const sql = `
            SELECT u.id AS user_id, u.username, u.email, u.created_at, u.status, u.is_active,
                   m.id AS mahasiswa_id, m.nim, m.nama_lengkap, m.angkatan, m.no_hp
            FROM users u
            JOIN mahasiswa m ON u.id = m.user_id
            WHERE u.role = 'mahasiswa' AND (u.status = 'pending_approval' OR u.is_active = 0)
            ORDER BY u.created_at DESC
        `;
        return await db.query(sql);
    }

    static async approveUser(userId) {
        const sql = `
            UPDATE users
            SET status = 'active', is_active = 1, is_email_verified = 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        await db.run(sql, [userId]);
    }

    static async deleteUser(userId) {
        // SQLite foreign key cascade will delete corresponding mahasiswa/dosen row
        await db.run('DELETE FROM mahasiswa WHERE user_id = ?', [userId]);
        await db.run('DELETE FROM dosen WHERE user_id = ?', [userId]);
        await db.run('DELETE FROM users WHERE id = ?', [userId]);
    }

    static async getAllUsersWithProfile() {
        const users = await db.query('SELECT id, username, email, role, is_active, status, created_at FROM users ORDER BY id DESC');
        for (const u of users) {
            if (u.role === 'mahasiswa') {
                u.profile = await db.get('SELECT nim, nama_lengkap, angkatan, no_hp FROM mahasiswa WHERE user_id = ?', [u.id]);
            } else if (u.role === 'dosen' || u.role === 'kaprodi' || u.role === 'sekretaris_prodi') {
                u.profile = await db.get('SELECT nip_nidn, nama_dosen, jabatan, no_hp FROM dosen WHERE user_id = ?', [u.id]);
            }
        }
        return users;
    }

    static async markEmailAsVerified(userId) {
        const sql = `
            UPDATE users
            SET is_email_verified = 1, is_active = 1, status = 'active', email_verification_token = NULL, updated_at = CURRENT_TIMESTAMP
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

    static async updateMahasiswaProfile({ userId, email, nama_lengkap, angkatan, no_hp, newPassword }) {
        if (email) {
            await db.run('UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [email, userId]);
        }
        if (newPassword && newPassword.trim() !== '') {
            const passHash = bcrypt.hashSync(newPassword, 10);
            await db.run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [passHash, userId]);
        }

        const existingMhs = await db.get('SELECT id, nim FROM mahasiswa WHERE user_id = ?', [userId]);
        if (existingMhs) {
            const mhsSql = `
                UPDATE mahasiswa
                SET nama_lengkap = ?, angkatan = ?, no_hp = ?
                WHERE user_id = ?
            `;
            await db.run(mhsSql, [nama_lengkap, parseInt(angkatan || 2022, 10), no_hp || null, userId]);
        } else {
            const defaultNim = '22650025';
            const mhsSql = `
                INSERT INTO mahasiswa (user_id, nim, nama_lengkap, angkatan, no_hp)
                VALUES (?, ?, ?, ?, ?)
            `;
            await db.run(mhsSql, [userId, defaultNim, nama_lengkap, parseInt(angkatan || 2022, 10), no_hp || null]);
        }
        return await this.getUserProfile(userId, 'mahasiswa');
    }

    static async updateUserByAdmin({ userId, username, email, role, status, nama, nomorIdentitas, no_hp, password }) {
        const isActive = status === 'active' ? 1 : 0;
        
        if (password && password.trim() !== '') {
            const passHash = bcrypt.hashSync(password, 10);
            await db.run('UPDATE users SET username = ?, email = ?, role = ?, status = ?, is_active = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [username, email, role, status, isActive, passHash, userId]);
        } else {
            await db.run('UPDATE users SET username = ?, email = ?, role = ?, status = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [username, email, role, status, isActive, userId]);
        }

        if (role === 'mahasiswa') {
            const targetNim = nomorIdentitas && nomorIdentitas.trim() !== '' ? nomorIdentitas.trim() : '22650000';
            const existingNim = await db.get('SELECT id FROM mahasiswa WHERE nim = ? AND user_id != ?', [targetNim, userId]);
            if (existingNim) {
                await db.run('UPDATE mahasiswa SET user_id = ?, nama_lengkap = ?, no_hp = ? WHERE id = ?', [userId, nama, no_hp || null, existingNim.id]);
            } else {
                const mhs = await db.get('SELECT id FROM mahasiswa WHERE user_id = ?', [userId]);
                if (mhs) {
                    await db.run('UPDATE mahasiswa SET nama_lengkap = ?, nim = ?, no_hp = ? WHERE user_id = ?', [nama, targetNim, no_hp || null, userId]);
                } else {
                    await db.run('INSERT INTO mahasiswa (user_id, nim, nama_lengkap, angkatan, no_hp) VALUES (?, ?, ?, 2022, ?)', [userId, targetNim, nama, no_hp || null]);
                }
            }
        } else if (role === 'dosen' || role === 'kaprodi' || role === 'sekretaris_prodi' || role === 'sekprodi') {
            const targetNip = nomorIdentitas && nomorIdentitas.trim() !== '' ? nomorIdentitas.trim() : '0900000000';
            const existingNip = await db.get('SELECT id FROM dosen WHERE nip_nidn = ? AND user_id != ?', [targetNip, userId]);
            if (existingNip) {
                await db.run('UPDATE dosen SET user_id = ?, nama_dosen = ?, no_hp = ? WHERE id = ?', [userId, nama, no_hp || null, existingNip.id]);
            } else {
                const dsn = await db.get('SELECT id FROM dosen WHERE user_id = ?', [userId]);
                if (dsn) {
                    await db.run('UPDATE dosen SET nama_dosen = ?, nip_nidn = ?, no_hp = ? WHERE user_id = ?', [nama, targetNip, no_hp || null, userId]);
                } else {
                    await db.run('INSERT INTO dosen (user_id, nip_nidn, nama_dosen, jabatan, no_hp) VALUES (?, ?, ?, "LEKTOR", ?)', [userId, targetNip, nama, no_hp || null]);
                }
            }
        }
    }
}

module.exports = UserModel;
