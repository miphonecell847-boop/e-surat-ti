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
    if (role === 'staff_tu') return res.redirect('/tu/dashboard');
    return res.redirect('/profile');
});

// 2. Public Document Verification (QR Code Scan Target)
router.get('/verify-doc/:uuid', PublicVerifyController.verifyDocument);

// 3. Mahasiswa Routes
router.get('/mahasiswa/dashboard', isAuthenticated, checkRole(['mahasiswa']), MahasiswaController.dashboard);
router.get('/mahasiswa/buat-surat', isAuthenticated, checkRole(['mahasiswa']), MahasiswaController.renderBuatSurat);
router.post('/mahasiswa/buat-surat', isAuthenticated, checkRole(['mahasiswa']), upload.single('file_lampiran'), MahasiswaController.submitSurat);
router.get('/mahasiswa/surat/:id', isAuthenticated, checkRole(['mahasiswa']), MahasiswaController.detailSurat);

// Mahasiswa: Pengajuan Judul TA
router.get('/mahasiswa/pengajuan-judul', isAuthenticated, checkRole(['mahasiswa']), JudulTaController.renderMahasiswaJudul);
router.post('/mahasiswa/pengajuan-judul', isAuthenticated, checkRole(['mahasiswa']), upload.single('file_proposal'), JudulTaController.processSubmitJudul);

// 4. Dosen Pembimbing Routes
router.get('/dosen/dashboard', isAuthenticated, checkRole(['dosen']), DosenController.dashboard);
router.get('/dosen/review/:id', isAuthenticated, checkRole(['dosen']), DosenController.renderReview);
router.post('/dosen/review/:id', isAuthenticated, checkRole(['dosen']), DosenController.processAction);

// Dosen: Konfirmasi Kesediaan Membimbing
router.get('/dosen/konfirmasi-bimbingan', isAuthenticated, checkRole(['dosen']), JudulTaController.renderDosenKonfirmasi);
router.post('/dosen/konfirmasi-bimbingan', isAuthenticated, checkRole(['dosen']), JudulTaController.processDosenKonfirmasi);

// 5. Sekprodi Routes
router.get('/sekprodi/dashboard', isAuthenticated, checkRole(['sekretaris_prodi']), SekprodiController.dashboard);
router.get('/sekprodi/plotting/:id', isAuthenticated, checkRole(['sekretaris_prodi']), SekprodiController.renderPlotting);
router.post('/sekprodi/plotting/:id', isAuthenticated, checkRole(['sekretaris_prodi']), SekprodiController.processPlottingAndVerify);

// Sekprodi: Validasi Judul TA
router.get('/sekprodi/verifikasi-judul', isAuthenticated, checkRole(['sekretaris_prodi']), JudulTaController.renderSekprodiVerifikasi);
router.post('/sekprodi/verifikasi-judul', isAuthenticated, checkRole(['sekretaris_prodi']), JudulTaController.processSekprodiVerifikasi);

// 6. Kaprodi Routes
router.get('/kaprodi/dashboard', isAuthenticated, checkRole(['kaprodi']), KaprodiController.dashboard);
router.get('/kaprodi/approval/:id', isAuthenticated, checkRole(['kaprodi']), KaprodiController.renderApproval);
router.post('/kaprodi/approval/:id', isAuthenticated, checkRole(['kaprodi']), KaprodiController.processApproval);

// Kaprodi: Otorisasi Keputusan Judul TA
router.get('/kaprodi/persetujuan-judul', isAuthenticated, checkRole(['kaprodi']), JudulTaController.renderKaprodiDecision);
router.post('/kaprodi/persetujuan-judul', isAuthenticated, checkRole(['kaprodi']), JudulTaController.processKaprodiDecision);

// 7. Staff TU Routes
router.get('/tu/dashboard', isAuthenticated, checkRole(['staff_tu']), TuController.dashboard);
router.get('/tu/penomoran/:id', isAuthenticated, checkRole(['staff_tu']), TuController.renderPenomoran);
router.post('/tu/penomoran/:id', isAuthenticated, checkRole(['staff_tu']), TuController.processPenomoranAndGeneratePdf);

// Staff TU: Verifikasi Judul TA
router.get('/tu/verifikasi-judul', isAuthenticated, checkRole(['staff_tu']), JudulTaController.renderTuVerifikasi);
router.post('/tu/verifikasi-judul', isAuthenticated, checkRole(['staff_tu']), JudulTaController.processTuVerifikasi);

module.exports = router;
