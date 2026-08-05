const db = require('../../config/database');

class DosenModel {
    static async findByUserId(userId) {
        return await db.get('SELECT * FROM dosen WHERE user_id = ?', [userId]);
    }

    static async findById(id) {
        return await db.get('SELECT * FROM dosen WHERE id = ?', [id]);
    }

    static async getAll() {
        return await db.query(`
            SELECT d.id, d.user_id, d.nip_nidn, 
                   COALESCE(NULLIF(d.nama_dosen, ''), u.username) AS nama_dosen, 
                   COALESCE(NULLIF(d.jabatan, ''), 'Dosen Pengajar') AS jabatan
            FROM users u
            JOIN dosen d ON d.user_id = u.id
            WHERE u.role = 'dosen'
            ORDER BY nama_dosen ASC
        `);
    }
}

module.exports = DosenModel;
