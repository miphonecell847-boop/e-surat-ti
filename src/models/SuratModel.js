const db = require('../../config/database');

class SuratModel {
    static async createPengajuan({ uuid_surat, mahasiswa_id, jenis_surat_id, perihal, data_dinamis, status }) {
        const sql = `
            INSERT INTO pengajuan_surat 
            (uuid_surat, mahasiswa_id, jenis_surat_id, perihal, data_dinamis, status)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const dinamisStr = typeof data_dinamis === 'object' ? JSON.stringify(data_dinamis) : data_dinamis;
        await db.run(sql, [uuid_surat, mahasiswa_id, jenis_surat_id, perihal, dinamisStr, status || 'pending_pembimbing_1']);
        return await db.get('SELECT * FROM pengajuan_surat WHERE uuid_surat = ?', [uuid_surat]);
    }

    static async getDetailById(id) {
        const sql = `
            SELECT s.*, m.nama_lengkap AS mhs_nama, m.nim AS mhs_nim, m.angkatan AS mhs_angkatan, m.judul_ta AS mhs_judul_ta,
                   j.nama_surat, j.kode_surat, j.template_path
            FROM pengajuan_surat s
            JOIN mahasiswa m ON s.mahasiswa_id = m.id
            JOIN jenis_surat j ON s.jenis_surat_id = j.id
            WHERE s.id = ?
        `;
        return await db.get(sql, [id]);
    }

    static async getDetailByUuid(uuid_surat) {
        const sql = `
            SELECT s.*, m.nama_lengkap AS mhs_nama, m.nim AS mhs_nim, m.angkatan AS mhs_angkatan, m.judul_ta AS mhs_judul_ta,
                   j.nama_surat, j.kode_surat, j.template_path
            FROM pengajuan_surat s
            JOIN mahasiswa m ON s.mahasiswa_id = m.id
            JOIN jenis_surat j ON s.jenis_surat_id = j.id
            WHERE s.uuid_surat = ?
        `;
        return await db.get(sql, [uuid_surat]);
    }

    static async getByMahasiswaId(mahasiswa_id) {
        const sql = `
            SELECT s.*, j.nama_surat, j.kode_surat
            FROM pengajuan_surat s
            JOIN jenis_surat j ON s.jenis_surat_id = j.id
            WHERE s.mahasiswa_id = ?
            ORDER BY s.tgl_pengajuan DESC
        `;
        return await db.query(sql, [mahasiswa_id]);
    }

    static async getByStatus(statusList) {
        const placeholders = statusList.map(() => '?').join(',');
        const sql = `
            SELECT s.*, m.nama_lengkap AS mhs_nama, m.nim AS mhs_nim, j.nama_surat, j.kode_surat
            FROM pengajuan_surat s
            JOIN mahasiswa m ON s.mahasiswa_id = m.id
            JOIN jenis_surat j ON s.jenis_surat_id = j.id
            WHERE s.status IN (${placeholders})
            ORDER BY s.tgl_pengajuan DESC
        `;
        return await db.query(sql, statusList);
    }

    static async getAllSurat() {
        const sql = `
            SELECT s.*, m.nama_lengkap AS mhs_nama, m.nim AS mhs_nim, j.nama_surat, j.kode_surat
            FROM pengajuan_surat s
            JOIN mahasiswa m ON s.mahasiswa_id = m.id
            JOIN jenis_surat j ON s.jenis_surat_id = j.id
            ORDER BY s.tgl_pengajuan DESC
        `;
        return await db.query(sql);
    }

    static async updateStatus(id, newStatus, approvalP1 = null, approvalP2 = null, qrHash = null) {
        let sql = 'UPDATE pengajuan_surat SET status = ?';
        const params = [newStatus];

        if (approvalP1 !== null) {
            sql += ', approval_pembimbing_1 = ?';
            params.push(approvalP1 ? 1 : 0);
        }
        if (approvalP2 !== null) {
            sql += ', approval_pembimbing_2 = ?';
            params.push(approvalP2 ? 1 : 0);
        }
        if (qrHash !== null) {
            sql += ', qr_signature_hash = ?';
            params.push(qrHash);
        }
        if (newStatus === 'selesai') {
            sql += ', tgl_selesai = CURRENT_TIMESTAMP';
        }

        sql += ' WHERE id = ?';
        params.push(id);

        await db.run(sql, params);
    }

    static async setNomorSurat(id, nomorSurat) {
        const sql = 'UPDATE pengajuan_surat SET nomor_surat = ? WHERE id = ?';
        await db.run(sql, [nomorSurat, id]);
    }

    static async getJenisSuratList() {
        return await db.query('SELECT * FROM jenis_surat ORDER BY id ASC');
    }
}

module.exports = SuratModel;
