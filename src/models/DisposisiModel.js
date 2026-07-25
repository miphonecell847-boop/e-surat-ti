const db = require('../../config/database');

class DisposisiModel {
    static async addLog({ pengajuan_surat_id, actor_user_id, actor_role, status_sebelumnya, status_sesudahnya, catatan_revisi }) {
        const sql = `
            INSERT INTO riwayat_disposisi
            (pengajuan_surat_id, actor_user_id, actor_role, status_sebelumnya, status_sesudahnya, catatan_revisi)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        await db.run(sql, [pengajuan_surat_id, actor_user_id, actor_role, status_sebelumnya, status_sesudahnya, catatan_revisi || null]);
    }

    static async getBySuratId(pengajuan_surat_id) {
        const sql = `
            SELECT r.*, u.username, u.role
            FROM riwayat_disposisi r
            JOIN users u ON r.actor_user_id = u.id
            WHERE r.pengajuan_surat_id = ?
            ORDER BY r.created_at ASC
        `;
        return await db.query(sql, [pengajuan_surat_id]);
    }
}

module.exports = DisposisiModel;
