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
            SELECT d.id, d.user_id, d.nip_nidn, d.no_hp,
                   COALESCE(NULLIF(d.nama_dosen, ''), u.username) AS nama_dosen, 
                   COALESCE(NULLIF(d.jabatan, ''), 'Dosen Pengajar') AS jabatan
            FROM users u
            JOIN dosen d ON d.user_id = u.id
            WHERE u.role IN ('dosen', 'kaprodi', 'sekretaris_prodi')
            ORDER BY nama_dosen ASC
        `);
    }

    static async updateProfile(userId, { nama_dosen, nip_nidn, no_hp, jabatan }) {
        const existing = await this.findByUserId(userId);
        if (existing) {
            await db.run(
                'UPDATE dosen SET nama_dosen = COALESCE(?, nama_dosen), nip_nidn = COALESCE(?, nip_nidn), no_hp = ?, jabatan = COALESCE(?, jabatan) WHERE user_id = ?',
                [nama_dosen || null, nip_nidn || null, no_hp || null, jabatan || null, userId]
            );
        }
        return await this.findByUserId(userId);
    }
}

module.exports = DosenModel;
