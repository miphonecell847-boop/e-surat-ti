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

// 1. Root / Dashboard Dispatcher by Role
router.get('/dashboard', isAuthenticated, (req, res) => {
    const role = req.session.user.role;
    if (role === 'mahasiswa') return res.redirect('/mahasiswa/dashboard');
    if (role === 'dosen') return res.redirect('/dosen/dashboard');
    if (role === 'sekretaris_prodi') return res.redirect('/sekprodi/dashboard');
    if (role === 'kaprodi') return res.redirect('/kaprodi/dashboard');
    if (role === 'staff_tu' || role === 'admin') return res.redirect('/tu/dashboard');
    return res.redirect('/profile');
});

// Admin & Legacy Route Aliases (Prevent 404)
router.get('/admin', isAuthenticated, (req, res) => res.redirect('/tu/dashboard'));
router.get('/admin/dashboard', isAuthenticated, (req, res) => res.redirect('/tu/dashboard'));
router.get('/sekprodi/ploting', isAuthenticated, (req, res) => res.redirect('/sekprodi/dashboard'));
router.get('/kaprodi/approval', isAuthenticated, (req, res) => res.redirect('/kaprodi/dashboard'));

// 2. Public Document Verification & Live PDF Preview
router.get('/verify-doc/:uuid', PublicVerifyController.verifyDocument);
router.get('/surat/preview/:id', isAuthenticated, PublicVerifyController.previewSuratPdf);

// 3. Mahasiswa Routes
router.get('/mahasiswa/dashboard', isAuthenticated, checkRole(['mahasiswa', 'mhs', 'sekretaris_prodi', 'sekprodi', 'kaprodi', 'staff_tu', 'admin']), MahasiswaController.dashboard);
router.get('/mahasiswa/buat-surat', isAuthenticated, checkRole(['mahasiswa', 'mhs', 'staff_tu', 'sekretaris_prodi', 'sekprodi', 'kaprodi', 'admin']), MahasiswaController.renderBuatSurat);
router.post('/mahasiswa/buat-surat', isAuthenticated, checkRole(['mahasiswa', 'mhs', 'staff_tu', 'sekretaris_prodi', 'sekprodi', 'kaprodi', 'admin']), upload.single('file_lampiran'), MahasiswaController.submitSurat);
router.get('/mahasiswa/surat/:id', isAuthenticated, checkRole(['mahasiswa', 'mhs', 'sekretaris_prodi', 'sekprodi', 'kaprodi', 'staff_tu', 'admin']), MahasiswaController.detailSurat);

// Mahasiswa: Pengajuan Judul TA
router.get('/mahasiswa/pengajuan-judul', isAuthenticated, checkRole(['mahasiswa', 'mhs', 'sekretaris_prodi', 'sekprodi', 'kaprodi', 'staff_tu', 'admin']), JudulTaController.renderMahasiswaJudul);
router.post('/mahasiswa/pengajuan-judul', isAuthenticated, checkRole(['mahasiswa', 'mhs', 'sekretaris_prodi', 'sekprodi', 'kaprodi', 'staff_tu', 'admin']), upload.single('file_proposal'), JudulTaController.processSubmitJudul);

// 4. Dosen Pembimbing Routes
router.get('/dosen/dashboard', isAuthenticated, checkRole(['dosen']), DosenController.dashboard);
router.get('/dosen/review/:id', isAuthenticated, checkRole(['dosen']), DosenController.renderReview);
router.post('/dosen/review/:id', isAuthenticated, checkRole(['dosen']), DosenController.processAction);

// Dosen: Konfirmasi Kesediaan Membimbing
router.get('/dosen/konfirmasi-bimbingan', isAuthenticated, checkRole(['dosen']), JudulTaController.renderDosenKonfirmasi);
router.post('/dosen/konfirmasi-bimbingan', isAuthenticated, checkRole(['dosen']), JudulTaController.processDosenKonfirmasi);

