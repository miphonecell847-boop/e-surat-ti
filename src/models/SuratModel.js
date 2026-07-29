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
        const sql = `
            SELECT * FROM jenis_surat 
            ORDER BY CASE kode_surat
                WHEN 'SRT-IZIN-PENELITIAN' THEN 1
                WHEN 'SK-PEMBIMBING-PENGUJI' THEN 2
                WHEN 'KARTU-BIMBINGAN' THEN 4
                WHEN 'UND-SEMPRO' THEN 5
                WHEN 'UND-SEMHAS' THEN 6
                WHEN 'LMBR-PERSETUJUAN-WKT' THEN 7
                WHEN 'UND-SIDANG' THEN 8
                WHEN 'LMBR-PENGESAHAN' THEN 9
                WHEN 'BA-UJIAN' THEN 10
                ELSE id + 100
            END ASC
        `;
        return await db.query(sql);
    }

    static async getJenisSuratById(id) {
        return await db.get('SELECT * FROM jenis_surat WHERE id = ?', [id]);
    }
    static async createPengajuanByTu({ uuid_surat, mahasiswa_id, jenis_surat_id, perihal, data_dinamis, ttd_tu_path }) {
        const sql = `
            INSERT INTO pengajuan_surat 
            (uuid_surat, mahasiswa_id, jenis_surat_id, perihal, data_dinamis, status, ttd_tu_path, created_by_role)
            VALUES (?, ?, ?, ?, ?, 'pending_sekprodi', ?, 'staff_tu')
        `;
        const dinamisStr = typeof data_dinamis === 'object' ? JSON.stringify(data_dinamis) : data_dinamis;
        await db.run(sql, [uuid_surat, mahasiswa_id, jenis_surat_id, perihal, dinamisStr, ttd_tu_path || null]);
        return await db.get('SELECT * FROM pengajuan_surat WHERE uuid_surat = ?', [uuid_surat]);
    }

    static async updateTtdSekprodi(id, ttdPath) {
        const sql = 'UPDATE pengajuan_surat SET ttd_sekprodi_path = ? WHERE id = ?';
        await db.run(sql, [ttdPath, id]);
    }

    static async updateTtdKaprodi(id, ttdPath) {
        const sql = 'UPDATE pengajuan_surat SET ttd_kaprodi_path = ? WHERE id = ?';
        await db.run(sql, [ttdPath, id]);
    }

    static async getByFilter({ jenis_surat_id, statusList }) {
        let sql = `
            SELECT s.*, m.nama_lengkap AS mhs_nama, m.nim AS mhs_nim, j.nama_surat, j.kode_surat
            FROM pengajuan_surat s
            JOIN mahasiswa m ON s.mahasiswa_id = m.id
            JOIN jenis_surat j ON s.jenis_surat_id = j.id
            WHERE 1=1
        `;
        const params = [];
        if (statusList && statusList.length > 0) {
            const placeholders = statusList.map(() => '?').join(',');
            sql += ` AND s.status IN (${placeholders})`;
            params.push(...statusList);
        }
        if (jenis_surat_id) {
            sql += ` AND s.jenis_surat_id = ?`;
            params.push(jenis_surat_id);
        }
        sql += ` ORDER BY s.tgl_pengajuan DESC`;
        return await db.query(sql, params);
    }

    static async getByDosenPembimbing(dosenId) {
        const allSurat = await db.query(`
            SELECT s.*, m.nama_lengkap as mhs_nama, m.nim as mhs_nim, j.nama_surat, j.kode_surat
            FROM pengajuan_surat s
            JOIN mahasiswa m ON s.mahasiswa_id = m.id
            JOIN jenis_surat j ON s.jenis_surat_id = j.id
            WHERE s.status = 'selesai'
            ORDER BY s.tgl_pengajuan DESC
        `);
        return allSurat.filter(s => {
            let dataDinamis = {};
            try {
                dataDinamis = typeof s.data_dinamis === 'string' ? JSON.parse(s.data_dinamis) : s.data_dinamis;
            } catch(e){}
            return (dataDinamis && (dataDinamis.pembimbing_1_id == dosenId || dataDinamis.pembimbing_2_id == dosenId));
        });
    }

    static async updateSuratByTu(id, { mahasiswa_id, jenis_surat_id, perihal, data_dinamis, ttd_tu_path }) {
        const dinamisStr = typeof data_dinamis === 'object' ? JSON.stringify(data_dinamis) : data_dinamis;
        let sql = `UPDATE pengajuan_surat SET mahasiswa_id = ?, jenis_surat_id = ?, perihal = ?, data_dinamis = ?`;
        const params = [mahasiswa_id, jenis_surat_id, perihal, dinamisStr];

        if (ttd_tu_path) {
            sql += `, ttd_tu_path = ?`;
            params.push(ttd_tu_path);
        }
        sql += ` WHERE id = ?`;
        params.push(id);
        await db.run(sql, params);
        return await this.getDetailById(id);
    }

    static async forwardSuratByTu(id, { mahasiswa_id, jenis_surat_id, perihal, data_dinamis, ttd_tu_path }) {
        const dinamisStr = typeof data_dinamis === 'object' ? JSON.stringify(data_dinamis) : data_dinamis;
        let sql = `UPDATE pengajuan_surat SET mahasiswa_id = ?, jenis_surat_id = ?, perihal = ?, data_dinamis = ?, created_by_role = 'staff_tu', status = 'pending_sekprodi'`;
        const params = [mahasiswa_id, jenis_surat_id, perihal, dinamisStr];

        if (ttd_tu_path) {
            sql += `, ttd_tu_path = ?`;
            params.push(ttd_tu_path);
        }
        sql += ` WHERE id = ?`;
        params.push(id);
        await db.run(sql, params);
        return await this.getDetailById(id);
    }

    static async deleteSurat(id) {
        await db.run('DELETE FROM riwayat_disposisi WHERE pengajuan_surat_id = ?', [id]);
        await db.run('DELETE FROM google_drive_docs WHERE pengajuan_surat_id = ?', [id]);
        await db.run('DELETE FROM pengajuan_surat WHERE id = ?', [id]);
    }
}

module.exports = SuratModel;
