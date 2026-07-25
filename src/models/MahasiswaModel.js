const db = require('../../config/database');

class MahasiswaModel {
    static findByUserId(userId) {
        const stmt = db.prepare('SELECT * FROM mahasiswa WHERE user_id = ?');
        return stmt.get(userId);
    }

    static findById(id) {
        const stmt = db.prepare('SELECT * FROM mahasiswa WHERE id = ?');
        return stmt.get(id);
    }

    static getAll() {
        const stmt = db.prepare('SELECT * FROM mahasiswa ORDER BY nama_lengkap ASC');
        return stmt.all();
    }
}

module.exports = MahasiswaModel;
