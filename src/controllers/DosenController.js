const SuratModel = require('../models/SuratModel');
const DosenModel = require('../models/DosenModel');
const GDriveDocModel = require('../models/GDriveDocModel');
const DisposisiModel = require('../models/DisposisiModel');
const PlottingModel = require('../models/PlottingModel');

class DosenController {
    static async dashboard(req, res) {
        try {
            const user = req.session.user;
            const dosen = await DosenModel.findByUserId(user.id);
            if (!dosen) {
                return res.status(400).send('Profil Dosen tidak ditemukan.');
            }

            // Inbox pengajuan pending pembimbing 1 & 2
            const pendingP1 = await SuratModel.getByStatus(['pending_pembimbing_1']);
            const pendingP2 = await SuratModel.getByStatus(['pending_pembimbing_2']);
            const allAssignedBimbingan = await PlottingModel.getByDosenPembimbing(dosen.id);

            return res.render('dosen/dashboard', {
                title: 'Dashboard Dosen Pembimbing & Penguji',
                user,
                dosen,
                pendingP1,
                pendingP2,
                allAssignedBimbingan
            });
        } catch (err) {
            console.error('Dosen dashboard error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async renderReview(req, res) {
        try {
            const { id } = req.params;
            const pengajuan = await SuratModel.getDetailById(id);
            if (!pengajuan) {
                return res.status(404).send('Pengajuan surat tidak ditemukan.');
            }

            const docs = await GDriveDocModel.getBySuratId(id);
            const riwayat = await DisposisiModel.getBySuratId(id);

            return res.render('dosen/detail_review', {
                title: 'Review Pengajuan Surat',
                user: req.session.user,
                pengajuan,
                docs,
                riwayat
            });
        } catch (err) {
            console.error('Render review error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async processAction(req, res) {
        try {
            const { id } = req.params;
            const { action, catatan_revisi } = req.body; // 'approve', 'revision', 'reject'
            const user = req.session.user;
            const pengajuan = await SuratModel.getDetailById(id);

            if (!pengajuan) {
                return res.status(404).send('Pengajuan surat tidak ditemukan.');
            }

            const prevStatus = pengajuan.status;
            let nextStatus = prevStatus;
            let approvalP1 = null;
            let approvalP2 = null;

            if (action === 'approve') {
                if (prevStatus === 'pending_pembimbing_1') {
                    nextStatus = 'pending_pembimbing_2';
                    approvalP1 = true;
                } else if (prevStatus === 'pending_pembimbing_2') {
                    nextStatus = 'pending_sekprodi';
                    approvalP2 = true;
                }
            } else if (action === 'revision') {
                nextStatus = 'revisi';
            } else if (action === 'reject') {
                nextStatus = 'ditolak';
            }

            await SuratModel.updateStatus(id, nextStatus, approvalP1, approvalP2);

            await DisposisiModel.addLog({
                pengajuan_surat_id: id,
                actor_user_id: user.id,
                actor_role: 'dosen',
                status_sebelumnya: prevStatus,
                status_sesudahnya: nextStatus,
                catatan_revisi: catatan_revisi || `Action: ${action.toUpperCase()}`
            });

            return res.redirect('/dosen/dashboard');
        } catch (err) {
            console.error('Process action error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }
}

module.exports = DosenController;
