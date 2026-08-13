const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middlewares/authMiddleware');
const checkRole = require('../middlewares/rbacMiddleware');
const upload = require('../middlewares/uploadMiddleware');

const MahasiswaController = require('../controllers/MahasiswaController');
const DosenController = require('../controllers/DosenController');
const SekprodiController = require('../controllers/SekprodiController');
const KaprodiController = require('../controllers/KaprodiController');
const TuController = require('../controllers/TuController');
const PublicVerifyController = require('../controllers/PublicVerifyController');
const JudulTaController = require('../controllers/JudulTaController');
const AuthController = require('../controllers/AuthController');

// Profile Routes (GET & POST)
router.get('/profile', isAuthenticated, AuthController.renderProfile);
router.post('/profile', isAuthenticated, AuthController.processUpdateProfile);
router.get('/mahasiswa/profile', isAuthenticated, AuthController.renderProfile);
router.post('/mahasiswa/profile', isAuthenticated, AuthController.processUpdateProfile);

// 1. Root / Dashboard Dispatcher by Role (3 Roles: Mahasiswa, Dosen, Staff TU)
router.get('/dashboard', isAuthenticated, (req, res) => {
    const role = req.session.user.role;
    if (role === 'mahasiswa') return res.redirect('/mahasiswa/dashboard');
    if (role === 'dosen') return res.redirect('/dosen/dashboard');
    return res.redirect('/tu/dashboard');
});

// Admin & Legacy Route Aliases (Redirect cleanly to TU Dashboard)
router.get('/admin', isAuthenticated, (req, res) => res.redirect('/tu/dashboard'));
router.get('/admin/dashboard', isAuthenticated, (req, res) => res.redirect('/tu/dashboard'));
router.get('/sekprodi/dashboard', isAuthenticated, (req, res) => res.redirect('/tu/dashboard'));
router.get('/sekprodi/daftar-surat', isAuthenticated, (req, res) => res.redirect('/tu/daftar-surat'));
router.get('/sekprodi/verifikasi-judul', isAuthenticated, (req, res) => res.redirect('/tu/verifikasi-judul'));
router.get('/kaprodi/dashboard', isAuthenticated, (req, res) => res.redirect('/tu/dashboard'));
router.get('/kaprodi/daftar-surat', isAuthenticated, (req, res) => res.redirect('/tu/daftar-surat'));
router.get('/kaprodi/persetujuan-judul', isAuthenticated, (req, res) => res.redirect('/tu/verifikasi-judul'));

// 2. Public Document Verification & Live PDF Preview & Detail Status Disposisi
router.get('/verify-doc/:uuid', PublicVerifyController.verifyDocument);
router.get('/surat/preview/:id', isAuthenticated, PublicVerifyController.previewSuratPdf);
router.get('/surat/detail/:id', isAuthenticated, MahasiswaController.detailSurat);
router.get('/mahasiswa/surat/:id', isAuthenticated, MahasiswaController.detailSurat);

// 3. Mahasiswa Routes
router.get('/mahasiswa/dashboard', isAuthenticated, checkRole(['mahasiswa']), MahasiswaController.dashboard);
router.get('/mahasiswa/daftar-surat', isAuthenticated, checkRole(['mahasiswa']), MahasiswaController.renderDaftarSurat);
router.get('/mahasiswa/buat-surat', isAuthenticated, checkRole(['mahasiswa']), MahasiswaController.renderBuatSurat);
router.post('/mahasiswa/buat-surat', isAuthenticated, checkRole(['mahasiswa']), upload.single('file_lampiran'), MahasiswaController.submitSurat);
router.post('/mahasiswa/surat/hapus/:id', isAuthenticated, checkRole(['mahasiswa']), MahasiswaController.deleteSurat);

// Mahasiswa: Pengajuan Judul TA
router.get('/mahasiswa/pengajuan-judul', isAuthenticated, checkRole(['mahasiswa']), JudulTaController.renderMahasiswaJudul);
router.post('/mahasiswa/pengajuan-judul', isAuthenticated, checkRole(['mahasiswa']), upload.single('file_proposal'), JudulTaController.processSubmitJudul);

