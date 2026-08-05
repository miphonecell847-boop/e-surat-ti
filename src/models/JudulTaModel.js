const db = require('../../config/database');
const { v4: uuidv4 } = require('uuid');

class JudulTaModel {
    static async createProposal({ 
        mahasiswa_id, 
        judul_1, abstraksi_1, tujuan_1, manfaat_1,
        judul_2, abstraksi_2, tujuan_2, manfaat_2,
        judul_3, abstraksi_3, tujuan_3, manfaat_3,
        dosen_pembimbing_1_id, dosen_pembimbing_2_id, 
        file_proposal_gdrive_id, file_proposal_url 
    }) {
        const uuid = 'judul-ta-' + uuidv4().substring(0, 8);
        const sql = `
            INSERT INTO pengajuan_judul_ta 
            (uuid_pengajuan, mahasiswa_id, 
             judul_1, abstraksi_1, tujuan_1, manfaat_1,
             judul_2, abstraksi_2, tujuan_2, manfaat_2,
             judul_3, abstraksi_3, tujuan_3, manfaat_3,
             judul_ta, abstrak_rumusan,
             dosen_pembimbing_1_id, dosen_pembimbing_2_id, file_proposal_gdrive_id, file_proposal_url, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_tu')
        `;
        await db.run(sql, [
            uuid, mahasiswa_id, 
            judul_1, abstraksi_1, tujuan_1, manfaat_1,
            judul_2, abstraksi_2, tujuan_2, manfaat_2,
            judul_3, abstraksi_3, tujuan_3, manfaat_3,
            judul_1, abstraksi_1,
            dosen_pembimbing_1_id || null, dosen_pembimbing_2_id || null, 
            file_proposal_gdrive_id || null, file_proposal_url || null
        ]);
        return await db.get('SELECT * FROM pengajuan_judul_ta WHERE uuid_pengajuan = ?', [uuid]);
    }

    static async getByMahasiswaId(mahasiswaId) {
        const sql = `
            SELECT p.*, 
                   COALESCE(d1.nama_dosen, 'Belum Ditentukan') as pembimbing_1_nama,
                   COALESCE(d2.nama_dosen, 'Belum Ditentukan') as pembimbing_2_nama
            FROM pengajuan_judul_ta p
            LEFT JOIN dosen d1 ON p.dosen_pembimbing_1_id = d1.id
            LEFT JOIN dosen d2 ON p.dosen_pembimbing_2_id = d2.id
            WHERE p.mahasiswa_id = ?
            ORDER BY p.created_at DESC
        `;
        return await db.query(sql, [mahasiswaId]);
    }

    static async getProposalById(id) {
        const sql = `
            SELECT p.*, 
                   m.nim, m.nama_lengkap as mhs_nama, m.angkatan,
                   COALESCE(d1.nama_dosen, 'Belum Ditentukan') as pembimbing_1_nama, d1.nip_nidn as pembimbing_1_nip,
                   COALESCE(d2.nama_dosen, 'Belum Ditentukan') as pembimbing_2_nama, d2.nip_nidn as pembimbing_2_nip
            FROM pengajuan_judul_ta p
            JOIN mahasiswa m ON p.mahasiswa_id = m.id
            LEFT JOIN dosen d1 ON p.dosen_pembimbing_1_id = d1.id
            LEFT JOIN dosen d2 ON p.dosen_pembimbing_2_id = d2.id
            WHERE p.id = ?
        `;
        return await db.get(sql, [id]);
    }

    static async getAllProposals(statusFilter = null) {
        let sql = `
            SELECT p.*, 
                   COALESCE(m.nim, '-') as nim, 
                   COALESCE(m.nama_lengkap, 'Mahasiswa') as mhs_nama,
                   d1.nama_dosen as pembimbing_1_nama,
                   d2.nama_dosen as pembimbing_2_nama
            FROM pengajuan_judul_ta p
            LEFT JOIN mahasiswa m ON p.mahasiswa_id = m.id
            LEFT JOIN dosen d1 ON p.dosen_pembimbing_1_id = d1.id
            LEFT JOIN dosen d2 ON p.dosen_pembimbing_2_id = d2.id
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

    static async updateStatusKaprodi(id, statusDecision, catatan, judulDisetujuiNomor = 1) {
        const num = parseInt(judulDisetujuiNomor, 10) || 1;
        const sql = `
            UPDATE pengajuan_judul_ta 
            SET status = ?, catatan_kaprodi = ?, judul_disetujui_nomor = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        await db.run(sql, [statusDecision, catatan || null, num, id]);

        // If accepted by Kaprodi, update Mahasiswa's title in database with selected title
        if (statusDecision === 'diterima') {
            const proposal = await this.getProposalById(id);
            if (proposal) {
                let chosenTitle = proposal.judul_1 || proposal.judul_ta;
                let chosenAbstrak = proposal.abstraksi_1 || proposal.abstrak_rumusan;
                if (num === 2 && proposal.judul_2) {
                    chosenTitle = proposal.judul_2;
                    chosenAbstrak = proposal.abstraksi_2;
                } else if (num === 3 && proposal.judul_3) {
                    chosenTitle = proposal.judul_3;
                    chosenAbstrak = proposal.abstraksi_3;
                }
                // Update proposal's active title and abstrak
                await db.run('UPDATE pengajuan_judul_ta SET judul_ta = ?, abstrak_rumusan = ? WHERE id = ?', [chosenTitle, chosenAbstrak, id]);
                // Sync to Mahasiswa profile
                await db.run('UPDATE mahasiswa SET judul_ta = ? WHERE id = ?', [chosenTitle, proposal.mahasiswa_id]);
            }
        }
    }

