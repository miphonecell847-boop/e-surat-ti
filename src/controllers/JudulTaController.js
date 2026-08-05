const JudulTaModel = require('../models/JudulTaModel');
const DosenModel = require('../models/DosenModel');
const MahasiswaModel = require('../models/MahasiswaModel');

class JudulTaController {
    // --- MAHASISWA ---
    static async renderMahasiswaJudul(req, res) {
        try {
            const user = req.session.user;
            const mhs = await MahasiswaModel.findByUserId(user.id);
            if (!mhs) return res.status(403).send('Profil Mahasiswa tidak ditemukan.');

            const listJudul = await JudulTaModel.getByMahasiswaId(mhs.id);
            const dosenList = await DosenModel.getAll();

            return res.render('mahasiswa/pengajuan_judul', {
                title: 'Pengajuan Judul Tugas Akhir',
                mahasiswa: mhs,
                listJudul,
                dosenList,
                error: req.query.error || null,
                success: req.query.success || null
            });
        } catch (err) {
            console.error('Error renderMahasiswaJudul:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async processSubmitJudul(req, res) {
        try {
            const user = req.session.user;
            const mhs = await MahasiswaModel.findByUserId(user.id);
            if (!mhs) return res.status(403).send('Profil Mahasiswa tidak ditemukan.');

            const { 
                judul_1, abstraksi_1, tujuan_1, manfaat_1,
                judul_2, abstraksi_2, tujuan_2, manfaat_2,
                judul_3, abstraksi_3, tujuan_3, manfaat_3,
                dosen_pembimbing_1_id, dosen_pembimbing_2_id 
            } = req.body;

            if (!judul_1 || !abstraksi_1 || !tujuan_1 || !manfaat_1 ||
                !judul_2 || !abstraksi_2 || !tujuan_2 || !manfaat_2 ||
                !judul_3 || !abstraksi_3 || !tujuan_3 || !manfaat_3) {
                return res.redirect('/mahasiswa/pengajuan-judul?error=' + encodeURIComponent('Wajib mengisi 3 Usulan Judul lengkap beserta Abstraksi, Tujuan, dan Manfaat!'));
            }

            let fileProposalUrl = null;
            if (req.file) {
                fileProposalUrl = '/uploads/proposal/' + req.file.filename;
            }

            await JudulTaModel.createProposal({
                mahasiswa_id: mhs.id,
                judul_1, abstraksi_1, tujuan_1, manfaat_1,
                judul_2, abstraksi_2, tujuan_2, manfaat_2,
                judul_3, abstraksi_3, tujuan_3, manfaat_3,
                dosen_pembimbing_1_id: dosen_pembimbing_1_id || null,
                dosen_pembimbing_2_id: dosen_pembimbing_2_id || null,
                file_proposal_url: fileProposalUrl
            });

            return res.redirect('/mahasiswa/pengajuan-judul?success=' + encodeURIComponent('Pengajuan 3 Usulan Judul Tugas Akhir berhasil dikirim! Menunggu verifikasi Tata Usaha, Sekprodi, dan Kaprodi.'));
        } catch (err) {
            console.error('Error processSubmitJudul:', err);
            return res.redirect('/mahasiswa/pengajuan-judul?error=' + encodeURIComponent('Gagal submit pengajuan judul: ' + err.message));
        }
    }

    // --- STAFF TU ---
    static async renderTuVerifikasi(req, res) {
        try {
            const proposals = await JudulTaModel.getAllProposals();
            const dosenList = await DosenModel.getAll();
            return res.render('tu/verifikasi_judul', {
                title: 'Verifikasi Berkas Judul TA - Staff TU',
                proposals,
                dosenList,
                error: req.query.error || null,
                success: req.query.success || null
            });
        } catch (err) {
            console.error('Error renderTuVerifikasi:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async processTuVerifikasi(req, res) {
        try {
            const { 
                proposal_id, 
                status_tu, 
                judul_disetujui_nomor,
                dosen_pembimbing_1_id,
                dosen_pembimbing_2_id,
                dosen_penguji_1_id,
                dosen_penguji_2_id,
                dosen_penguji_3_id,
                catatan_tu 
            } = req.body;
            
            const isApproved = status_tu === 'setuju';

            await JudulTaModel.approveProposalByTuOrProdi({
                id: proposal_id,
                isApproved,
                judulDisetujuiNomor: judul_disetujui_nomor || 1,
                pembimbing1Id: dosen_pembimbing_1_id,
                pembimbing2Id: dosen_pembimbing_2_id,
                penguji1Id: dosen_penguji_1_id,
                penguji2Id: dosen_penguji_2_id,
                penguji3Id: dosen_penguji_3_id,
                catatan: catatan_tu
            });

            const msg = isApproved 
                ? `Judul Pilihan #${judul_disetujui_nomor} berhasil di-ACC! Dosen Pembimbing dan Penguji telah resmi ditetapkan.` 
                : 'Pengajuan Judul TA ditolak dan dikembalikan ke mahasiswa.';

            return res.redirect('/tu/verifikasi-judul?success=' + encodeURIComponent(msg));
        } catch (err) {
            console.error('Error processTuVerifikasi:', err);
            return res.redirect('/tu/verifikasi-judul?error=' + encodeURIComponent(err.message));
        }
    }

    static async processDeleteProposal(req, res) {
        try {
            const { id } = req.params;
            await JudulTaModel.deleteProposal(id);
            return res.redirect('/tu/verifikasi-judul?success=' + encodeURIComponent('Permohonan usulan judul TA berhasil dihapus!'));
        } catch (err) {
            console.error('Error processDeleteProposal:', err);
            return res.redirect('/tu/verifikasi-judul?error=' + encodeURIComponent(err.message));
        }
    }

    // --- SEKPRODI ---
    static async renderSekprodiVerifikasi(req, res) {
        try {
            const proposals = await JudulTaModel.getAllProposals();
            const dosenList = await DosenModel.getAll();
            return res.render('sekprodi/verifikasi_judul', {
                title: 'Validasi Topik & Pembimbing - Sekprodi',
                proposals,
                dosenList,
                error: req.query.error || null,
                success: req.query.success || null
            });
        } catch (err) {
            console.error('Error renderSekprodiVerifikasi:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async processSekprodiVerifikasi(req, res) {
        try {
            const { proposal_id, status_sekprodi, catatan_sekprodi, dosen_pembimbing_1_id, dosen_pembimbing_2_id } = req.body;
            const isApproved = status_sekprodi === 'setuju';

            await JudulTaModel.updateStatusSekprodi(proposal_id, isApproved, catatan_sekprodi, dosen_pembimbing_1_id, dosen_pembimbing_2_id);

            return res.redirect('/sekprodi/verifikasi-judul?success=' + encodeURIComponent('Validasi Topik Sekprodi berhasil disimpan & diteruskan ke Kaprodi.'));
        } catch (err) {
            console.error('Error processSekprodiVerifikasi:', err);
            return res.redirect('/sekprodi/verifikasi-judul?error=' + encodeURIComponent(err.message));
        }
    }

    // --- KAPRODI ---
    static async renderKaprodiDecision(req, res) {
        try {
            const proposals = await JudulTaModel.getAllProposals();
            return res.render('kaprodi/persetujuan_judul', {
                title: 'Otorisasi Keputusan Judul TA - Kaprodi',
                proposals,
                error: req.query.error || null,
                success: req.query.success || null
            });
        } catch (err) {
            console.error('Error renderKaprodiDecision:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async processKaprodiDecision(req, res) {
        try {
            const { proposal_id, status_decision, catatan_kaprodi, judul_disetujui_nomor } = req.body;
            // status_decision: 'diterima', 'ditolak', 'revisi'

            await JudulTaModel.updateStatusKaprodi(proposal_id, status_decision, catatan_kaprodi, judul_disetujui_nomor);

            return res.redirect('/kaprodi/persetujuan-judul?success=' + encodeURIComponent(`Keputusan Judul TA (${status_decision.toUpperCase()}) berhasil disimpan & diteruskan ke Dosen Pembimbing.`));
        } catch (err) {
            console.error('Error processKaprodiDecision:', err);
            return res.redirect('/kaprodi/persetujuan-judul?error=' + encodeURIComponent(err.message));
        }
    }

    // --- DOSEN PEMBIMBING ---
    static async renderDosenKonfirmasi(req, res) {
        try {
            const user = req.session.user;
            const dosen = await DosenModel.findByUserId(user.id);
            if (!dosen) return res.status(403).send('Profil Dosen tidak ditemukan.');

            const proposals = await JudulTaModel.getAllProposals();
            return res.render('dosen/konfirmasi_bimbingan', {
                title: 'Daftar Pengajuan Judul Mahasiswa',
                dosen,
                proposals,
                error: req.query.error || null,
                success: req.query.success || null
            });
        } catch (err) {
            console.error('Error renderDosenKonfirmasi:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async processDosenKonfirmasi(req, res) {
        try {
            const user = req.session.user;
            const dosen = await DosenModel.findByUserId(user.id);
            if (!dosen) return res.status(403).send('Profil Dosen tidak ditemukan.');

            const { proposal_id, role_position, status_choice, catatan } = req.body;
            // status_choice: 'bersedia', 'menolak'

            await JudulTaModel.confirmPembimbing(proposal_id, dosen.id, parseInt(role_position, 10), status_choice, catatan);

            return res.redirect('/dosen/konfirmasi-bimbingan?success=' + encodeURIComponent('Respon kesediaan bimbingan Anda berhasil disimpan.'));
        } catch (err) {
            console.error('Error processDosenKonfirmasi:', err);
            return res.redirect('/dosen/konfirmasi-bimbingan?error=' + encodeURIComponent(err.message));
        }
    }
}

module.exports = JudulTaController;