// Mahasiswa: Jadwal Ujian & Seminar TA
router.get('/mahasiswa/jadwal-ujian', isAuthenticated, checkRole(['mahasiswa', 'dosen', 'staff_tu']), MahasiswaController.renderJadwalUjian);

// 4. Dosen Pembimbing Routes
router.get('/dosen/dashboard', isAuthenticated, checkRole(['dosen']), DosenController.dashboard);
router.get('/dosen/review/:id', isAuthenticated, checkRole(['dosen']), DosenController.renderReview);
router.post('/dosen/review/:id', isAuthenticated, checkRole(['dosen']), DosenController.processAction);
router.post('/dosen/update-profile', isAuthenticated, checkRole(['dosen', 'kaprodi', 'sekretaris_prodi']), DosenController.updateProfile);

// Dosen: Konfirmasi Kesediaan Membimbing
router.get('/dosen/konfirmasi-bimbingan', isAuthenticated, checkRole(['dosen']), JudulTaController.renderDosenKonfirmasi);
router.post('/dosen/konfirmasi-bimbingan', isAuthenticated, checkRole(['dosen']), JudulTaController.processDosenKonfirmasi);

// 7. Staff TU Routes
router.get('/tu/dashboard', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.dashboard);
router.get('/tu/daftar-surat', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.renderDaftarSurat);
router.get('/tu/buat-surat', isAuthenticated, (req, res) => res.redirect('/tu/daftar-surat'));
router.post('/tu/upload-ttd-tu', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'sekretaris_prodi', 'sekprodi', 'kaprodi', 'admin']), upload.single('ttd_tu'), TuController.processUploadTtdTu);
router.post('/tu/upload-ttd-kaprodi', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'sekretaris_prodi', 'sekprodi', 'kaprodi', 'admin']), upload.single('ttd_kaprodi'), TuController.processUploadTtdKaprodi);
router.post('/tu/upload-ttd-dekan', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'sekretaris_prodi', 'sekprodi', 'kaprodi', 'admin']), upload.single('ttd_dekan'), TuController.processUploadTtdDekan);
router.get('/tu/edit-surat/:id', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.renderEditSurat);
router.post('/tu/edit-surat/:id', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), upload.single('ttd_tu'), TuController.processEditSurat);
router.post('/tu/delete-surat/:id', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.processDeleteSurat);
router.get('/tu/penomoran/:id', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.renderPenomoran);
router.post('/tu/penomoran/:id', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.processPenomoranAndGeneratePdf);
router.get('/tu/kirim-wa-manual/:id', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'admin', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.processKirimWaManual);
router.post('/tu/kirim-wa-manual/:id', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'admin', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.processKirimWaManual);

// Staff TU: Verifikasi Judul TA
router.get('/tu/verifikasi-judul', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), JudulTaController.renderTuVerifikasi);
router.post('/tu/verifikasi-judul', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), JudulTaController.processTuVerifikasi);
router.post('/tu/delete-judul/:id', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'admin', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), JudulTaController.processDeleteProposal);

// Staff TU: Manajemen & Validasi Akun Pengguna
router.get('/tu/kelola-akun', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'admin', 'sekretaris_prodi', 'sekprodi', 'kaprodi', 'mahasiswa', 'dosen']), TuController.renderKelolaAkun);
router.post('/tu/approve-user/:id', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'admin', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.processApproveUser);
router.post('/tu/reject-user/:id', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'admin', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.processRejectUser);
router.post('/tu/buat-akun-dosen', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'admin', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.processBuatAkunDosen);
router.post('/tu/buat-akun-mahasiswa', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'admin', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.processBuatAkunMahasiswa);
router.post('/tu/hapus-user/:id', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'admin', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.processHapusUser);
router.post('/tu/edit-user/:id', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'admin', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.processEditUser);

module.exports = router;
