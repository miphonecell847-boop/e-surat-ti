const SuratModel = require('../models/SuratModel');
const GDriveDocModel = require('../models/GDriveDocModel');
const DisposisiModel = require('../models/DisposisiModel');
const PlottingModel = require('../models/PlottingModel');

class PublicVerifyController {
    static async verifyDocument(req, res) {
        try {
            const { uuid } = req.params;
            const pengajuan = await SuratModel.getDetailByUuid(uuid);

            if (!pengajuan) {
                return res.render('verify', {
                    title: 'Verifikasi Dokumen - Tidak Ditemukan',
                    isValid: false,
                    pengajuan: null,
                    docs: [],
                    plotting: null,
                    layout: false
                });
            }

            const docs = await GDriveDocModel.getBySuratId(pengajuan.id);
            const plotting = await PlottingModel.getByMahasiswaId(pengajuan.mahasiswa_id);
            const finalPdfDoc = docs.find(d => d.kategori_berkas === 'surat_final_pdf');

            return res.render('verify', {
                title: `Verifikasi Dokumen - ${pengajuan.nomor_surat || 'E-Surat TA'}`,
                isValid: pengajuan.status === 'selesai' || pengajuan.status === 'pending_tu',
                pengajuan,
                finalPdfDoc,
                plotting,
                layout: false
            });
        } catch (err) {
            console.error('Public verify error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async previewSuratPdf(req, res) {
        try {
            const { id } = req.params;
            const MahasiswaModel = require('../models/MahasiswaModel');
            const DosenModel = require('../models/DosenModel');
            const PdfGeneratorService = require('../services/PdfGeneratorService');
            const appConfig = require('../../config/app');

            const pengajuan = await SuratModel.getDetailById(id);
            if (!pengajuan) {
                return res.status(404).send('Pengajuan surat tidak ditemukan.');
            }

            const mhs = await MahasiswaModel.findById(pengajuan.mahasiswa_id);
            const kaprodiDosen = await DosenModel.getDosenKaprodi ? await DosenModel.getDosenKaprodi() : { nama_dosen: 'Prof. Dr. RASMUIN, S.Pd., M.Pd.', nip_nidn: '196812311994031012' };
            const verifyUrl = `${appConfig.baseUrl}/verify-doc/${pengajuan.uuid_surat}`;

            const pdfBuffer = await PdfGeneratorService.generateSuratPdf({
                pengajuan,
                mahasiswa: mhs,
                jenisSurat: { nama_surat: pengajuan.nama_surat },
                kaprodi: kaprodiDosen,
                verifyUrl,
                signatureHash: pengajuan.qr_signature_hash
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="preview_${pengajuan.uuid_surat}.pdf"`);
            return res.send(pdfBuffer);
        } catch (err) {
            console.error('Error previewSuratPdf:', err);
            return res.status(500).send('Gagal membuat preview PDF: ' + err.message);
        }
    }
}

module.exports = PublicVerifyController;
