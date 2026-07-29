const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const DosenModel = require('../models/DosenModel');

class PdfGeneratorService {
    /**
     * Format Tanggal Bahasa Indonesia (Contoh: 6 Februari 2026)
     */
    static formatDateIndonesian(dateObj = new Date()) {
        const months = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        const day = dateObj.getDate();
        const month = months[dateObj.getMonth()];
        const year = dateObj.getFullYear();
        return `${day} ${month} ${year}`;
    }

    static generateSuratPdf(opts) {
        const { pengajuan } = opts || {};
        const kode = pengajuan ? (pengajuan.kode_surat || '') : '';
        const nama = pengajuan ? (pengajuan.nama_surat || '').toLowerCase() : '';

        if (kode.includes('SK-PEMBIMBING') || nama.includes('pembimbing') || nama.includes('sk pembimbing')) {
            return this.generateSkPembimbingPdf(opts);
        }
        if (kode.includes('SK-PENGUJI') || nama.includes('penguji') || nama.includes('sk penguji')) {
            return this.generateSkPengujiPdf(opts);
        }

        return this.generateSuratIzinPenelitianPdf(opts);
    }

    /**
     * PDF Template Resmi SK Dekan UNIDAYAN: Penetapan Dosen Pembimbing TA
     */
    static generateSkPembimbingPdf({ pengajuan, mahasiswa, kaprodi, verifyUrl, signatureHash }) {
        return new Promise(async (resolve, reject) => {
            try {
                const doc = new PDFDocument({ size: 'A4', margin: 40 });
                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => resolve(Buffer.concat(buffers)));

                const qrBuffer = await QRCode.toBuffer(verifyUrl, {
                    errorCorrectionLevel: 'H',
                    margin: 1,
                    width: 85
                });

                // 1. KOP SURAT UNIDAYAN
                const logoPath = path.join(__dirname, '../../public/images/logo-unidayan.png');
                if (fs.existsSync(logoPath)) {
                    doc.image(logoPath, 40, 36, { width: 62 });
                }

                doc.fontSize(12).font('Helvetica-Bold').text('UNIVERSITAS DAYANU IKHSANUDDIN', 110, 35, { align: 'center' });
                doc.fontSize(14).font('Helvetica-Bold').text('FAKULTAS TEKNIK', 110, 50, { align: 'center' });
                doc.fontSize(8.5).font('Helvetica').text('Jl. Sultan Dayanu Ikhsanuddin No. 124 Baubau Telp (0402) 2821327, Fax(0402) 2826682 Baubau 93724', 110, 68, { align: 'center' });

                // Kop Line
                doc.moveTo(40, 82).lineTo(555, 82).lineWidth(2).stroke('#000000');
                doc.moveTo(40, 85).lineTo(555, 85).lineWidth(0.8).stroke('#000000');

                // 2. JUDUL SURAT KEPUTUSAN
                doc.y = 95;
                doc.fontSize(11).font('Helvetica-Bold').text('SURAT KEPUTUSAN', 40, doc.y, { align: 'center' });
                doc.fontSize(10.5).font('Helvetica-Bold').text('DEKAN FAKULTAS TEKNIK UNIVERSITAS DAYANU IKHSANUDDIN', 40, doc.y + 2, { align: 'center' });

                const nomorResmi = pengajuan.nomor_surat ? pengajuan.nomor_surat : '005/Q.18/FT-UND/II/2026';
                doc.fontSize(10).font('Helvetica').text(`NOMOR : ${nomorResmi}`, 40, doc.y + 2, { align: 'center' });

                doc.moveDown(0.4);
                doc.fontSize(10).font('Helvetica-Bold').text('TENTANG', { align: 'center' });
                doc.fontSize(10.5).font('Helvetica-Bold').text('PENETAPAN PEMBIMBING TUGAS AKHIR MAHASISWA PROGRAM STRATA SATU', { align: 'center' });

                const namaMhs = (mahasiswa && mahasiswa.nama_lengkap) ? mahasiswa.nama_lengkap.toUpperCase() : (pengajuan.mhs_nama ? pengajuan.mhs_nama.toUpperCase() : 'MUHAMMAD FARIS PRATAMA');
                const nimMhs = (mahasiswa && mahasiswa.nim) ? mahasiswa.nim : (pengajuan.mhs_nim ? pengajuan.mhs_nim : '22650025');

                doc.fontSize(10).font('Helvetica-Bold').text(`A.N : ${namaMhs}  NOMOR INDUK : ${nimMhs}`, { align: 'center' });
                doc.fontSize(10).font('Helvetica-Bold').text('PROGRAM STUDI TEKNIK INFORMATIKA', { align: 'center' });

                doc.moveDown(0.5);
                doc.fontSize(9.5).font('Helvetica-Oblique').text('Dengan Rahmat Tuhan Yang Maha Esa', { align: 'center' });
                doc.fontSize(10).font('Helvetica-Bold').text('DEKAN FAKULTAS TEKNIK UNIVERSITAS DAYANU IKHSANUDDIN', { align: 'center' });

                doc.moveDown(0.5);

                let dataDinamis = {};
                try {
                    dataDinamis = typeof pengajuan.data_dinamis === 'string' ? JSON.parse(pengajuan.data_dinamis) : pengajuan.data_dinamis;
                } catch (e) {}

                let p1Name = 'HELSON HAMID, S.T., M.T.';
                let p2Name = 'FITHRIAH MUSADAT, S.Si., M.T.';
                if (dataDinamis && dataDinamis.pembimbing_1_id) {
                    const p1 = await DosenModel.findById(dataDinamis.pembimbing_1_id);
                    if (p1) p1Name = p1.nama_dosen.toUpperCase();
                }
                if (dataDinamis && dataDinamis.pembimbing_2_id) {
                    const p2 = await DosenModel.findById(dataDinamis.pembimbing_2_id);
                    if (p2) p2Name = p2.nama_dosen.toUpperCase();
                }

                const judulSkripsi = (mahasiswa && mahasiswa.judul_ta) ? mahasiswa.judul_ta.toUpperCase() : (pengajuan.perihal ? pengajuan.perihal.toUpperCase() : 'APLIKASI MOBILE TERINTEGRASI UNTUK MANAJEMEN DONOR DARAH DI PMI KOTA BAUBAU');

                // Konsideran: Menimbang, Mengingat, Memperhatikan
                const colHeaderX = 40;
                const colColonX = 120;
                const colContentX = 130;
                const contentWidth = 425;

                let curY = doc.y;

                // Menimbang
                doc.fontSize(9.5).font('Helvetica-Bold').text('Menimbang', colHeaderX, curY);
                doc.text(':', colColonX, curY);
                doc.font('Helvetica').text(`a. Bahwa dalam rangka pelaksanaan Bimbingan Tugas Akhir (Skripsi) bagi Sdr. ${namaMhs} Nomor Induk ${nimMhs} Mahasiswa Program Studi Teknik Informatika, maka dipandang perlu mengangkat Pembimbing Utama dan Pembimbing Pendamping.`, colContentX, curY, { width: contentWidth, align: 'justify', lineGap: 2 });

                curY = doc.y + 3;
                doc.font('Helvetica').text('b. Bahwa berdasarkan pada huruf (a) diatas, perlu ditetapkan dalam Surat Keputusan Dekan Fakultas Teknik Universitas Dayanu Ikhsanuddin..', colContentX, curY, { width: contentWidth, align: 'justify', lineGap: 2 });

                curY = doc.y + 6;
                // Mengingat
                doc.font('Helvetica-Bold').text('Mengingat', colHeaderX, curY);
                doc.text(':', colColonX, curY);
                doc.font('Helvetica').text('1. Peraturan Pemerintah Republik Indonesia Nomor 37 Tahun 2009, tentang Dosen', colContentX, curY, { width: contentWidth });
                curY = doc.y + 2.5;
                doc.text('2. Keputusan Rektor Nomor : 4/Q.13/UND/I/2022, tentang Peraturan Akademik Universitas Dayanu Ikhsanuddin', colContentX, curY, { width: contentWidth });
                curY = doc.y + 2.5;
                doc.text('3. Keputusan Rektor Nomor : 48/Q/UND/VII/2017, tentang Beban Kerja Tri Dharma dan Tugas Tambahan Dosen Universitas Dayanu Ikhsanuddin', colContentX, curY, { width: contentWidth });
                curY = doc.y + 2.5;
                doc.text('4. Keputusan Rektor Nomor : 52/KEP/Q/UND/VIII/2025 tentang Kalender Akademik Universitas Dayanu Ikhsanuddin', colContentX, curY, { width: contentWidth });

                curY = doc.y + 6;
                // Memperhatikan
                doc.font('Helvetica-Bold').text('Memperhatikan', colHeaderX, curY);
                doc.text(':', colColonX, curY);
                doc.font('Helvetica').text('Surat Ketua Program Studi Teknik Informatika Nomor : 235.1/Q.18/TI-UND/II/2026 tentang Usulan Dosen Pembimbing Tugas Akhir mahasiswa.', colContentX, curY, { width: contentWidth, align: 'justify' });

                curY = doc.y + 8;
                doc.font('Helvetica-Bold').text('MEMUTUSKAN', 40, curY, { align: 'center' });

                curY = doc.y + 6;
                doc.font('Helvetica-Bold').text('Menetapkan', colHeaderX, curY);
                doc.text(':', colColonX, curY);

                doc.font('Helvetica-Bold').text('Pertama', colHeaderX, curY + 10);
                doc.text(':', colColonX, curY + 10);
                doc.font('Helvetica').text(`Mengangkat Pembimbing Utama dan Pembimbing Pendamping Tugas Akhir bagi Sdr. ${namaMhs} Nomor Induk ${nimMhs} Program Studi Teknik Informatika Fakultas Teknik Universitas Dayanu Ikhsanuddin.`, colContentX, curY + 10, { width: contentWidth, align: 'justify' });

                curY = doc.y + 3;
                doc.font('Helvetica-Bold').text(`Judul Skripsi : ${judulSkripsi}`, colContentX, curY, { width: contentWidth, align: 'justify' });

                curY = doc.y + 3;
                doc.font('Helvetica').text('dengan susunan sebagai berikut :', colContentX, curY);

                curY = doc.y + 2.5;
                doc.font('Helvetica-Bold').text(`1. ${p1Name}`, colContentX + 15, curY);
                doc.font('Helvetica-Bold').text('( Pembimbing Utama )', colContentX + 250, curY);

                curY = doc.y + 2.5;
                doc.font('Helvetica-Bold').text(`2. ${p2Name}`, colContentX + 15, curY);
                doc.font('Helvetica-Bold').text('( Pembimbing Pendamping )', colContentX + 250, curY);

                curY = doc.y + 6;
                doc.font('Helvetica-Bold').text('Kedua', colHeaderX, curY);
                doc.text(':', colColonX, curY);
                doc.font('Helvetica').text('Segala Biaya yang timbul sehubungan dengan Surat keputusan ini di bebankan pada Anggaran Rutin Universitas Dayanu Ikhsanuddin Baubau;', colContentX, curY, { width: contentWidth, align: 'justify' });

                curY = doc.y + 4;
                doc.font('Helvetica-Bold').text('Ketiga', colHeaderX, curY);
                doc.text(':', colColonX, curY);
                doc.font('Helvetica').text('Surat Keputusan ini berlaku sejak tanggal ditetapkan, dan apabila terdapat kekeliruan didalamnya akan di tinjau kembali dan diperbaiki sebagaimana mestinya.', colContentX, curY, { width: contentWidth, align: 'justify' });

                // TTD Dekan (B. Ir. HILDA SULAIMAN NUR, S.T., M.T.)
                const rightX = 350;
                const ttdY = doc.y + 10;
                const dateStr = this.formatDateIndonesian(new Date());

                doc.fontSize(9.5).font('Helvetica').text('Ditetapkan di : Baubau', rightX, ttdY);
                doc.text(`Pada tanggal : ${dateStr}`, rightX, ttdY + 11);
                doc.font('Helvetica-Bold').text('Dekan,', rightX, ttdY + 22);

                let sigOffset = 34;
                if (pengajuan && pengajuan.ttd_kaprodi_path) {
                    const dekanTtdPath = path.join(__dirname, '../../public', pengajuan.ttd_kaprodi_path);
                    if (fs.existsSync(dekanTtdPath)) {
                        doc.image(dekanTtdPath, rightX, ttdY + sigOffset, { width: 95, height: 45 });
                    }
                }
                doc.image(qrBuffer, rightX + 105, ttdY + sigOffset - 5, { width: 65, height: 65 });

                const namaDekan = 'B. Ir. HILDA SULAIMAN NUR, S.T., M.T.';
                const nidnDekan = '0916076602';

                doc.fontSize(9.5).font('Helvetica-Bold').text(namaDekan, rightX, ttdY + 88, { underline: true });
                doc.fontSize(9).font('Helvetica').text(`NIDN. ${nidnDekan}`, rightX, ttdY + 101);

                // Tembusan
                const tembusanY = ttdY + 22;
                doc.fontSize(9).font('Helvetica-Bold').text('Tembusan Kepada Yth :', 40, tembusanY);
                let ty = tembusanY + 11;
                doc.font('Helvetica');
                doc.text('1. Wakil Dekan I FT Unidayan;', 40, ty); ty += 10.5;
                doc.text('2. Kaprodi. Teknik Informatika Unidayan;', 40, ty); ty += 10.5;
                doc.text('3. Dosen Ybs.;', 40, ty); ty += 10.5;
                doc.text(`4. Sdr. ${namaMhs};`, 40, ty); ty += 10.5;
                doc.text('5. Arsip', 40, ty);

                // Footer Digital Verification
                const footerY = 780;
                doc.moveTo(40, footerY).lineTo(555, footerY).lineWidth(0.5).stroke('#A0A0A0');
                doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#555555')
                    .text('Dokumen Surat Keputusan Dekan FT UNIDAYAN sah diterbitkan secara digital & dilindungi QR Code Hash Kriptografi.', 40, footerY + 4, { align: 'center' });
                doc.text(`Verifikasi Keaslian Publik: ${verifyUrl}`, 40, footerY + 13, { align: 'center' });

                doc.end();
            } catch (err) {
                console.error('Error generating SK Pembimbing PDF:', err);
                reject(err);
            }
        });
    }

    /**
     * PDF Template Resmi SK Dekan UNIDAYAN: Penetapan Dosen Penguji Ujian Skripsi / TA
     */
    static generateSkPengujiPdf({ pengajuan, mahasiswa, kaprodi, verifyUrl, signatureHash }) {
        return new Promise(async (resolve, reject) => {
            try {
                const doc = new PDFDocument({ size: 'A4', margin: 40 });
                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => resolve(Buffer.concat(buffers)));

                const qrBuffer = await QRCode.toBuffer(verifyUrl, {
                    errorCorrectionLevel: 'H',
                    margin: 1,
                    width: 85
                });

                // 1. KOP SURAT UNIDAYAN
                const logoPath = path.join(__dirname, '../../public/images/logo-unidayan.png');
                if (fs.existsSync(logoPath)) {
                    doc.image(logoPath, 40, 36, { width: 62 });
                }

                doc.fontSize(12).font('Helvetica-Bold').text('UNIVERSITAS DAYANU IKHSANUDDIN', 110, 35, { align: 'center' });
                doc.fontSize(14).font('Helvetica-Bold').text('FAKULTAS TEKNIK', 110, 50, { align: 'center' });
                doc.fontSize(8.5).font('Helvetica').text('Jl. Sultan Dayanu Ikhsanuddin No. 124 Baubau Telp (0402) 2821327, Fax(0402) 2826682 Baubau 93724', 110, 68, { align: 'center' });

                // Kop Line
                doc.moveTo(40, 82).lineTo(555, 82).lineWidth(2).stroke('#000000');
                doc.moveTo(40, 85).lineTo(555, 85).lineWidth(0.8).stroke('#000000');

                // 2. JUDUL SURAT KEPUTUSAN PENGUJI
                doc.y = 95;
                doc.fontSize(11).font('Helvetica-Bold').text('SURAT KEPUTUSAN', 40, doc.y, { align: 'center' });
                doc.fontSize(10.5).font('Helvetica-Bold').text('DEKAN FAKULTAS TEKNIK UNIVERSITAS DAYANU IKHSANUDDIN', 40, doc.y + 2, { align: 'center' });

                const nomorResmi = pengajuan.nomor_surat ? pengajuan.nomor_surat : '024/Q.21/FT-UND/II/2026';
                doc.fontSize(10).font('Helvetica').text(`NOMOR : ${nomorResmi}`, 40, doc.y + 2, { align: 'center' });

                doc.moveDown(0.4);
                doc.fontSize(10).font('Helvetica-Bold').text('TENTANG', { align: 'center' });
                doc.fontSize(10.5).font('Helvetica-Bold').text('PENETAPAN PENGUJI TUGAS AKHIR MAHASISWA PROGRAM STRATA SATU', { align: 'center' });

                const namaMhs = (mahasiswa && mahasiswa.nama_lengkap) ? mahasiswa.nama_lengkap.toUpperCase() : (pengajuan.mhs_nama ? pengajuan.mhs_nama.toUpperCase() : 'MUHAMMAD FARIS PRATAMA');
                const nimMhs = (mahasiswa && mahasiswa.nim) ? mahasiswa.nim : (pengajuan.mhs_nim ? pengajuan.mhs_nim : '22650025');

                doc.fontSize(10).font('Helvetica-Bold').text(`A.N : ${namaMhs}  NOMOR INDUK: ${nimMhs}`, { align: 'center' });
                doc.fontSize(10).font('Helvetica-Bold').text('PROGRAM STUDI TEKNIK INFORMATIKA', { align: 'center' });

                doc.moveDown(0.5);
                doc.fontSize(9.5).font('Helvetica-Oblique').text('Dengan Rahmat Tuhan Yang Maha Esa', { align: 'center' });
                doc.fontSize(10).font('Helvetica-Bold').text('DEKAN FAKULTAS TEKNIK UNIVERSITAS DAYANU IKHSANUDDIN', { align: 'center' });

                doc.moveDown(0.5);

                let dataDinamis = {};
                try {
                    dataDinamis = typeof pengajuan.data_dinamis === 'string' ? JSON.parse(pengajuan.data_dinamis) : pengajuan.data_dinamis;
                } catch (e) {}

                let penguji1Name = 'MUHAMMAD MUKMIN, S.Kom., M.T.';
                let penguji2Name = 'Ir. LM. FAJAR ISRAWAN, S.Kom., M.Kom., M.M.';
                let penguji3Name = 'Ir. ASNIATI, S.T., M.T.';

                if (dataDinamis && dataDinamis.penguji_1_id) {
                    const p1 = await DosenModel.findById(dataDinamis.penguji_1_id);
                    if (p1) penguji1Name = p1.nama_dosen.toUpperCase();
                }
                if (dataDinamis && dataDinamis.penguji_2_id) {
                    const p2 = await DosenModel.findById(dataDinamis.penguji_2_id);
                    if (p2) penguji2Name = p2.nama_dosen.toUpperCase();
                }
                if (dataDinamis && dataDinamis.penguji_3_id) {
                    const p3 = await DosenModel.findById(dataDinamis.penguji_3_id);
                    if (p3) penguji3Name = p3.nama_dosen.toUpperCase();
                }

                const judulSkripsi = (mahasiswa && mahasiswa.judul_ta) ? mahasiswa.judul_ta.toUpperCase() : (pengajuan.perihal ? pengajuan.perihal.toUpperCase() : 'APLIKASI MOBILE TERINTEGRASI UNTUK MANAJEMEN DONOR DARAH DI PMI KOTA BAUBAU');

                // Konsideran
                const colHeaderX = 40;
                const colColonX = 120;
                const colContentX = 130;
                const contentWidth = 425;

                let curY = doc.y;

                // Menimbang
                doc.fontSize(9.5).font('Helvetica-Bold').text('Menimbang', colHeaderX, curY);
                doc.text(':', colColonX, curY);
                doc.font('Helvetica').text(`a. Bahwa dalam rangka pelaksanaan Pengujian Tugas Akhir (Skripsi) bagi Sdr. ${namaMhs} Nomor Induk ${nimMhs} Mahasiswa Program Studi Teknik Informatika, maka dipandang perlu mengangkat Penguji.`, colContentX, curY, { width: contentWidth, align: 'justify', lineGap: 2 });

                curY = doc.y + 3;
                doc.font('Helvetica').text('b. Bahwa berdasarkan pada huruf (a) diatas, perlu ditetapkan dalam Surat Keputusan Dekan Fakultas Teknik Universitas Dayanu Ikhsanuddin..', colContentX, curY, { width: contentWidth, align: 'justify', lineGap: 2 });

                curY = doc.y + 6;
                // Mengingat
                doc.font('Helvetica-Bold').text('Mengingat', colHeaderX, curY);
                doc.text(':', colColonX, curY);
                doc.font('Helvetica').text('1. Peraturan Pemerintah Republik Indonesia Nomor 37 Tahun 2009, tentang Dosen', colContentX, curY, { width: contentWidth });
                curY = doc.y + 2.5;
                doc.text('2. Keputusan Rektor Nomor : 96/Q.13/UND/XII/2016, tentang Peraturan Akademik Universitas Dayanu Ikhsanuddin', colContentX, curY, { width: contentWidth });
                curY = doc.y + 2.5;
                doc.text('3. Keputusan Rektor Nomor : 48/Q/UND/VII/2017, tentang Beban Kerja Tri Dharma dan Tugas Tambahan Dosen Universitas Dayanu Ikhsanuddin', colContentX, curY, { width: contentWidth });
                curY = doc.y + 2.5;
                doc.text('4. Keputusan Rektor Nomor : 52/KEP/Q/UND/VIII/2025, tentang Kalender Akademik Universitas Dayanu Ikhsanuddin', colContentX, curY, { width: contentWidth });

                curY = doc.y + 6;
                // Memperhatikan
                doc.font('Helvetica-Bold').text('Memperhatikan', colHeaderX, curY);
                doc.text(':', colColonX, curY);
                doc.font('Helvetica').text('Surat Ketua Program Studi Teknik Informatika Nomor : 230/Q.18/TI-UND/II/2026 tentang Usulan Dosen Penguji Tugas Akhir Mahasiswa.', colContentX, curY, { width: contentWidth, align: 'justify' });

                curY = doc.y + 8;
                doc.font('Helvetica-Bold').text('MEMUTUSKAN', 40, curY, { align: 'center' });

                curY = doc.y + 6;
                doc.font('Helvetica-Bold').text('Menetapkan', colHeaderX, curY);
                doc.text(':', colColonX, curY);

                doc.font('Helvetica-Bold').text('Pertama', colHeaderX, curY + 10);
                doc.text(':', colColonX, curY + 10);
                doc.font('Helvetica').text(`Mengangkat Ketua dan Anggota Penguji Tugas Akhir bagi Sdr. ${namaMhs} Nomor Induk ${nimMhs} Program Studi Teknik Informatika Fakultas Teknik Universitas Dayanu Ikhsanuddin.`, colContentX, curY + 10, { width: contentWidth, align: 'justify' });

                curY = doc.y + 3;
                doc.font('Helvetica-Bold').text(`Judul Skripsi : ${judulSkripsi}`, colContentX, curY, { width: contentWidth, align: 'justify' });

                curY = doc.y + 3;
                doc.font('Helvetica').text('dengan susunan sebagai berikut :', colContentX, curY);

                curY = doc.y + 2.5;
                doc.font('Helvetica-Bold').text(`1. ${penguji1Name}`, colContentX + 15, curY);
                doc.font('Helvetica-Bold').text('( Ketua Penguji )', colContentX + 250, curY);

                curY = doc.y + 2.5;
                doc.font('Helvetica-Bold').text(`2. ${penguji2Name}`, colContentX + 15, curY);
                doc.font('Helvetica-Bold').text('( Anggota Penguji )', colContentX + 250, curY);

                curY = doc.y + 2.5;
                doc.font('Helvetica-Bold').text(`3. ${penguji3Name}`, colContentX + 15, curY);
                doc.font('Helvetica-Bold').text('( Anggota Penguji )', colContentX + 250, curY);

                curY = doc.y + 6;
                doc.font('Helvetica-Bold').text('Kedua', colHeaderX, curY);
                doc.text(':', colColonX, curY);
                doc.font('Helvetica').text('Segala Biaya yang timbul sehubungan dengan Surat keputusan ini di bebankan pada Anggaran Rutin Universitas Dayanu Ikhsanuddin Baubau;', colContentX, curY, { width: contentWidth, align: 'justify' });

                curY = doc.y + 4;
                doc.font('Helvetica-Bold').text('Ketiga', colHeaderX, curY);
                doc.text(':', colColonX, curY);
                doc.font('Helvetica').text('Surat Keputusan ini berlaku sejak tanggal ditetapkan, dan apabila terdapat kekeliruan didalamnya akan di tinjau kembali dan diperbaiki sebagaimana mestinya.', colContentX, curY, { width: contentWidth, align: 'justify' });

                // TTD Dekan
                const rightX = 350;
                const ttdY = doc.y + 10;
                const dateStr = this.formatDateIndonesian(new Date());

                doc.fontSize(9.5).font('Helvetica').text('Ditetapkan di : Baubau', rightX, ttdY);
                doc.text(`Pada tanggal : ${dateStr}`, rightX, ttdY + 11);
                doc.font('Helvetica-Bold').text('Dekan,', rightX, ttdY + 22);

                let sigOffset = 34;
                if (pengajuan && pengajuan.ttd_kaprodi_path) {
                    const dekanTtdPath = path.join(__dirname, '../../public', pengajuan.ttd_kaprodi_path);
                    if (fs.existsSync(dekanTtdPath)) {
                        doc.image(dekanTtdPath, rightX, ttdY + sigOffset, { width: 95, height: 45 });
                    }
                }
                doc.image(qrBuffer, rightX + 105, ttdY + sigOffset - 5, { width: 65, height: 65 });

                const namaDekan = 'Ir. HILDA SULAIMAN NUR, S.T., M.T.';
                const nidnDekan = '0916076602';

                doc.fontSize(9.5).font('Helvetica-Bold').text(namaDekan, rightX, ttdY + 88, { underline: true });
                doc.fontSize(9).font('Helvetica').text(`NIDN. ${nidnDekan}`, rightX, ttdY + 101);
                doc.fontSize(9).font('Helvetica').text(`NIDN. ${nidnDekan}`, rightX, ttdY + 101);

                // Tembusan
                const tembusanY = ttdY + 22;
                doc.fontSize(9).font('Helvetica-Bold').text('Tembusan Kepada Yth :', 40, tembusanY);
                let ty = tembusanY + 11;
                doc.font('Helvetica');
                doc.text('1. Wakil Dekan I FT Unidayan;', 40, ty); ty += 10.5;
                doc.text('2. Kaprodi. Teknik Informatika Unidayan;', 40, ty); ty += 10.5;
                doc.text('3. Tim Dosen Penguji Ybs.;', 40, ty); ty += 10.5;
                doc.text(`4. Sdr. ${namaMhs};`, 40, ty); ty += 10.5;
                doc.text('5. Arsip', 40, ty);

                // Footer Verification
                const footerY = 780;
                doc.moveTo(40, footerY).lineTo(555, footerY).lineWidth(0.5).stroke('#A0A0A0');
                doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#555555')
                    .text('Dokumen Surat Keputusan Tim Penguji Dekan FT UNIDAYAN sah diterbitkan secara digital & dilindungi QR Code.', 40, footerY + 4, { align: 'center' });
                doc.text(`Verifikasi Keaslian Publik: ${verifyUrl}`, 40, footerY + 13, { align: 'center' });

                doc.end();
            } catch (err) {
                console.error('Error generating SK Penguji PDF:', err);
                reject(err);
            }
        });
    }

    /**
     * PDF Template Resmi UNIDAYAN Baubau (Surat Izin Penelitian)
     */
    static generateSuratIzinPenelitianPdf({ pengajuan, mahasiswa, kaprodi, verifyUrl, signatureHash }) {
        return new Promise(async (resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: 'A4',
                    margin: 40
                });

                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfBuffer = Buffer.concat(buffers);
                    resolve(pdfBuffer);
                });

                // Generate QR Code Buffer E-Signature
                const qrBuffer = await QRCode.toBuffer(verifyUrl, {
                    errorCorrectionLevel: 'H',
                    margin: 1,
                    width: 90
                });

                // 1. KOP SURAT UNIDAYAN
                const logoPath = path.join(__dirname, '../../public/images/logo-unidayan.png');
                if (fs.existsSync(logoPath)) {
                    doc.image(logoPath, 40, 36, { width: 62 });
                }

                doc.fontSize(12).font('Helvetica-Bold').text('UNIVERSITAS DAYANU IKHSANUDDIN', 110, 35, { align: 'center' });
                doc.fontSize(14).font('Helvetica-Bold').text('FAKULTAS TEKNIK', 110, 50, { align: 'center' });
                doc.fontSize(13).font('Helvetica-Bold').text('PROGRAM STUDI TEKNIK INFORMATIKA', 110, 66, { align: 'center' });
                doc.fontSize(8.5).font('Helvetica').text('Jln. Sultan Dayanu Ikhsanuddin No. 124 Telp. (0402) 2821404 Baubau 93724', 110, 82, { align: 'center' });
                doc.fontSize(8.5).font('Helvetica-Oblique').text('Website: www.unidayan.ac.id Email: ft@unidayan.ac.id', 110, 94, { align: 'center' });

                // Garis Ganda Kop Surat
                doc.moveTo(40, 110).lineTo(555, 110).lineWidth(2.5).stroke('#000000');
                doc.moveTo(40, 114).lineTo(555, 114).lineWidth(0.8).stroke('#000000');

                // 2. NOMOR & PERIHAL SURAT
                doc.y = 126;
                const nomorResmi = pengajuan.nomor_surat ? pengajuan.nomor_surat : '... / N / TI-UND / III / 2026';
                doc.fontSize(10.5).font('Helvetica').text(`Nomor     : ${nomorResmi}`, 40, 126);
                doc.text('Lamp.     : -', 40, 139);
                doc.text('Perihal   : Permohonan Surat Ijin Penelitian', 40, 152);

                // 3. ALAMAT TUJUAN (INSTANSI)
                doc.y = 175;
                doc.fontSize(10.5).font('Helvetica').text('Kepada Yth.', 40, 175);
                doc.fontSize(10.5).font('Helvetica-Bold').text(pengajuan.perihal || 'Bapak/Ibu Pimpinan Instansi / Perusahaan', 40, 188);
                doc.fontSize(10.5).font('Helvetica').text('di -', 40, 201);
                doc.fontSize(10.5).font('Helvetica-Bold').text('    Place / Tempat', 40, 214);

                // 4. PARAGRAF PEMBUKA
                doc.y = 238;
                doc.fontSize(10.5).font('Helvetica')
                    .text('Dengan hormat, disampaikan bahwa mahasiswa Program Studi Teknik Informatika Fakultas Teknik Universitas Dayanu Ikhsanuddin Baubau tersebut di bawah ini:', 40, doc.y, { align: 'justify', lineGap: 3 });

                // 5. TABEL FIELD DATA MAHASISWA
                let currentY = doc.y + 12;
                const labelX = 55;
                const colonX = 175;
                const valueX = 185;

                const addRow = (label, val, isBold = false) => {
                    doc.fontSize(10.5).font('Helvetica').text(label, labelX, currentY);
                    doc.text(':', colonX, currentY);
                    if (isBold) {
                        doc.font('Helvetica-Bold').text(val || '-', valueX, currentY, { width: 360, align: 'justify', lineGap: 2 });
                    } else {
                        doc.font('Helvetica').text(val || '-', valueX, currentY, { width: 360, align: 'justify' });
                    }
                    currentY = doc.y + 6;
                };

                const namaMhs = (mahasiswa && mahasiswa.nama_lengkap) ? mahasiswa.nama_lengkap.toUpperCase() : (pengajuan.mhs_nama ? pengajuan.mhs_nama.toUpperCase() : 'MUHAMAD ADRIAN');
                const nimMhs = (mahasiswa && mahasiswa.nim) ? mahasiswa.nim : (pengajuan.mhs_nim ? pengajuan.mhs_nim : '22650119');
                const judulTa = (mahasiswa && mahasiswa.judul_ta) ? mahasiswa.judul_ta.toUpperCase() : (pengajuan.perihal ? pengajuan.perihal.toUpperCase() : 'IMPLEMENTASI ALGORITMA UNTUK SISTEM E-SURAT ADMINISTRASI TUGAS AKHIR');

                addRow('Nama', namaMhs);
                addRow('Stambuk', nimMhs);
                addRow('Fakultas', 'Teknik');
                addRow('Program Studi', 'Teknik Informatika');
                addRow('Judul Penelitian', judulTa, true);

                doc.y = currentY + 10;
                let dataDinamis = {};
                try {
                    dataDinamis = typeof pengajuan.data_dinamis === 'string' ? JSON.parse(pengajuan.data_dinamis) : pengajuan.data_dinamis;
                } catch (e) {}

                const instansiTujuan = (dataDinamis && dataDinamis.instansi_tujuan) ? dataDinamis.instansi_tujuan : 'Laboratorium Teknik Informatika';
                const durasi = (dataDinamis && dataDinamis.durasi) ? dataDinamis.durasi : '2,5 bulan';

                // Get Pembimbing Names for Tembusan
                let p1Name = 'Dosen Pembimbing I';
                let p2Name = 'Dosen Pembimbing II';
                if (dataDinamis && dataDinamis.pembimbing_1_id) {
                    const p1 = await DosenModel.findById(dataDinamis.pembimbing_1_id);
                    if (p1) p1Name = p1.nama_dosen;
                }
                if (dataDinamis && dataDinamis.pembimbing_2_id) {
                    const p2 = await DosenModel.findById(dataDinamis.pembimbing_2_id);
                    if (p2) p2Name = p2.nama_dosen;
                }

                doc.fontSize(10.5).font('Helvetica')
                    .text(`Akan melakukan penelitian pada ${instansiTujuan}, kiranya dapat diterima dan diberikan izin untuk proses pengambilan data yang diperlukan selama kurun waktu ± ${durasi}.`, 40, doc.y, { align: 'justify', lineGap: 3 });

                // 7. PARAGRAF PENUTUP
                doc.moveDown(1.2);
                doc.text('Demikian Surat permohonan ini, atas perhatian serta kerjasamanya kami ucapkan terima kasih.', 40, doc.y, { align: 'justify' });

                // 8. BLOK TANDA TANGAN KAPRODI (RIGHT ALIGNED / BOTTOM RIGHT)
                const ttdY = Math.max(doc.y + 30, 510);
                const rightX = 330;
                const dateStr = this.formatDateIndonesian(new Date());

                doc.fontSize(10.5).font('Helvetica').text(`Baubau, ${dateStr}`, rightX, ttdY);
                doc.text('Hormat Kami,', rightX, ttdY + 16);
                doc.text('Plt. Ketua Program Studi', rightX, ttdY + 30);

                let signatureOffset = 46;
                if (pengajuan && pengajuan.ttd_kaprodi_path) {
                    const kaprodiTtdPath = path.join(__dirname, '../../public', pengajuan.ttd_kaprodi_path);
                    if (fs.existsSync(kaprodiTtdPath)) {
                        doc.image(kaprodiTtdPath, rightX, ttdY + signatureOffset, { width: 95, height: 45 });
                    }
                }
                doc.image(qrBuffer, rightX + 115, ttdY + signatureOffset - 5, { width: 68, height: 68 });

                const namaKaprodi = (kaprodi && kaprodi.nama_dosen) ? kaprodi.nama_dosen : 'Prof. Dr. Rasmuin, S.Pd., M.Pd.';
                const nipKaprodi = (kaprodi && kaprodi.nip_nidn) ? kaprodi.nip_nidn : '196812311994031012';

                const nameY = ttdY + 115;
                doc.fontSize(10.5).font('Helvetica-Bold').text(namaKaprodi, rightX, nameY, { underline: true });
                doc.fontSize(10).font('Helvetica').text(`NIP. ${nipKaprodi}`, rightX, nameY + 15);

                // 8.5 BLOK TEMBUSAN SURAT (BOTTOM LEFT)
                const tembusanY = ttdY + 20;
                doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#000000').text('Tembusan :', 40, tembusanY);
                doc.fontSize(9).font('Helvetica');
                let tIndexY = tembusanY + 14;
                doc.text('1. Yth. Rektor Universitas Dayanu Ikhsanuddin (sebagai laporan)', 40, tIndexY);
                tIndexY += 12;
                doc.text('2. Yth. Dekan Fakultas Teknik UNIDAYAN', 40, tIndexY);
                tIndexY += 12;
                doc.text(`3. Yth. ${instansiTujuan}`, 40, tIndexY);
                tIndexY += 12;
                doc.text(`4. Yth. Dosen Pembimbing I (${p1Name})`, 40, tIndexY);
                tIndexY += 12;
                doc.text(`5. Yth. Dosen Pembimbing II (${p2Name})`, 40, tIndexY);
                tIndexY += 12;
                doc.text('6. Arsip', 40, tIndexY);

                // 9. FOOTER VERIFIKASI KEASLIAN DIGITAL
                const footerY = 770;
                doc.moveTo(40, footerY).lineTo(555, footerY).lineWidth(0.5).stroke('#A0A0A0');
                doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#555555')
                    .text('Dokumen ini diterbitkan secara sah oleh E-Surat Administrasi TA UNIDAYAN dan dilindungi E-Signature QR Code.', 40, footerY + 4, { align: 'center' });
                doc.text(`Hash Kriptografi SHA-256: ${signatureHash || pengajuan.qr_signature_hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca4'}`, 40, footerY + 13, { align: 'center' });
                doc.text(`Verifikasi Keaslian Publik: ${verifyUrl}`, 40, footerY + 22, { align: 'center' });

                doc.end();
            } catch (err) {
                console.error('Error generating PDF:', err);
                reject(err);
            }
        });
    }
}

module.exports = PdfGeneratorService;
