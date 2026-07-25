const db = require('../../config/database');

class UserModel {
    static async findByUsername(username) {
        return await db.get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username]);
    }

    static async findById(id) {
        return await db.get('SELECT * FROM users WHERE id = ?', [id]);
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
}

module.exports = UserModel;