    /**
     * ACC Judul TA & Tetapkan Dosen Pembimbing + Dosen Penguji oleh Staff TU / Prodi
     */
    static async approveProposalByTuOrProdi({
        id,
        isApproved,
        judulDisetujuiNomor = 1,
        pembimbing1Id,
        pembimbing2Id,
        penguji1Id,
        penguji2Id,
        penguji3Id,
        catatan
    }) {
        const proposal = await this.getProposalById(id);
        if (!proposal) throw new Error('Pengajuan Judul TA tidak ditemukan.');

        const num = parseInt(judulDisetujuiNomor, 10) || 1;
        const statusDecision = isApproved ? 'diterima' : 'ditolak';

        let chosenTitle = proposal.judul_1 || proposal.judul_ta;
        let chosenAbstrak = proposal.abstraksi_1 || proposal.abstrak_rumusan;
        if (num === 2 && proposal.judul_2) {
            chosenTitle = proposal.judul_2;
            chosenAbstrak = proposal.abstraksi_2;
        } else if (num === 3 && proposal.judul_3) {
            chosenTitle = proposal.judul_3;
            chosenAbstrak = proposal.abstraksi_3;
        }

        const p1Id = pembimbing1Id || proposal.dosen_pembimbing_1_id;
        const p2Id = pembimbing2Id || proposal.dosen_pembimbing_2_id;

        const sql = `
            UPDATE pengajuan_judul_ta 
            SET status = ?, 
                judul_disetujui_nomor = ?, 
                judul_ta = ?, 
                abstrak_rumusan = ?, 
                dosen_pembimbing_1_id = ?, 
                dosen_pembimbing_2_id = ?, 
                catatan_tu = ?, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        await db.run(sql, [statusDecision, num, chosenTitle, chosenAbstrak, p1Id, p2Id, catatan || null, id]);

        if (statusDecision === 'diterima') {
            // 1. Sync title to Mahasiswa profile
            await db.run('UPDATE mahasiswa SET judul_ta = ? WHERE id = ?', [chosenTitle, proposal.mahasiswa_id]);

            // 2. Upsert Plotting Tugas Akhir (Pembimbing & Penguji)
            const checkPlot = await db.get('SELECT id FROM plotting_tugas_akhir WHERE mahasiswa_id = ?', [proposal.mahasiswa_id]);
            if (checkPlot) {
                await db.run(`
                    UPDATE plotting_tugas_akhir 
                    SET dosen_pembimbing_1_id = ?, dosen_pembimbing_2_id = ?, 
                        dosen_penguji_1_id = ?, dosen_penguji_2_id = ?, dosen_penguji_3_id = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE mahasiswa_id = ?
                `, [p1Id, p2Id, penguji1Id || null, penguji2Id || null, penguji3Id || null, proposal.mahasiswa_id]);
            } else {
                await db.run(`
                    INSERT INTO plotting_tugas_akhir 
                    (mahasiswa_id, dosen_pembimbing_1_id, dosen_pembimbing_2_id, dosen_penguji_1_id, dosen_penguji_2_id, dosen_penguji_3_id, sk_dekan_nomor, status_ta)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'bimbingan')
                `, [proposal.mahasiswa_id, p1Id, p2Id, penguji1Id || null, penguji2Id || null, penguji3Id || null, `SK-DEKAN/${new Date().getFullYear()}/${Math.floor(100+Math.random()*900)}`]);
            }
        }
    }

    static async deleteProposal(id) {
        const prop = await db.get('SELECT mahasiswa_id FROM pengajuan_judul_ta WHERE id = ?', [id]);
        if (prop && prop.mahasiswa_id) {
            await db.run('UPDATE mahasiswa SET judul_ta = NULL WHERE id = ?', [prop.mahasiswa_id]);
        }
        await db.run('DELETE FROM pengajuan_judul_ta WHERE id = ?', [id]);
    }
}

module.exports = JudulTaModel;
