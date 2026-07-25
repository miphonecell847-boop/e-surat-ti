const db = require('../../config/database');

class MahasiswaModel {
    static async findByUserId(userId) {
        return await db.get('SELECT * FROM mahasiswa WHERE user_id = ?', [userId]);
    }

    static async findById(id) {
        return await db.get('SELECT * FROM mahasiswa WHERE id = ?', [id]);
    }

    static async getAll() {
        return await db.query('SELECT * FROM mahasiswa ORDER BY nama_lengkap ASC');
    }
}

module.exports = MahasiswaModel;

