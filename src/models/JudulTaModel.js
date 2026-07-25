const db = require('../../config/database');
const { v4: uuidv4 } = require('uuid');

class JudulTaModel {
    static async createProposal({ mahasiswa_id, judul_ta, abstrak_rumusan, dosen_pembimbing_1_id, dosen_pembimbing_2_id, file_proposal_gdrive_id, file_proposal_url }) {
        const uuid = 'judul-ta-' + uuidv4().substring(0, 8);
        const sql = `
            INSERT INTO pengajuan_judul_ta 
            (uuid_pengajuan, mahasiswa_id, judul_ta, abstrak_rumusan, dosen_pembimbing_1_id, dosen_pembimbing_2_id, file_proposal_gdrive_id, file_proposal_url, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_tu')
        `;
        await db.run(sql, [uuid, mahasiswa_id, judul_ta, abstrak_rumusan, dosen_pembimbing_1_id, dosen_pembimbing_2_id, file_proposal_gdrive_id || null, file_proposal_url || null]);
        return await db.get('SELECT * FROM pengajuan_judul_ta WHERE uuid_pengajuan = ?', [uuid]);
    }

    static async getByMahasiswaId(mahasiswaId) {
        const sql = `
            SELECT p.*, 
                   d1.nama_dosen as pembimbing_1_nama,
                   d2.nama_dosen as pembimbing_2_nama
            FROM pengajuan_judul_ta p
            JOIN dosen d1 ON p.dosen_pembimbing_1_id = d1.id
            JOIN dosen d2 ON p.dosen_pembimbing_2_id = d2.id
            WHERE p.mahasiswa_id = ?
            ORDER BY p.created_at DESC
        `;
        return await db.query(sql, [mahasiswaId]);
    }

    static async getProposalById(id) {
        const sql = `
            SELECT p.*, 
                   m.nim, m.nama_lengkap as mhs_nama, m.angkatan,
                   d1.nama_dosen as pembimbing_1_nama, d1.nip_nidn as pembimbing_1_nip,
                   d2.nama_dosen as pembimbing_2_nama, d2.nip_nidn as pembimbing_2_nip
            FROM pengajuan_judul_ta p
            JOIN mahasiswa m ON p.mahasiswa_id = m.id
            JOIN dosen d1 ON p.dosen_pembimbing_1_id = d1.id
            JOIN dosen d2 ON p.dosen_pembimbing_2_id = d2.id
            WHERE p.id = ?
        `;
        return await db.get(sql, [id]);
    }

    static async getAllProposals(statusFilter = null) {
        let sql = `
            SELECT p.*, 
                   m.nim, m.nama_lengkap as mhs_nama,
                   d1.nama_dosen as pembimbing_1_nama,
                   d2.nama_dosen as pembimbing_2_nama
            FROM pengajuan_judul_ta p
            JOIN mahasiswa m ON p.mahasiswa_id = m.id
            JOIN dosen d1 ON p.dosen_pembimbing_1_id = d1.id
            JOIN dosen d2 ON p.dosen_pembimbing_2_id = d2.id
        `;
        if (statusFilter) {
            sql += ` WHERE p.status = '${statusFilter}'`;
        }
        sql += ` ORDER BY p.created_at DESC`;
        return await db.query(sql);
    }

    static async getProposalsForDosen(dosenId) {
        const sql = `
            SELECT p.*, 
                   m.nim, m.nama_lengkap as mhs_nama,
                   d1.nama_dosen as pembimbing_1_nama,
                   d2.nama_dosen as pembimbing_2_nama
            FROM pengajuan_judul_ta p
            JOIN mahasiswa m ON p.mahasiswa_id = m.id
            JOIN dosen d1 ON p.dosen_pembimbing_1_id = d1.id
            JOIN dosen d2 ON p.dosen_pembimbing_2_id = d2.id
            WHERE p.status = 'diterima' AND (p.dosen_pembimbing_1_id = ? OR p.dosen_pembimbing_2_id = ?)
            ORDER BY p.updated_at DESC
        `;
        return await db.query(sql, [dosenId, dosenId]);
    }

    static async updateStatusTu(id, isApproved, catatan) {
        const nextStatus = isApproved ? 'pending_sekprodi' : 'ditolak';
        const sql = `
            UPDATE pengajuan_judul_ta 
            SET status = ?, catatan_tu = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        await db.run(sql, [nextStatus, catatan || null, id]);
    }

    static async updateStatusSekprodi(id, isApproved, catatan, p1Id, p2Id) {
        const nextStatus = isApproved ? 'pending_kaprodi' : 'ditolak';
        const sql = `
            UPDATE pengajuan_judul_ta 
            SET status = ?, catatan_sekprodi = ?, dosen_pembimbing_1_id = ?, dosen_pembimbing_2_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        await db.run(sql, [nextStatus, catatan || null, p1Id, p2Id, id]);
    }

    static async updateStatusKaprodi(id, statusDecision, catatan) {
        const sql = `
            UPDATE pengajuan_judul_ta 
            SET status = ?, catatan_kaprodi = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        await db.run(sql, [statusDecision, catatan || null, id]);

        // If accepted by Kaprodi, update Mahasiswa's title in database
        if (statusDecision === 'diterima') {
            const proposal = await this.getProposalById(id);
            if (proposal) {
                await db.run('UPDATE mahasiswa SET judul_ta = ? WHERE id = ?', [proposal.judul_ta, proposal.mahasiswa_id]);
            }
        }
    }

    static async confirmPembimbing(id, dosenId, rolePosition, statusChoice, catatan) {
        let fieldStatus = rolePosition === 1 ? 'pembimbing_1_status' : 'pembimbing_2_status';
        let fieldCatatan = rolePosition === 1 ? 'catatan_pembimbing_1' : 'catatan_pembimbing_2';

        const sql = `
            UPDATE pengajuan_judul_ta 
            SET ${fieldStatus} = ?, ${fieldCatatan} = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        await db.run(sql, [statusChoice, catatan || null, id]);
    }
}

module.exports = JudulTaModel;
