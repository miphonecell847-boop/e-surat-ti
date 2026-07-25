const db = require('../../config/database');

class DosenModel {
    static async findByUserId(userId) {
        return await db.get('SELECT * FROM dosen WHERE user_id = ?', [userId]);
    }

    static async findById(id) {
        return await db.get('SELECT * FROM dosen WHERE id = ?', [id]);
    }

    static async getAll() {
        return await db.query('SELECT * FROM dosen ORDER BY nama_dosen ASC');
    }
}

module.exports = DosenModel;
