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
        try {
            const { id } = req.params;
            const pengajuan = await SuratModel.getDetailById(id);
            if (!pengajuan) {
                return res.status(404).send('Pengajuan tidak ditemukan.');
            }

            const dosenList = await DosenModel.getAll();
            const plotting = await PlottingModel.getByMahasiswaId(pengajuan.mahasiswa_id);
            const docs = await GDriveDocModel.getBySuratId(id);
            const riwayat = await DisposisiModel.getBySuratId(id);

            return res.render('sekprodi/detail_plotting', {
                title: 'Ploting Pembimbing/Penguji & Validasi Sekprodi',
                user: req.session.user,
                pengajuan,
                dosenList,
                plotting,
                docs,
                riwayat
            });
        } catch (err) {
            console.error('Render plotting error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async processPlottingAndVerify(req, res) {
        try {
            const { id } = req.params;
            const {
                dosen_pembimbing_1_id,
                dosen_pembimbing_2_id,
                dosen_penguji_1_id,
                dosen_penguji_2_id,
                dosen_penguji_3_id,
                sk_dekan_nomor,
                catatan_sekprodi,
                action
            } = req.body;

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
                    actor_role: 'sekretaris_prodi',
                    status_sebelumnya: pengajuan.status,
                    status_sesudahnya: 'ditolak',
                    catatan_revisi: catatan_sekprodi || 'Pengajuan ditolak oleh Sekprodi.'
                });
                return res.redirect('/sekprodi/dashboard');
            }

            // Save / Update Ploting TA
            if (dosen_pembimbing_1_id && dosen_pembimbing_2_id) {
                await PlottingModel.saveOrUpdate({
                    mahasiswa_id: pengajuan.mahasiswa_id,
                    dosen_pembimbing_1_id: parseInt(dosen_pembimbing_1_id, 10),
                    dosen_pembimbing_2_id: parseInt(dosen_pembimbing_2_id, 10),
                    dosen_penguji_1_id: dosen_penguji_1_id ? parseInt(dosen_penguji_1_id, 10) : null,
                    dosen_penguji_2_id: dosen_penguji_2_id ? parseInt(dosen_penguji_2_id, 10) : null,
                    dosen_penguji_3_id: dosen_penguji_3_id ? parseInt(dosen_penguji_3_id, 10) : null,
                    sk_dekan_nomor: sk_dekan_nomor || null
                });
            }

            // Update status pengajuan to pending_kaprodi
            await SuratModel.updateStatus(id, 'pending_kaprodi');

            await DisposisiModel.addLog({
                pengajuan_surat_id: id,
                actor_user_id: user.id,
                actor_role: 'sekretaris_prodi',
                status_sebelumnya: pengajuan.status,
                status_sesudahnya: 'pending_kaprodi',
                catatan_revisi: catatan_sekprodi || 'Berkas divalidasi dan ploting Dosen berhasil disimpan. Diteruskan ke Kaprodi.'
            });

            return res.redirect('/sekprodi/dashboard');
        } catch (err) {
            console.error('Process plotting error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }
}

module.exports = SekprodiController;
