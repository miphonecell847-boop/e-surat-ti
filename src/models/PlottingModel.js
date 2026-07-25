const db = require('../../config/database');

class PlottingModel {
    static async getByMahasiswaId(mahasiswaId) {
        const sql = `
            SELECT p.*, 
                   d1.nama_dosen AS pembimbing_1_nama, d1.nip_nidn AS pembimbing_1_nip,
                   d2.nama_dosen AS pembimbing_2_nama, d2.nip_nidn AS pembimbing_2_nip,
                   u1.nama_dosen AS penguji_1_nama, u1.nip_nidn AS penguji_1_nip,
                   u2.nama_dosen AS penguji_2_nama, u2.nip_nidn AS penguji_2_nip,
                   u3.nama_dosen AS penguji_3_nama, u3.nip_nidn AS penguji_3_nip
            FROM plotting_tugas_akhir p
            LEFT JOIN dosen d1 ON p.dosen_pembimbing_1_id = d1.id
            LEFT JOIN dosen d2 ON p.dosen_pembimbing_2_id = d2.id
            LEFT JOIN dosen u1 ON p.dosen_penguji_1_id = u1.id
            LEFT JOIN dosen u2 ON p.dosen_penguji_2_id = u2.id
            LEFT JOIN dosen u3 ON p.dosen_penguji_3_id = u3.id
            WHERE p.mahasiswa_id = ?
        `;
        return await db.get(sql, [mahasiswaId]);
    }

    static async getByDosenPembimbing(dosenId) {
        const sql = `
            SELECT p.*, m.nama_lengkap, m.nim, m.judul_ta
            FROM plotting_tugas_akhir p
            JOIN mahasiswa m ON p.mahasiswa_id = m.id
            WHERE p.dosen_pembimbing_1_id = ? OR p.dosen_pembimbing_2_id = ?
        `;
        return await db.query(sql, [dosenId, dosenId]);
    }

    static async saveOrUpdate({ mahasiswa_id, dosen_pembimbing_1_id, dosen_pembimbing_2_id, dosen_penguji_1_id, dosen_penguji_2_id, dosen_penguji_3_id, sk_dekan_nomor, status_ta }) {
        const existing = await db.get('SELECT id FROM plotting_tugas_akhir WHERE mahasiswa_id = ?', [mahasiswa_id]);
        if (existing) {
            const sql = `
                UPDATE plotting_tugas_akhir 
                SET dosen_pembimbing_1_id = ?, dosen_pembimbing_2_id = ?, 
                    dosen_penguji_1_id = ?, dosen_penguji_2_id = ?, dosen_penguji_3_id = ?,
                    sk_dekan_nomor = ?, status_ta = ?, updated_at = CURRENT_TIMESTAMP
                WHERE mahasiswa_id = ?
            `;
            await db.run(sql, [dosen_pembimbing_1_id, dosen_pembimbing_2_id, dosen_penguji_1_id, dosen_penguji_2_id, dosen_penguji_3_id, sk_dekan_nomor, status_ta || 'bimbingan', mahasiswa_id]);
        } else {
            const sql = `
                INSERT INTO plotting_tugas_akhir 
                (mahasiswa_id, dosen_pembimbing_1_id, dosen_pembimbing_2_id, dosen_penguji_1_id, dosen_penguji_2_id, dosen_penguji_3_id, sk_dekan_nomor, status_ta)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            await db.run(sql, [mahasiswa_id, dosen_pembimbing_1_id, dosen_pembimbing_2_id, dosen_penguji_1_id, dosen_penguji_2_id, dosen_penguji_3_id, sk_dekan_nomor, status_ta || 'bimbingan']);
        }
    }
}

module.exports = PlottingModel;