// 5. Sekprodi Routes
router.get('/sekprodi/dashboard', isAuthenticated, checkRole(['sekretaris_prodi', 'sekprodi', 'kaprodi', 'staff_tu']), SekprodiController.dashboard);
router.get('/sekprodi/daftar-surat', isAuthenticated, checkRole(['sekretaris_prodi', 'sekprodi', 'kaprodi', 'staff_tu']), SekprodiController.renderDaftarSurat);
router.get('/sekprodi/verifikasi-surat/:id', isAuthenticated, checkRole(['sekretaris_prodi', 'sekprodi', 'kaprodi', 'staff_tu']), SekprodiController.renderVerifikasiSurat);
router.post('/sekprodi/verifikasi-surat/:id', isAuthenticated, checkRole(['sekretaris_prodi', 'sekprodi', 'kaprodi', 'staff_tu']), upload.single('ttd_sekprodi'), SekprodiController.processVerifikasiSurat);
router.get('/sekprodi/plotting/:id', isAuthenticated, checkRole(['sekretaris_prodi', 'sekprodi', 'kaprodi']), SekprodiController.renderPlotting);
router.post('/sekprodi/plotting/:id', isAuthenticated, checkRole(['sekretaris_prodi', 'sekprodi', 'kaprodi']), upload.single('ttd_sekprodi'), SekprodiController.processPlottingAndVerify);

// Sekprodi: Validasi Judul TA
router.get('/sekprodi/verifikasi-judul', isAuthenticated, checkRole(['sekretaris_prodi', 'sekprodi', 'kaprodi']), JudulTaController.renderSekprodiVerifikasi);
router.post('/sekprodi/verifikasi-judul', isAuthenticated, checkRole(['sekretaris_prodi', 'sekprodi', 'kaprodi']), JudulTaController.processSekprodiVerifikasi);

// 6. Kaprodi Routes
router.get('/kaprodi/dashboard', isAuthenticated, checkRole(['kaprodi', 'sekretaris_prodi', 'sekprodi', 'staff_tu']), KaprodiController.dashboard);
router.get('/kaprodi/daftar-surat', isAuthenticated, checkRole(['kaprodi', 'sekretaris_prodi', 'sekprodi', 'staff_tu']), KaprodiController.renderDaftarSurat);
router.get('/kaprodi/approval/:id', isAuthenticated, checkRole(['kaprodi', 'sekretaris_prodi', 'sekprodi', 'staff_tu']), KaprodiController.renderApproval);
router.post('/kaprodi/approval/:id', isAuthenticated, checkRole(['kaprodi', 'sekretaris_prodi', 'sekprodi']), upload.single('ttd_kaprodi'), KaprodiController.processApproval);

// Kaprodi: Otorisasi Keputusan Judul TA
router.get('/kaprodi/persetujuan-judul', isAuthenticated, checkRole(['kaprodi', 'sekretaris_prodi', 'sekprodi']), JudulTaController.renderKaprodiDecision);
router.post('/kaprodi/persetujuan-judul', isAuthenticated, checkRole(['kaprodi', 'sekretaris_prodi', 'sekprodi']), JudulTaController.processKaprodiDecision);

// 7. Staff TU Routes
router.get('/tu/dashboard', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.dashboard);
router.get('/tu/daftar-surat', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.renderDaftarSurat);
router.get('/tu/buat-surat', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.renderBuatSurat);
router.post('/tu/buat-surat', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), upload.single('ttd_tu'), TuController.processBuatSurat);
router.get('/tu/edit-surat/:id', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.renderEditSurat);
router.post('/tu/edit-surat/:id', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), upload.single('ttd_tu'), TuController.processEditSurat);
router.post('/tu/delete-surat/:id', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.processDeleteSurat);
router.get('/tu/penomoran/:id', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.renderPenomoran);
router.post('/tu/penomoran/:id', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.processPenomoranAndGeneratePdf);

// Staff TU: Verifikasi Judul TA
router.get('/tu/verifikasi-judul', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), JudulTaController.renderTuVerifikasi);
router.post('/tu/verifikasi-judul', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), JudulTaController.processTuVerifikasi);

// Staff TU: Manajemen & Validasi Akun Pengguna
router.get('/tu/kelola-akun', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'admin', 'sekretaris_prodi', 'sekprodi', 'kaprodi', 'mahasiswa', 'dosen']), TuController.renderKelolaAkun);
router.post('/tu/approve-user/:id', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'admin', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.processApproveUser);
router.post('/tu/reject-user/:id', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'admin', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.processRejectUser);
router.post('/tu/buat-akun-dosen', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'admin', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.processBuatAkunDosen);
router.post('/tu/buat-akun-mahasiswa', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'admin', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.processBuatAkunMahasiswa);
router.post('/tu/hapus-user/:id', isAuthenticated, checkRole(['staff_tu', 'stafftu', 'admin', 'sekretaris_prodi', 'sekprodi', 'kaprodi']), TuController.processHapusUser);

module.exports = router;
