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
}

module.exports = PublicVerifyController;
