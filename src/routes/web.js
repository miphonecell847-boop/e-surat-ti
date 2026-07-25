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

// 4. Dosen Pembimbing Routes
router.get('/dosen/dashboard', isAuthenticated, checkRole(['dosen']), DosenController.dashboard);
router.get('/dosen/review/:id', isAuthenticated, checkRole(['dosen']), DosenController.renderReview);
router.post('/dosen/review/:id', isAuthenticated, checkRole(['dosen']), DosenController.processAction);

// 5. Sekprodi Routes
router.get('/sekprodi/dashboard', isAuthenticated, checkRole(['sekretaris_prodi']), SekprodiController.dashboard);
router.get('/sekprodi/plotting/:id', isAuthenticated, checkRole(['sekretaris_prodi']), SekprodiController.renderPlotting);
router.post('/sekprodi/plotting/:id', isAuthenticated, checkRole(['sekretaris_prodi']), SekprodiController.processPlottingAndVerify);

// 6. Kaprodi Routes
router.get('/kaprodi/dashboard', isAuthenticated, checkRole(['kaprodi']), KaprodiController.dashboard);
router.get('/kaprodi/approval/:id', isAuthenticated, checkRole(['kaprodi']), KaprodiController.renderApproval);
router.post('/kaprodi/approval/:id', isAuthenticated, checkRole(['kaprodi']), KaprodiController.processApproval);

// 7. Staff TU Routes
router.get('/tu/dashboard', isAuthenticated, checkRole(['staff_tu']), TuController.dashboard);
router.get('/tu/penomoran/:id', isAuthenticated, checkRole(['staff_tu']), TuController.renderPenomoran);
router.post('/tu/penomoran/:id', isAuthenticated, checkRole(['staff_tu']), TuController.processPenomoranAndGeneratePdf);

module.exports = router;
