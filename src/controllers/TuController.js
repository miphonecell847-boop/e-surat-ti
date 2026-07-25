const SuratModel = require('../models/SuratModel');
const MahasiswaModel = require('../models/MahasiswaModel');
const DosenModel = require('../models/DosenModel');
const GDriveDocModel = require('../models/GDriveDocModel');
const DisposisiModel = require('../models/DisposisiModel');
const PdfGeneratorService = require('../services/PdfGeneratorService');
const ESignatureService = require('../services/ESignatureService');
const gdriveService = require('../services/GDriveStorageService');
const appConfig = require('../../config/app');

class TuController {
    static async dashboard(req, res) {
        try {
            const user = req.session.user;
            const pendingSurat = await SuratModel.getByStatus(['pending_tu']);
            const completedSurat = await SuratModel.getByStatus(['selesai']);

            return res.render('tu/dashboard', {
                title: 'Dashboard Staff TU - Penomoran & Cetak PDF',
                user,
                pendingSurat,
                completedSurat
            });
        } catch (err) {
            console.error('TU dashboard error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async renderPenomoran(req, res) {
        try {
            const { id } = req.params;
            const pengajuan = await SuratModel.getDetailById(id);
            if (!pengajuan) {
                return res.status(404).send('Pengajuan tidak ditemukan.');
            }

            const docs = await GDriveDocModel.getBySuratId(id);
            const riwayat = await DisposisiModel.getBySuratId(id);

            // Default auto-generated nomor surat
            const defaultNomor = `B/${Math.floor(100 + Math.random() * 900)}/UN.1/TI/TA/2026`;

            return res.render('tu/detail_penomoran', {
                title: 'Penomoran Surat & Penerbitan PDF',
                user: req.session.user,
                pengajuan,
                docs,
                riwayat,
                defaultNomor
            });
        } catch (err) {
            console.error('Render penomoran error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async processPenomoranAndGeneratePdf(req, res) {
        try {
            const { id } = req.params;
            const { nomor_surat } = req.body;
            const user = req.session.user;

            const pengajuan = await SuratModel.getDetailById(id);
            if (!pengajuan) {
                return res.status(404).send('Pengajuan tidak ditemukan.');
            }

            // 1. Simpan Nomor Surat Resmi
            await SuratModel.setNomorSurat(id, nomor_surat);
            pengajuan.nomor_surat = nomor_surat;

            const mhs = await MahasiswaModel.findById(pengajuan.mahasiswa_id);
            const kaprodiDosen = await DosenModel.getDosenKaprodi ? await DosenModel.getDosenKaprodi() : { nama_dosen: 'Dr. Eng. Nama Kaprodi, M.T.', nip_nidn: '198501012010121001' };

            // 2. Generate PDF Final Buffer
            const verifyUrl = `${appConfig.baseUrl}/verify-doc/${pengajuan.uuid_surat}`;
            const pdfBuffer = await PdfGeneratorService.generateSuratPdf({
                pengajuan,
                mahasiswa: mhs,
                jenisSurat: { nama_surat: pengajuan.nama_surat },
                kaprodi: kaprodiDosen,
                verifyUrl,
                signatureHash: pengajuan.qr_signature_hash
            });

            // 3. Upload PDF Final ke Google Drive
            const ROOT_FOLDER = appConfig.gdriveRootFolderId;
            const tahunFolderId = await gdriveService.getOrCreateFolder('2026', ROOT_FOLDER);
            const mhsFolderName = `${mhs.nim}_${mhs.nama_lengkap.replace(/\s+/g, '_')}`;
            const mhsFolderId = await gdriveService.getOrCreateFolder(mhsFolderName, tahunFolderId);
            const pdfFolderId = await gdriveService.getOrCreateFolder('Surat_Resmi_PDF', mhsFolderId);

            const pdfFileName = `${pengajuan.kode_surat}_${mhs.nim}_FINAL.pdf`;
            const driveResult = await gdriveService.uploadFileStream(
                pdfBuffer,
                pdfFileName,
                'application/pdf',
                pdfFolderId
            );

            // 4. Simpan Metadata Drive ke SQL
            await GDriveDocModel.saveMetadata({
                pengajuan_surat_id: id,
                gdrive_file_id: driveResult.id,
                gdrive_folder_id: pdfFolderId,
                nama_file_original: pdfFileName,
                kategori_berkas: 'surat_final_pdf',
                mime_type: 'application/pdf',
                file_size_bytes: driveResult.size || pdfBuffer.length,
                web_view_link: driveResult.webViewLink,
                web_content_link: driveResult.webContentLink
            });

            // 5. Update Status -> SELESAI
            await SuratModel.updateStatus(id, 'selesai');

            await DisposisiModel.addLog({
                pengajuan_surat_id: id,
                actor_user_id: user.id,
                actor_role: 'staff_tu',
                status_sebelumnya: 'pending_tu',
                status_sesudahnya: 'selesai',
                catatan_revisi: `Surat Resmi diterbitkan dengan Nomor: ${nomor_surat}. Dokumen PDF tersimpan otomatis di Google Drive Arsip.`
            });

            return res.redirect('/tu/dashboard');
        } catch (err) {
            console.error('Process penomoran error:', err);
            return res.status(500).send('Internal Server Error: ' + err.message);
        }
    }
}

module.exports = TuController;
