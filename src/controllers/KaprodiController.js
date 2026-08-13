const SuratModel = require('../models/SuratModel');
const DosenModel = require('../models/DosenModel');
const GDriveDocModel = require('../models/GDriveDocModel');
const DisposisiModel = require('../models/DisposisiModel');
const ESignatureService = require('../services/ESignatureService');

class KaprodiController {
    static async dashboard(req, res) {
        try {
            const user = req.session.user;
            const pendingSurat = await SuratModel.getByStatus(['pending_kaprodi']);
            const kaprodiDosen = await DosenModel.findByUserId(user.id);

            return res.render('kaprodi/dashboard', {
                title: 'Dashboard Kaprodi - Otorisasi & E-Signature',
                user,
                kaprodiDosen,
                pendingSurat
            });
        } catch (err) {
            console.error('Kaprodi dashboard error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async renderApproval(req, res) {
        try {
            const { id } = req.params;
            const pengajuan = await SuratModel.getDetailById(id);
            if (!pengajuan) {
                return res.status(404).send('Pengajuan tidak ditemukan.');
            }

            const docs = await GDriveDocModel.getBySuratId(id);
            const riwayat = await DisposisiModel.getBySuratId(id);
            const kaprodiDosen = await DosenModel.findByUserId(req.session.user.id);

            // Preview QR Verification URL
            const { verifyUrl } = await ESignatureService.generateQRCodeDataUrl(pengajuan.uuid_surat);

            return res.render('kaprodi/detail_approval', {
                title: 'Otorisasi & Semat E-Signature',
                user: req.session.user,
                pengajuan,
                kaprodiDosen,
                docs,
                riwayat,
                verifyUrl
            });
        } catch (err) {
            console.error('Render approval error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async processApproval(req, res) {
        try {
            const { id } = req.params;
            const { action, catatan_kaprodi } = req.body;
            const user = req.session.user;
            const pengajuan = await SuratModel.getDetailById(id);

            if (!pengajuan) {
                return res.status(404).send('Pengajuan tidak ditemukan.');
            }

            if (action === 'reject') {
                await SuratModel.updateStatus(id, 'ditolak');
                await DisposisiModel.addLog({
                    pengajuan_surat_id: id,
                    actor_user_id: user.id,
                    actor_role: 'kaprodi',
                    status_sebelumnya: pengajuan.status,
                    status_sesudahnya: 'ditolak',
                    catatan_revisi: catatan_kaprodi || 'Pengajuan ditolak oleh Kaprodi.'
                });
                return res.redirect('/kaprodi/dashboard');
            }

            const kaprodiDosen = await DosenModel.findByUserId(user.id);
            const signatureHash = ESignatureService.generateSignatureHash({
                uuid_surat: pengajuan.uuid_surat,
                nim: pengajuan.mhs_nim,
                nama_kaprodi: kaprodiDosen ? kaprodiDosen.nama_dosen : 'Kaprodi Teknik Informatika',
                nip_kaprodi: kaprodiDosen ? kaprodiDosen.nip_nidn : '198501012010121001',
                timestamp: Date.now()
            });

            // Save TTD Digital Kaprodi if uploaded
            if (req.file) {
                const { getUploadsDir } = require('../utils/pathHelper');
                const uploadDir = getUploadsDir('signatures');
                const filename = `ttd_kaprodi_${Date.now()}_${req.file.originalname}`;
                fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);
                await SuratModel.updateTtdKaprodi(id, `/uploads/signatures/${filename}`);
            }

            // Update status & embed signature hash
            await SuratModel.updateStatus(id, 'pending_tu', null, null, signatureHash);

            await DisposisiModel.addLog({
                pengajuan_surat_id: id,
                actor_user_id: user.id,
                actor_role: 'kaprodi',
                status_sebelumnya: pengajuan.status,
                status_sesudahnya: 'pending_tu',
                catatan_revisi: catatan_kaprodi || `Tanda Tangan Digital (E-Signature QR & Spesimen TTD) berhasil disematkan. Diteruskan ke Staff TU.`
            });

            return res.redirect('/kaprodi/daftar-surat?success=' + encodeURIComponent('Surat berhasil diotorisasi Kaprodi.'));
        } catch (err) {
            console.error('Process approval error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async renderDaftarSurat(req, res) {
        try {
            const user = req.session.user;
            const jenis_surat_id = req.query.jenis_surat_id || null;
            const jenisList = await SuratModel.getJenisSuratList();

            const suratList = await SuratModel.getByFilter({
                jenis_surat_id: jenis_surat_id ? parseInt(jenis_surat_id, 10) : null,
                statusList: ['pending_kaprodi', 'pending_tu', 'selesai']
            });

            return res.render('kaprodi/daftar_surat', {
                title: 'Daftar Menu Surat Otorisasi - Ketua Prodi',
                user,
                jenisList,
                suratList,
                selectedJenis: jenis_surat_id
            });
        } catch (err) {
            console.error('Kaprodi renderDaftarSurat error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }
}

module.exports = KaprodiController;
