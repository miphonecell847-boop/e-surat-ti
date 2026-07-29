const db = require('../../config/database');

class JadwalUjianModel {
    static async createOrUpdateJadwal({ pengajuan_surat_id, mahasiswa_id, jenis_ujian, tanggal_ujian, jam_mulai, jam_selesai, ruangan, judul_ta, pembimbing_1_id, pembimbing_2_id }) {
        let existing = null;
        if (pengajuan_surat_id) {
            existing = await db.get('SELECT * FROM jadwal_ujian WHERE pengajuan_surat_id = ?', [pengajuan_surat_id]);
        }

        if (existing) {
            const sql = `
                UPDATE jadwal_ujian
                SET jenis_ujian = ?, tanggal_ujian = ?, jam_mulai = ?, jam_selesai = ?, ruangan = ?, judul_ta = ?, pembimbing_1_id = ?, pembimbing_2_id = ?
                WHERE pengajuan_surat_id = ?
            `;
            await db.run(sql, [jenis_ujian, tanggal_ujian, jam_mulai || '09:00', jam_selesai || '11:00', ruangan, judul_ta, pembimbing_1_id || null, pembimbing_2_id || null, pengajuan_surat_id]);
            return await db.get('SELECT * FROM jadwal_ujian WHERE pengajuan_surat_id = ?', [pengajuan_surat_id]);
        } else {
            const sql = `
                INSERT INTO jadwal_ujian (pengajuan_surat_id, mahasiswa_id, jenis_ujian, tanggal_ujian, jam_mulai, jam_selesai, ruangan, judul_ta, pembimbing_1_id, pembimbing_2_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            await db.run(sql, [pengajuan_surat_id || null, mahasiswa_id, jenis_ujian, tanggal_ujian, jam_mulai || '09:00', jam_selesai || '11:00', ruangan, judul_ta, pembimbing_1_id || null, pembimbing_2_id || null]);
            return await db.get('SELECT * FROM jadwal_ujian WHERE mahasiswa_id = ? ORDER BY id DESC LIMIT 1', [mahasiswa_id]);
        }
    }

    static async getByMahasiswaId(mahasiswa_id) {
        const sql = `
            SELECT j.*, m.nama_lengkap AS mhs_nama, m.nim AS mhs_nim,
                   d1.nama_dosen AS p1_nama, d2.nama_dosen AS p2_nama,
                   p.uuid_surat, p.nomor_surat
            FROM jadwal_ujian j
            JOIN mahasiswa m ON j.mahasiswa_id = m.id
            LEFT JOIN dosen d1 ON j.pembimbing_1_id = d1.id
            LEFT JOIN dosen d2 ON j.pembimbing_2_id = d2.id
            LEFT JOIN pengajuan_surat p ON j.pengajuan_surat_id = p.id
            WHERE j.mahasiswa_id = ?
            ORDER BY j.tanggal_ujian ASC
        `;
        return await db.query(sql, [mahasiswa_id]);
    }

    static async getByDosenId(dosen_id) {
        const sql = `
            SELECT j.*, m.nama_lengkap AS mhs_nama, m.nim AS mhs_nim,
                   d1.nama_dosen AS p1_nama, d2.nama_dosen AS p2_nama,
                   p.uuid_surat, p.nomor_surat
            FROM jadwal_ujian j
            JOIN mahasiswa m ON j.mahasiswa_id = m.id
            LEFT JOIN dosen d1 ON j.pembimbing_1_id = d1.id
            LEFT JOIN dosen d2 ON j.pembimbing_2_id = d2.id
            LEFT JOIN pengajuan_surat p ON j.pengajuan_surat_id = p.id
            WHERE j.pembimbing_1_id = ? OR j.pembimbing_2_id = ?
            ORDER BY j.tanggal_ujian ASC
        `;
        return await db.query(sql, [dosen_id, dosen_id]);
    }

    static async getAllJadwal() {
        const sql = `
            SELECT j.*, m.nama_lengkap AS mhs_nama, m.nim AS mhs_nim,
                   d1.nama_dosen AS p1_nama, d2.nama_dosen AS p2_nama,
                   p.uuid_surat, p.nomor_surat
            FROM jadwal_ujian j
            JOIN mahasiswa m ON j.mahasiswa_id = m.id
            LEFT JOIN dosen d1 ON j.pembimbing_1_id = d1.id
            LEFT JOIN dosen d2 ON j.pembimbing_2_id = d2.id
            LEFT JOIN pengajuan_surat p ON j.pengajuan_surat_id = p.id
            ORDER BY j.tanggal_ujian ASC
        `;
        return await db.query(sql);
    }
}

module.exports = JadwalUjianModel;
