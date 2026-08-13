const fs = require('fs');
const path = require('path');
const SuratModel = require('../models/SuratModel');
const DosenModel = require('../models/DosenModel');
const GDriveDocModel = require('../models/GDriveDocModel');
const DisposisiModel = require('../models/DisposisiModel');
const PlottingModel = require('../models/PlottingModel');

class SekprodiController {
    static async dashboard(req, res) {
        try {
            const user = req.session.user;
            const pendingSurat = await SuratModel.getByStatus(['pending_sekprodi']);
            const allSurat = await SuratModel.getAllSurat();

            return res.render('sekprodi/dashboard', {
                title: 'Dashboard Sekretaris Prodi - Validasi & Ploting',
                user,
                pendingSurat,
                allSurat
            });
        } catch (err) {
            console.error('Sekprodi dashboard error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async renderPlotting(req, res) {
        return SekprodiController.renderVerifikasiSurat(req, res);
    }

    static async processPlottingAndVerify(req, res) {
        return SekprodiController.processVerifikasiSurat(req, res);
    }

    static async renderDaftarSurat(req, res) {
        try {
            const user = req.session.user;
            const jenis_surat_id = req.query.jenis_surat_id || null;
            const jenisList = await SuratModel.getJenisSuratList();

            const suratList = await SuratModel.getByFilter({
                jenis_surat_id: jenis_surat_id ? parseInt(jenis_surat_id, 10) : null,
                statusList: ['pending_sekprodi', 'pending_kaprodi', 'pending_tu', 'selesai']
            });

            return res.render('sekprodi/daftar_surat', {
                title: 'Daftar Menu Surat Validasi - Sekretaris Prodi',
                user,
                jenisList,
                suratList,
                selectedJenis: jenis_surat_id
            });
        } catch (err) {
            console.error('Sekprodi renderDaftarSurat error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async renderVerifikasiSurat(req, res) {
        try {
            const { id } = req.params;
            const pengajuan = await SuratModel.getDetailById(id);
            if (!pengajuan) {
                return res.status(404).send('Pengajuan tidak ditemukan.');
            }

            const docs = await GDriveDocModel.getBySuratId(id);
            const riwayat = await DisposisiModel.getBySuratId(id);

            return res.render('sekprodi/verifikasi_surat', {
                title: 'Verifikasi & Validasi Surat (Sekprodi)',
                user: req.session.user,
                pengajuan,
                docs,
                riwayat,
                error: req.query.error || null,
                success: req.query.success || null
            });
        } catch (err) {
            console.error('Render verifikasi surat error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async processVerifikasiSurat(req, res) {
        try {
            const { id } = req.params;
            const { action, catatan_sekprodi } = req.body;
            const user = req.session.user;
            const pengajuan = await SuratModel.getDetailById(id);

            if (!pengajuan) {
                return res.status(404).send('Pengajuan tidak ditemukan.');
            }

            if (action === 'reject') {
                await SuratModel.updateStatus(id, 'revisi');
                await DisposisiModel.addLog({
                    pengajuan_surat_id: id,
                    actor_user_id: user.id,
                    actor_role: 'sekretaris_prodi',
                    status_sebelumnya: pengajuan.status,
                    status_sesudahnya: 'revisi',
                    catatan_revisi: catatan_sekprodi || 'Pengajuan dikembalikan ke TU oleh Sekprodi untuk revisi perbaikan.'
                });
                return res.redirect('/sekprodi/daftar-surat?success=' + encodeURIComponent('Surat dikembalikan ke Staff TU untuk revisi perbaikan.'));
            }

            // Save TTD Digital Sekprodi if uploaded
            if (req.file) {
                const { getUploadsDir } = require('../utils/pathHelper');
                const uploadDir = getUploadsDir('signatures');
                const filename = `ttd_sekprodi_${Date.now()}_${req.file.originalname}`;
                fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);
                await SuratModel.updateTtdSekprodi(id, `/uploads/signatures/${filename}`);
            }

            await SuratModel.updateStatus(id, 'pending_kaprodi');

            await DisposisiModel.addLog({
                pengajuan_surat_id: id,
                actor_user_id: user.id,
                actor_role: 'sekretaris_prodi',
                status_sebelumnya: pengajuan.status,
                status_sesudahnya: 'pending_kaprodi',
                catatan_revisi: catatan_sekprodi || 'Surat divalidasi Sekprodi & TTD Digital dibubuhkan. Diteruskan ke Kaprodi.'
            });

            return res.redirect('/sekprodi/daftar-surat?success=' + encodeURIComponent('Surat berhasil divalidasi Sekprodi dan diteruskan ke Kaprodi.'));
        } catch (err) {
            console.error('Process verifikasi surat error:', err);
            return res.status(500).send('Internal Server Error: ' + err.message);
        }
    }
}

module.exports = SekprodiController;
