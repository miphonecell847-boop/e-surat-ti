const { v4: uuidv4 } = require('uuid');
const SuratModel = require('../models/SuratModel');
const GDriveDocModel = require('../models/GDriveDocModel');
const DisposisiModel = require('../models/DisposisiModel');
const MahasiswaModel = require('../models/MahasiswaModel');
const PlottingModel = require('../models/PlottingModel');
const JadwalUjianModel = require('../models/JadwalUjianModel');
const gdriveService = require('../services/GDriveStorageService');
const appConfig = require('../../config/app');

class MahasiswaController {
    static async dashboard(req, res) {
        try {
            const user = req.session.user;
            let mhs = await MahasiswaModel.findByUserId(user.id);
            if (!mhs) {
                const allMhs = await MahasiswaModel.getAll();
                mhs = (allMhs && allMhs.length > 0) ? allMhs[0] : { id: 1, nim: '21081010001', nama_lengkap: user.username, angkatan: 2021 };
            }

            const listSurat = await SuratModel.getByMahasiswaId(mhs.id);
            const plotting = await PlottingModel.getByMahasiswaId(mhs.id);

            return res.render('mahasiswa/dashboard', {
                title: 'Dashboard Mahasiswa - E-Surat TA',
                user,
                mhs,
                listSurat,
                plotting
            });
        } catch (err) {
            console.error('Mahasiswa dashboard error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async renderDaftarSurat(req, res) {
        try {
            const user = req.session.user;
            let mhs = await MahasiswaModel.findByUserId(user.id);
            if (!mhs) {
                const allMhs = await MahasiswaModel.getAll();
                mhs = (allMhs && allMhs.length > 0) ? allMhs[0] : { id: 1, nim: '22650025', nama_lengkap: user.username, angkatan: 2022 };
            }

            const listSurat = await SuratModel.getByMahasiswaId(mhs.id);

            return res.render('mahasiswa/daftar_surat', {
                title: 'Daftar Surat & SK Saya - E-Surat TA',
                user,
                mhs,
                listSurat
            });
        } catch (err) {
            console.error('Mahasiswa daftar surat error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async renderBuatSurat(req, res) {
        try {
            const jenisList = await SuratModel.getJenisSuratList();
            const user = req.session.user;
            const mhs = await MahasiswaModel.findByUserId(user.id);

            return res.render('mahasiswa/buat_surat', {
                title: 'Pengajuan Surat Baru',
                user,
                mhs,
                jenisList,
                error: null
            });
        } catch (err) {
            console.error('Buat surat render error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async submitSurat(req, res) {
        try {
            const user = req.session.user;
            const mhs = await MahasiswaModel.findByUserId(user.id);
            if (!mhs) {
                return res.status(400).send('Profil mahasiswa tidak valid.');
            }

            const { jenis_surat_id, perihal, ...dataDinamis } = req.body;
            const fileUpload = req.file;
            const uuidSurat = uuidv4();

            // 1. Simpan Transaksi Pengajuan Surat di DB
            const pengajuan = await SuratModel.createPengajuan({
                uuid_surat: uuidSurat,
                mahasiswa_id: mhs.id,
                jenis_surat_id: parseInt(jenis_surat_id, 10),
                perihal,
                data_dinamis: dataDinamis,
                status: 'pending_pembimbing_1'
            });

            // 2. Direct Stream Upload ke Google Drive (Subfolder Jenis Surat & Nama Pemohon)
            if (fileUpload) {
                const ROOT_FOLDER = appConfig.gdriveRootFolderId || '1jjZFf0vgrWso96dfHe2IMzf2HTzybq_1';
                const jenisSuratObj = await SuratModel.getJenisSuratById(jenis_surat_id);
                const jenisFolderName = jenisSuratObj ? jenisSuratObj.nama_surat.replace(/[\/\\:*?"<>|]/g, '_') : 'Surat_Administrasi';
                const jenisFolderId = await gdriveService.getOrCreateFolder(jenisFolderName, ROOT_FOLDER);

                const mhsFolderName = `${mhs.nim}_${mhs.nama_lengkap.replace(/\s+/g, '_')}`;
                const mhsFolderId = await gdriveService.getOrCreateFolder(mhsFolderName, jenisFolderId);

                const driveResult = await gdriveService.uploadFileStream(
                    fileUpload.buffer,
                    fileUpload.originalname,
                    fileUpload.mimetype,
                    mhsFolderId
                );

                // 3. Simpan Metadata GDrive ke SQL
                await GDriveDocModel.saveMetadata({
                    pengajuan_surat_id: pengajuan.id,
                    gdrive_file_id: driveResult.id,
                    gdrive_folder_id: lampiranFolderId,
                    nama_file_original: fileUpload.originalname,
                    kategori_berkas: 'syarat_lampiran',
                    mime_type: fileUpload.mimetype,
                    file_size_bytes: driveResult.size || fileUpload.size,
                    web_view_link: driveResult.webViewLink,
                    web_content_link: driveResult.webContentLink
                });
            }

            // 4. Catat Log Disposisi
            await DisposisiModel.addLog({
                pengajuan_surat_id: pengajuan.id,
                actor_user_id: user.id,
                actor_role: 'mahasiswa',
                status_sebelumnya: 'draft',
                status_sesudahnya: 'pending_pembimbing_1',
                catatan_revisi: 'Pengajuan surat baru diajukan oleh Mahasiswa.'
            });

            return res.redirect(`/mahasiswa/surat/${pengajuan.id}`);
        } catch (err) {
            console.error('Submit surat error:', err);
            const jenisList = await SuratModel.getJenisSuratList();
            return res.render('mahasiswa/buat_surat', {
                title: 'Pengajuan Surat Baru',
                user: req.session.user,
                mhs: await MahasiswaModel.findByUserId(req.session.user.id),
                jenisList,
                error: 'Gagal mengajukan surat: ' + err.message
            });
        }
    }

    static async detailSurat(req, res) {
        try {
            const { id } = req.params;
            const pengajuan = await SuratModel.getDetailById(id);
            if (!pengajuan) {
                return res.status(404).send('Pengajuan surat tidak ditemukan.');
            }

            const docs = await GDriveDocModel.getBySuratId(id);
            const riwayat = await DisposisiModel.getBySuratId(id);

            return res.render('mahasiswa/detail_surat', {
                title: 'Detail Pengajuan Surat',
                user: req.session.user,
                pengajuan,
                docs,
                riwayat
            });
        } catch (err) {
            console.error('Detail surat error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async renderJadwalUjian(req, res) {
        try {
            const user = req.session.user;
            let mhs = await MahasiswaModel.findByUserId(user.id);
            if (!mhs) {
                const allMhs = await MahasiswaModel.getAll();
                mhs = (allMhs && allMhs.length > 0) ? allMhs[0] : { id: 1, nim: '21081010001', nama_lengkap: user.username, angkatan: 2021 };
            }

            const listJadwal = await JadwalUjianModel.getByMahasiswaId(mhs.id);

            return res.render('mahasiswa/jadwal_ujian', {
                title: 'Jadwal Ujian & Seminar TA',
                user: req.session.user,
                mhs,
                listJadwal
            });
        } catch (err) {
            console.error('Mahasiswa renderJadwalUjian error:', err);
            return res.status(500).send('Internal Server Error: ' + err.message);
        }
    }
}

module.exports = MahasiswaController;
