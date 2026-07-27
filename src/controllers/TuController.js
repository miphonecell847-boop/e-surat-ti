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
    static async renderDaftarSurat(req, res) {
        try {
            const user = req.session.user;
            const jenis_surat_id = req.query.jenis_surat_id || null;
            const jenisList = await SuratModel.getJenisSuratList();

            const suratList = await SuratModel.getByFilter({
                jenis_surat_id: jenis_surat_id ? parseInt(jenis_surat_id, 10) : null,
                statusList: null
            });

            return res.render('tu/daftar_surat', {
                title: 'Daftar Menu Surat Administrasi - Staff TU',
                user,
                jenisList,
                suratList,
                selectedJenis: jenis_surat_id,
                error: req.query.error || null,
                success: req.query.success || null
            });
        } catch (err) {
            console.error('TU renderDaftarSurat error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async renderBuatSurat(req, res) {
        try {
            const user = req.session.user;
            const { from_id } = req.query;
            const mahasiswaList = await MahasiswaModel.getAll();
            const jenisList = await SuratModel.getJenisSuratList();
            const dosenList = await DosenModel.getAll();

            let prefilledData = null;
            if (from_id) {
                const pengajuanMhs = await SuratModel.getDetailById(from_id);
                if (pengajuanMhs) {
                    let dinamisObj = {};
                    try {
                        dinamisObj = typeof pengajuanMhs.data_dinamis === 'string' ? JSON.parse(pengajuanMhs.data_dinamis) : (pengajuanMhs.data_dinamis || {});
                    } catch (e) {}

                    prefilledData = {
                        from_id: pengajuanMhs.id,
                        mahasiswa_id: pengajuanMhs.mahasiswa_id,
                        jenis_surat_id: pengajuanMhs.jenis_surat_id,
                        perihal: pengajuanMhs.perihal,
                        pembimbing_1_id: dinamisObj.pembimbing_1_id || '',
                        pembimbing_2_id: dinamisObj.pembimbing_2_id || '',
                        instansi_tujuan: dinamisObj.instansi_tujuan || '',
                        durasi: dinamisObj.durasi || '',
                        catatan: dinamisObj.catatan || ''
                    };
                }
            }

            return res.render('tu/buat_surat', {
                title: 'Form Pembuatan Surat Permintaan (Staff TU)',
                user,
                mahasiswaList,
                jenisList,
                dosenList,
                prefilledData,
                error: req.query.error || null,
                success: req.query.success || null
            });
        } catch (err) {
            console.error('TU renderBuatSurat error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async processBuatSurat(req, res) {
        try {
            const user = req.session.user;
            const { from_id, mahasiswa_id, jenis_surat_id, perihal, pembimbing_1_id, pembimbing_2_id, instansi_tujuan, durasi, catatan } = req.body;
            const { v4: uuidv4 } = require('uuid');
            const fs = require('fs');
            const path = require('path');

            if (!mahasiswa_id || !jenis_surat_id || !perihal) {
                return res.redirect('/tu/buat-surat?error=' + encodeURIComponent('Mahasiswa, Jenis Surat, dan Perihal wajib diisi!'));
            }

            let ttdTuPath = null;
            if (req.file) {
                const uploadDir = path.join(__dirname, '../../public/uploads/signatures');
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }
                const filename = `ttd_tu_${Date.now()}_${req.file.originalname}`;
                fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);
                ttdTuPath = `/uploads/signatures/${filename}`;
            }

            const parsedDinamis = {
                pembimbing_1_id: pembimbing_1_id ? parseInt(pembimbing_1_id, 10) : null,
                pembimbing_2_id: pembimbing_2_id ? parseInt(pembimbing_2_id, 10) : null,
                instansi_tujuan: instansi_tujuan || '',
                durasi: durasi || '',
                catatan: catatan || ''
            };

            if (from_id) {
                // UPDATE SAME EXISTING LETTER (DO NOT CREATE NEW ROW)
                const pengajuanEksisting = await SuratModel.getDetailById(from_id);
                if (pengajuanEksisting) {
                    await SuratModel.forwardSuratByTu(from_id, {
                        mahasiswa_id: parseInt(mahasiswa_id, 10),
                        jenis_surat_id: parseInt(jenis_surat_id, 10),
                        perihal,
                        data_dinamis: parsedDinamis,
                        ttd_tu_path: ttdTuPath
                    });

                    await DisposisiModel.addLog({
                        pengajuan_surat_id: from_id,
                        actor_user_id: user.id,
                        actor_role: 'staff_tu',
                        status_sebelumnya: pengajuanEksisting.status,
                        status_sesudahnya: 'pending_sekprodi',
                        catatan_revisi: 'Permintaan Surat Mahasiswa berhasil diproses dan diteruskan oleh Staff TU ke Sekprodi.'
                    });

                    return res.redirect('/tu/daftar-surat?success=' + encodeURIComponent('Permintaan Surat Mahasiswa berhasil diteruskan ke Sekprodi.'));
                }
            }

            // Otherwise, create a brand new letter
            const uuidSurat = 'surat-tu-' + uuidv4().substring(0, 8);
            const pengajuan = await SuratModel.createPengajuanByTu({
                uuid_surat: uuidSurat,
                mahasiswa_id: parseInt(mahasiswa_id, 10),
                jenis_surat_id: parseInt(jenis_surat_id, 10),
                perihal,
                data_dinamis: parsedDinamis,
                ttd_tu_path: ttdTuPath
            });

            await DisposisiModel.addLog({
                pengajuan_surat_id: pengajuan.id,
                actor_user_id: user.id,
                actor_role: 'staff_tu',
                status_sebelumnya: 'draft',
                status_sesudahnya: 'pending_sekprodi',
                catatan_revisi: 'Surat Permintaan diterbitkan oleh Staff TU dan diteruskan ke Sekprodi untuk verifikasi/validasi.'
            });

            return res.redirect('/tu/daftar-surat?success=' + encodeURIComponent('Surat Permintaan berhasil dibuat dan diteruskan ke Sekprodi.'));
        } catch (err) {
            console.error('TU processBuatSurat error:', err);
            return res.redirect('/tu/buat-surat?error=' + encodeURIComponent(err.message));
        }
    }

    static async renderEditSurat(req, res) {
        try {
            const { id } = req.params;
            const pengajuan = await SuratModel.getDetailById(id);
            if (!pengajuan) {
                return res.status(404).send('Pengajuan surat tidak ditemukan.');
            }

            const mahasiswaList = await MahasiswaModel.getAll();
            const jenisList = await SuratModel.getJenisSuratList();
            const dosenList = await DosenModel.getAll();

            let dinamisObj = {};
            try {
                dinamisObj = typeof pengajuan.data_dinamis === 'string' ? JSON.parse(pengajuan.data_dinamis) : (pengajuan.data_dinamis || {});
            } catch (e) {}

            return res.render('tu/edit_surat', {
                title: 'Form Edit Surat Administrasi (Staff TU)',
                user: req.session.user,
                pengajuan,
                dinamisObj,
                mahasiswaList,
                jenisList,
                dosenList,
                error: req.query.error || null,
                success: req.query.success || null
            });
        } catch (err) {
            console.error('TU renderEditSurat error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async processEditSurat(req, res) {
        try {
            const { id } = req.params;
            const { mahasiswa_id, jenis_surat_id, perihal, pembimbing_1_id, pembimbing_2_id, instansi_tujuan, durasi, catatan } = req.body;
            const fs = require('fs');
            const path = require('path');

            const pengajuan = await SuratModel.getDetailById(id);
            if (!pengajuan) {
                return res.status(404).send('Pengajuan surat tidak ditemukan.');
            }

            let ttdTuPath = null;
            if (req.file) {
                const uploadDir = path.join(__dirname, '../../public/uploads/signatures');
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }
                const filename = `ttd_tu_${Date.now()}_${req.file.originalname}`;
                fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);
                ttdTuPath = `/uploads/signatures/${filename}`;
            }

            const parsedDinamis = {
                pembimbing_1_id: pembimbing_1_id ? parseInt(pembimbing_1_id, 10) : null,
                pembimbing_2_id: pembimbing_2_id ? parseInt(pembimbing_2_id, 10) : null,
                instansi_tujuan: instansi_tujuan || '',
                durasi: durasi || '',
                catatan: catatan || ''
            };

            await SuratModel.updateSuratByTu(id, {
                mahasiswa_id: parseInt(mahasiswa_id, 10),
                jenis_surat_id: parseInt(jenis_surat_id, 10),
                perihal,
                data_dinamis: parsedDinamis,
                ttd_tu_path: ttdTuPath
            });

            await DisposisiModel.addLog({
                pengajuan_surat_id: id,
                actor_user_id: req.session.user.id,
                actor_role: 'staff_tu',
                status_sebelumnya: pengajuan.status,
                status_sesudahnya: pengajuan.status,
                catatan_revisi: 'Data Surat Administrasi berhasil diperbarui oleh Staff TU.'
            });

            return res.redirect('/tu/daftar-surat?success=' + encodeURIComponent('Data Surat berhasil diperbarui.'));
        } catch (err) {
            console.error('TU processEditSurat error:', err);
            return res.redirect(`/tu/edit-surat/${req.params.id}?error=` + encodeURIComponent(err.message));
        }
    }

    static async processDeleteSurat(req, res) {
        try {
            const { id } = req.params;
            const pengajuan = await SuratModel.getDetailById(id);
            if (!pengajuan) {
                return res.status(404).send('Pengajuan surat tidak ditemukan.');
            }

            await SuratModel.deleteSurat(id);
            return res.redirect('/tu/daftar-surat?success=' + encodeURIComponent('Surat berhasil dihapus dari sistem.'));
        } catch (err) {
            console.error('TU processDeleteSurat error:', err);
            return res.redirect('/tu/daftar-surat?error=' + encodeURIComponent('Gagal menghapus surat: ' + err.message));
        }
    }
}

module.exports = TuController;
