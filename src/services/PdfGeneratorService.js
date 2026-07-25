const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

class PdfGeneratorService {
    /**
     * Generate Surat PDF Buffer using PDFKit with Official UNIDAYAN Kop
     */
    static async generateSuratPdf({ pengajuan, mahasiswa, jenisSurat, kaprodi, verifyUrl, signatureHash }) {
        return new Promise(async (resolve, reject) => {
            try {
                const doc = new PDFDocument({ size: 'A4', margin: 40 });
                const buffers = [];

                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfBuffer = Buffer.concat(buffers);
                    resolve(pdfBuffer);
                });

                // Generate QR Code Buffer
                const qrBuffer = await QRCode.toBuffer(verifyUrl, { width: 100, margin: 1 });

                // --- 1. KOP SURAT UNIDAYAN ---
                doc.fontSize(11).font('Helvetica-Bold').text('UNIVERSITAS DAYANU IKHSANUDDIN', { align: 'center' });
                doc.fontSize(13).font('Helvetica-Bold').text('FAKULTAS TEKNIK - PROGRAM STUDI TEKNIK INFORMATIKA', { align: 'center' });
                doc.fontSize(9).font('Helvetica-Oblique').text('Jl. Sultan Dayanu Ikhsanuddin No. 109, Baubau, Sulawesi Tenggara', { align: 'center' });
                doc.fontSize(8).font('Helvetica').text('Website: www.unidayan.ac.id | Email: info@unidayan.ac.id', { align: 'center' });

                // Double Line Under Kop
                const startY = doc.y + 5;
                doc.moveTo(40, startY).lineTo(555, startY).lineWidth(2).stroke('#000000');
                doc.moveTo(40, startY + 3).lineTo(555, startY + 3).lineWidth(0.5).stroke('#000000');

                doc.moveDown(1.5);

                // --- 2. JUDUL SURAT & NOMOR ---
                doc.fontSize(13).font('Helvetica-Bold').text(jenisSurat.nama_surat.toUpperCase(), { align: 'center', underline: true });
                doc.fontSize(10).font('Helvetica').text(`Nomor: ${pengajuan.nomor_surat || 'B/---/UNIDAYAN/TI/TA/2026'}`, { align: 'center' });

                doc.moveDown(1.5);

                // --- 3. ISI SURAT ---
                doc.fontSize(11).font('Helvetica').text('Ketua Program Studi Teknik Informatika Universitas Dayanu Ikhsanuddin menerangkan bahwa mahasiswa berikut:');
                doc.moveDown(0.5);

                // Table / Field Details
                const labelX = 60;
                const valueX = 200;
                let currentY = doc.y;

                const addRow = (label, val) => {
                    doc.font('Helvetica-Bold').text(label, labelX, currentY);
                    doc.font('Helvetica').text(`:  ${val || '-'}`, valueX, currentY);
                    currentY += 18;
                };

                addRow('Nama Mahasiswa', mahasiswa.nama_lengkap);
                addRow('NIM', mahasiswa.nim);
                addRow('Angkatan', mahasiswa.angkatan ? mahasiswa.angkatan.toString() : '-');
                addRow('Perihal', pengajuan.perihal);
                if (mahasiswa.judul_ta) {
                    addRow('Judul Skripsi / TA', mahasiswa.judul_ta);
                }

                // Data Dinamis Parse
                let dinamis = {};
                try {
                    dinamis = typeof pengajuan.data_dinamis === 'string' ? JSON.parse(pengajuan.data_dinamis) : pengajuan.data_dinamis;
                } catch (e) {}

                if (dinamis && Object.keys(dinamis).length > 0) {
                    Object.entries(dinamis).forEach(([k, v]) => {
                        const formattedKey = k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        addRow(formattedKey, v);
                    });
                }

                doc.y = currentY + 10;
                doc.font('Helvetica').text('Telah memenuhi seluruh kualifikasi dan tahapan verifikasi administrasi Tugas Akhir pada Program Studi Teknik Informatika UNIDAYAN.', { align: 'justify' });

                doc.moveDown(2);

                // --- 4. BLOK TANDA TANGAN DIGITAL (E-SIGNATURE) ---
                const ttdBoxY = doc.y;
                doc.fontSize(10).font('Helvetica').text('Disetujui secara Digital oleh,', 340, ttdBoxY);
                doc.text('Ketua Program Studi Teknik Informatika', 340, ttdBoxY + 14);

                // Embed QR Code
                doc.image(qrBuffer, 380, ttdBoxY + 32, { width: 80, height: 80 });

                doc.fontSize(10).font('Helvetica-Bold').text(kaprodi.nama_dosen || 'Dr. Eng. Nama Kaprodi, M.T.', 340, ttdBoxY + 118);
                doc.fontSize(9).font('Helvetica').text(`NIP/NIDN. ${kaprodi.nip_nidn || '198501012010121001'}`, 340, ttdBoxY + 132);

                // --- 5. FOOTER VERIFIKASI DIGITAL ---
                const footerY = 750;
                doc.moveTo(40, footerY).lineTo(555, footerY).lineWidth(0.5).stroke('#888888');
                doc.fontSize(8).font('Helvetica-Oblique').fillColor('#444444')
                    .text('Dokumen Berita Acara / Surat ini telah ditandatangani secara digital menggunakan E-Signature E-Surat UNIDAYAN.', 40, footerY + 5, { align: 'center' });
                doc.text(`Hash Kriptografi SHA-256: ${signatureHash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca4'}`, 40, footerY + 16, { align: 'center' });
                doc.text(`Verifikasi Keaslian Dokumen: ${verifyUrl}`, 40, footerY + 27, { align: 'center' });

                doc.end();
            } catch (err) {
                console.error('Error generating PDF:', err);
                reject(err);
            }
        });
    }
}

module.exports = PdfGeneratorService;
