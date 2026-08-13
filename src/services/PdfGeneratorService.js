const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { resolveUploadPath } = require('../utils/pathHelper');
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
        const tPath = pengajuan ? (pengajuan.template_path || '') : '';

        if (kode.includes('SRT-IZIN-PENELITIAN') || nama.includes('izin penelitian')) {
            return this.generateSuratIzinPenelitianResmiPdf(opts);
        }
        if (kode.includes('SK-PEMBIMBING-PENGUJI') || tPath === 'sk_pembimbing_penguji' || nama.includes('pembimbing & penguji') || nama.includes('pembimbing dan penguji')) {
            return this.generateSkPembimbingDanPengujiPdf(opts);
        }
        if (kode.includes('SK-PEMBIMBING') || nama.includes('pembimbing') || nama.includes('sk pembimbing')) {
            return this.generateSkPembimbingPdf(opts);
        }
        if (kode.includes('SK-PENGUJI') || nama.includes('penguji') || nama.includes('sk penguji')) {
            return this.generateSkPengujiPdf(opts);
        }
        if (kode.includes('LMBR-PERSETUJUAN-WKT') || nama.includes('persetujuan waktu') || nama.includes('lembar persetujuan waktu')) {
            return this.generateLembarPersetujuanWaktuPdf(opts);
        }
        if (kode.includes('KARTU-BIMBINGAN') || nama.includes('kartu bimbingan')) {
            return this.generateKartuBimbinganPdf(opts);
        }
        if (kode.includes('UND-') || nama.includes('undangan')) {
            return this.generateSuratUndanganSeminarPdf(opts);
        }
        if (kode.includes('BA-UJIAN') || nama.includes('berita acara')) {
            return this.generateBeritaAcaraUjianPdf(opts);
        }

        return this.generateSuratIzinPenelitianResmiPdf(opts);
    }

    /**
     * PDF Template Resmi UNIDAYAN: Surat Izin Penelitian Instansi / Perusahaan
     */
    static generateSuratIzinPenelitianResmiPdf({ pengajuan, mahasiswa, kaprodi, verifyUrl, signatureHash }) {
        return new Promise(async (resolve, reject) => {
            try {
                const doc = new PDFDocument({ size: 'A4', margin: 40 });
                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => resolve(Buffer.concat(buffers)));

                const qrBuffer = await QRCode.toBuffer(verifyUrl, {
                    errorCorrectionLevel: 'H',
                    margin: 1,
                    width: 75
                });

                // 1. KOP SURAT UNIDAYAN
                const logoPath = path.join(__dirname, '../../public/images/logo-unidayan.png');
                if (fs.existsSync(logoPath)) {
                    doc.image(logoPath, 45, 32, { width: 60 });
                }

                doc.fontSize(12).font('Helvetica-Bold').text('UNIVERSITAS DAYANU IKHSANUDDIN', 110, 30, { align: 'center' });
                doc.fontSize(13).font('Helvetica-Bold').text('FAKULTAS TEKNIK', 110, 45, { align: 'center' });
                doc.fontSize(11).font('Helvetica-Bold').text('PROGRAM STUDI TEKNIK INFORMATIKA', 110, 60, { align: 'center' });
                doc.fontSize(8).font('Helvetica').text('SK Akreditasi No. 3084/SK/BAN-PT/Ak-PPJ/S/V/2020', 110, 74, { align: 'center' });
                doc.fontSize(8).font('Helvetica').text('Jalan Sultan Dayanu Ikhsanuddin No. 124 Baubau Telp. (0402) 2821327 Baubau 93724', 110, 85, { align: 'center' });

                // Kop Line Ganda
                doc.moveTo(40, 98).lineTo(555, 98).lineWidth(2).stroke('#000000');
                doc.moveTo(40, 101).lineTo(555, 101).lineWidth(0.8).stroke('#000000');

                // 2. HEADER TANGGAL & NOMOR SURAT
                let curY = 115;
                const nomorResmi = pengajuan.nomor_surat ? pengajuan.nomor_surat : 'B/345/UN.1/TI/TA/2026';
                const dateStr = this.formatDateIndonesian(new Date());

                // Tanggal Surat di Kanan
                doc.fontSize(10).font('Helvetica').text(`Baubau, ${dateStr}`, 380, curY, { align: 'right' });

                // Nomor, Lampiran, Perihal di Kiri
                doc.fontSize(10).font('Helvetica').text('Nomor', 40, curY);
                doc.text(':', 100, curY);
                doc.font('Helvetica-Bold').text(nomorResmi, 110, curY);

                curY += 14;
                doc.font('Helvetica').text('Lampiran', 40, curY);
                doc.text(':', 100, curY);
                doc.text('1 (Satu) Berkas Proposal', 110, curY);

                curY += 14;
                doc.font('Helvetica').text('Perihal', 40, curY);
                doc.text(':', 100, curY);
                doc.font('Helvetica-Bold').text('Izin Penelitian Tugas Akhir / Skripsi', 110, curY);

                // 3. TUJUAN SURAT
                curY += 28;
                let dataDinamis = {};
                try {
                    dataDinamis = typeof pengajuan.data_dinamis === 'string' ? JSON.parse(pengajuan.data_dinamis) : (pengajuan.data_dinamis || {});
                } catch (e) {}

                const instansiTujuan = dataDinamis.instansi_tujuan || dataDinamis.tujuan_instansi || 'Pimpinan / Kepala Instansi Terkait';
                const durasi = dataDinamis.durasi || '3 (Tiga) Bulan';

                doc.font('Helvetica').text('Kepada Yth.', 40, curY);
                curY += 14;
                doc.font('Helvetica-Bold').text(instansiTujuan, 40, curY);
                curY += 14;
                doc.font('Helvetica').text('di -', 40, curY);
                curY += 14;
                doc.font('Helvetica-Bold').text('    Tempat', 40, curY);

                // 4. PARAGRAF PEMBUKA
                curY += 24;
                doc.font('Helvetica').fontSize(10).text('Dengan hormat,', 40, curY);
                curY += 16;
                const p1 = 'Dalam rangka penyelesaian Tugas Akhir / Skripsi sebagai syarat utama kelulusan mahasiswa Program Studi Teknik Informatika Fakultas Teknik Universitas Dayanu Ikhsanuddin (UNIDAYAN) Baubau, bersama ini kami memohon kesediaan Bapak/Ibu untuk berkenan memberikan izin penelitian kepada mahasiswa kami:';
                doc.font('Helvetica').fontSize(10).text(p1, 40, curY, { width: 515, align: 'justify', lineGap: 3 });

                // 5. DATA IDENTITAS MAHASISWA & SKRIPSI
                curY = doc.y + 14;
                const namaMhs = (mahasiswa && mahasiswa.nama_lengkap) ? mahasiswa.nama_lengkap.toUpperCase() : (pengajuan.mhs_nama ? pengajuan.mhs_nama.toUpperCase() : 'AHMAD FAUZI');
                const nimMhs = (mahasiswa && mahasiswa.nim) ? mahasiswa.nim : (pengajuan.mhs_nim ? pengajuan.mhs_nim : '21081010001');
                const judulTa = (mahasiswa && mahasiswa.judul_ta) ? mahasiswa.judul_ta : (pengajuan.perihal || 'Rancang Bangun Sistem Informasi Pengolahan Data UNIDAYAN');

                const labelX = 60;
                const colonX = 175;
                const valX = 185;

                const addDetailRow = (label, val, isBold = false) => {
                    doc.font('Helvetica').fontSize(9.5).text(label, labelX, curY);
                    doc.text(':', colonX, curY);
                    if (isBold) {
                        doc.font('Helvetica-Bold').text(val, valX, curY, { width: 360, align: 'justify', lineGap: 2 });
                    } else {
                        doc.font('Helvetica').text(val, valX, curY, { width: 360, align: 'justify', lineGap: 2 });
                    }
                    curY = doc.y + 4;
                };

                addDetailRow('Nama Mahasiswa', namaMhs, true);
                addDetailRow('Nomor Stambuk / NIM', nimMhs, true);
                addDetailRow('Program Studi', 'Teknik Informatika (S-1)', true);
                addDetailRow('Judul Skripsi / TA', `"${judulTa}"`, true);
                addDetailRow('Jangka Waktu Penelitian', durasi, false);

                // 6. PARAGRAF PENUTUP
                curY = doc.y + 14;
                const p2 = 'Demikian surat permohonan izin penelitian ini kami sampaikan. Atas bantuan, perhatian, dan kerja sama yang baik dari Bapak/Ibu, kami ucapkan terima kasih.';
                doc.font('Helvetica').fontSize(10).text(p2, 40, curY, { width: 515, align: 'justify', lineGap: 3 });

                // 7. BLOK TANDA TANGAN & QR E-SIGNATURE
                curY = doc.y + 24;
                const ttdRightX = 350;

                doc.fontSize(10).font('Helvetica').text('Baubau, ' + dateStr, ttdRightX, curY);
                curY += 14;
                doc.font('Helvetica-Bold').text('Ketua Program Studi Teknik Informatika,', ttdRightX, curY, { width: 200 });

                let sigOffset = 24;
                const kaprodiTtdPath = resolveUploadPath(pengajuan && pengajuan.ttd_kaprodi_path) || resolveUploadPath('uploads/signatures/ttd_kaprodi_default.png');
                if (kaprodiTtdPath) {
                    doc.image(kaprodiTtdPath, ttdRightX, curY + sigOffset, { width: 90, height: 42 });
                }
                doc.image(qrBuffer, ttdRightX + 100, curY + sigOffset - 4, { width: 62, height: 62 });

                const namaKaprodi = (kaprodi && kaprodi.nama_dosen) ? kaprodi.nama_dosen : 'Prof. Dr. RASMUIN, S.Pd., M.Pd.';
                const nipKaprodi = (kaprodi && kaprodi.nip_nidn) ? kaprodi.nip_nidn : '196812311994031012';

                doc.fontSize(10).font('Helvetica-Bold').text(namaKaprodi, ttdRightX, curY + 75, { underline: true });
                doc.fontSize(9.5).font('Helvetica').text(`NIP / NIDN. ${nipKaprodi}`, ttdRightX, curY + 89);

                // 8. FOOTER DOKUMEN DIGITAL SAH
                const footerY = 780;
                doc.moveTo(40, footerY).lineTo(555, footerY).lineWidth(0.5).stroke('#A0A0A0');
                doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#444444')
                    .text('Dokumen Surat Izin Penelitian Fakultas Teknik UNIDAYAN sah diterbitkan secara digital & dilindungi QR E-Signature.', 40, footerY + 4, { align: 'center' });
                doc.text(`Verifikasi Keaslian Dokumen: ${verifyUrl}`, 40, footerY + 13, { align: 'center' });

                doc.end();
            } catch (err) {
                console.error('Error generating Surat Izin Penelitian Resmi PDF:', err);
                reject(err);
            }
        });
    }

    /**
     * PDF Template Resmi SK Dekan UNIDAYAN: Gabungan SK Dosen Pembimbing & SK Dosen Penguji TA
     */
    static generateSkPembimbingDanPengujiPdf({ pengajuan, mahasiswa, kaprodi, verifyUrl, signatureHash }) {
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

                const logoPath = path.join(__dirname, '../../public/images/logo-unidayan.png');
                const db = require('../../config/database');

                // Dynamic values lookup from DB
                let dataDinamis = {};
                try {
                    dataDinamis = typeof pengajuan.data_dinamis === 'string' ? JSON.parse(pengajuan.data_dinamis) : pengajuan.data_dinamis;
                } catch (e) {}

                let p1Name = '';
                let p2Name = '';
                let penguji1Name = '';
                let penguji2Name = '';
                let penguji3Name = '';
                let approvedTitle = '';

                if (mahasiswa && mahasiswa.id) {
                    const approvedProp = await db.get("SELECT * FROM pengajuan_judul_ta WHERE mahasiswa_id = ? AND status = 'diterima' ORDER BY id DESC LIMIT 1", [mahasiswa.id]);
                    const plotting = await db.get("SELECT * FROM plotting_tugas_akhir WHERE mahasiswa_id = ? ORDER BY id DESC LIMIT 1", [mahasiswa.id]);

                    if (approvedProp && approvedProp.judul_ta) approvedTitle = approvedProp.judul_ta.toUpperCase();

                    const p1Id = (dataDinamis && dataDinamis.pembimbing_1_id) || (approvedProp ? approvedProp.dosen_pembimbing_1_id : (plotting ? plotting.dosen_pembimbing_1_id : null));
                    const p2Id = (dataDinamis && dataDinamis.pembimbing_2_id) || (approvedProp ? approvedProp.dosen_pembimbing_2_id : (plotting ? plotting.dosen_pembimbing_2_id : null));

                    const pg1Id = (dataDinamis && dataDinamis.penguji_1_id) || (plotting ? plotting.dosen_penguji_1_id : null);
                    const pg2Id = (dataDinamis && dataDinamis.penguji_2_id) || (plotting ? plotting.dosen_penguji_2_id : null);
                    const pg3Id = (dataDinamis && dataDinamis.penguji_3_id) || (plotting ? plotting.dosen_penguji_3_id : null);

                    if (p1Id) {
                        const p1 = await DosenModel.findById(p1Id);
                        if (p1) p1Name = p1.nama_dosen.toUpperCase();
                    }
                    if (p2Id) {
                        const p2 = await DosenModel.findById(p2Id);
                        if (p2) p2Name = p2.nama_dosen.toUpperCase();
                    }
                    if (pg1Id) {
                        const pg1 = await DosenModel.findById(pg1Id);
                        if (pg1) penguji1Name = pg1.nama_dosen.toUpperCase();
                    }
                    if (pg2Id) {
                        const pg2 = await DosenModel.findById(pg2Id);
                        if (pg2) penguji2Name = pg2.nama_dosen.toUpperCase();
                    }
                    if (pg3Id) {
                        const pg3 = await DosenModel.findById(pg3Id);
                        if (pg3) penguji3Name = pg3.nama_dosen.toUpperCase();
                    }
                }

                if (!p1Name) p1Name = 'Ir. MOH. ARIF SURYAWAN, S.Kom., M.T.';
                if (!p2Name) p2Name = 'Ir. ASNIATI, S.T., M.T.';
                if (!penguji1Name) penguji1Name = 'Ir. LM. FAJAR ISRAWAN, S.Kom., M.Kom., M.M.';
                if (!penguji2Name) penguji2Name = 'NURUL HIDAYAH, S.Kom., M.Kom.';
                if (!penguji3Name) penguji3Name = 'Ir. JABAL NUR, S.Kom., M.T.';

                const namaMhs = (mahasiswa && mahasiswa.nama_lengkap) ? mahasiswa.nama_lengkap.toUpperCase() : (pengajuan.mhs_nama ? pengajuan.mhs_nama.toUpperCase() : 'MUHAMMAD FARIS PRATAMA');
                const nimMhs = (mahasiswa && mahasiswa.nim) ? mahasiswa.nim : (pengajuan.mhs_nim ? pengajuan.mhs_nim : '22650025');
                const judulSkripsi = approvedTitle || ((mahasiswa && mahasiswa.judul_ta && mahasiswa.judul_ta !== 'null' && mahasiswa.judul_ta !== '-') ? mahasiswa.judul_ta.toUpperCase() : (pengajuan.perihal ? pengajuan.perihal.toUpperCase() : 'APLIKASI MOBILE TERINTEGRASI UNTUK MANAJEMEN DONOR DARAH DI PMI KOTA BAUBAU'));
                const nomorResmi = pengajuan.nomor_surat ? pengajuan.nomor_surat : '005/Q.18/FT-UND/II/2026';
                const dateStr = this.formatDateIndonesian(new Date());

                // ==================== BAGIAN 1: SK DOSEN PEMBIMBING ====================
                if (fs.existsSync(logoPath)) doc.image(logoPath, 40, 36, { width: 62 });
                doc.fontSize(12).font('Helvetica-Bold').text('UNIVERSITAS DAYANU IKHSANUDDIN', 110, 35, { align: 'center' });
                doc.fontSize(14).font('Helvetica-Bold').text('FAKULTAS TEKNIK', 110, 50, { align: 'center' });
                doc.fontSize(8.5).font('Helvetica').text('Jl. Sultan Dayanu Ikhsanuddin No. 124 Baubau Telp (0402) 2821327, Fax(0402) 2826682 Baubau 93724', 110, 68, { align: 'center' });

                doc.moveTo(40, 82).lineTo(555, 82).lineWidth(2).stroke('#000000');
                doc.moveTo(40, 85).lineTo(555, 85).lineWidth(0.8).stroke('#000000');

                doc.y = 95;
                doc.fontSize(11).font('Helvetica-Bold').text('SURAT KEPUTUSAN', 40, doc.y, { align: 'center' });
                doc.fontSize(10.5).font('Helvetica-Bold').text('DEKAN FAKULTAS TEKNIK UNIVERSITAS DAYANU IKHSANUDDIN', 40, doc.y + 2, { align: 'center' });
                doc.fontSize(10).font('Helvetica').text(`NOMOR : ${nomorResmi}`, 40, doc.y + 2, { align: 'center' });

                doc.moveDown(0.4);
                doc.fontSize(10).font('Helvetica-Bold').text('TENTANG', { align: 'center' });
                doc.fontSize(10.5).font('Helvetica-Bold').text('PENETAPAN PEMBIMBING TUGAS AKHIR MAHASISWA PROGRAM STRATA SATU', { align: 'center' });
                doc.fontSize(10).font('Helvetica-Bold').text(`A.N : ${namaMhs}  NOMOR INDUK : ${nimMhs}`, { align: 'center' });
                doc.fontSize(10).font('Helvetica-Bold').text('PROGRAM STUDI TEKNIK INFORMATIKA', { align: 'center' });

                doc.moveDown(0.4);
                doc.fontSize(9.5).font('Helvetica-Oblique').text('Dengan Rahmat Tuhan Yang Maha Esa', { align: 'center' });
                doc.fontSize(10).font('Helvetica-Bold').text('DEKAN FAKULTAS TEKNIK UNIVERSITAS DAYANU IKHSANUDDIN', { align: 'center' });

                const colHeaderX = 40;
                const colColonX = 120;
                const colContentX = 130;
                const contentWidth = 425;
                let curY = doc.y + 4;

                doc.fontSize(9.5).font('Helvetica-Bold').text('Menimbang', colHeaderX, curY);
                doc.text(':', colColonX, curY);
                doc.font('Helvetica').text(`a. Bahwa dalam rangka pelaksanaan Bimbingan Tugas Akhir (Skripsi) bagi Sdr. ${namaMhs} Nomor Induk ${nimMhs} Mahasiswa Program Studi Teknik Informatika, maka dipandang perlu mengangkat Pembimbing Utama dan Pembimbing Pendamping.`, colContentX, curY, { width: contentWidth, align: 'justify', lineGap: 2 });

                curY = doc.y + 3;
                doc.font('Helvetica').text('b. Bahwa berdasarkan pada huruf (a) diatas, perlu ditetapkan dalam Surat Keputusan Dekan Fakultas Teknik Universitas Dayanu Ikhsanuddin..', colContentX, curY, { width: contentWidth, align: 'justify', lineGap: 2 });

                curY = doc.y + 5;
                doc.font('Helvetica-Bold').text('Mengingat', colHeaderX, curY);
                doc.text(':', colColonX, curY);
                doc.font('Helvetica').text('1. Peraturan Pemerintah Republik Indonesia Nomor 37 Tahun 2009, tentang Dosen', colContentX, curY, { width: contentWidth });
                curY = doc.y + 2.5;
                doc.text('2. Keputusan Rektor Nomor : 4/Q.13/UND/I/2022, tentang Peraturan Akademik Universitas Dayanu Ikhsanuddin', colContentX, curY, { width: contentWidth });

                curY = doc.y + 5;
                doc.font('Helvetica-Bold').text('Memperhatikan', colHeaderX, curY);
                doc.text(':', colColonX, curY);
                doc.font('Helvetica').text('Surat Ketua Program Studi Teknik Informatika Nomor : 235.1/Q.18/TI-UND/II/2026 tentang Usulan Dosen Pembimbing Tugas Akhir mahasiswa.', colContentX, curY, { width: contentWidth, align: 'justify' });

                curY = doc.y + 6;
                doc.font('Helvetica-Bold').text('MEMUTUSKAN', 40, curY, { align: 'center' });

                curY = doc.y + 5;
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
                doc.font('Helvetica-Bold').text(`1. ${p1Name}`, colContentX + 15, curY); doc.font('Helvetica-Bold').text('( Pembimbing Utama )', colContentX + 250, curY);
                curY = doc.y + 2.5;
                doc.font('Helvetica-Bold').text(`2. ${p2Name}`, colContentX + 15, curY); doc.font('Helvetica-Bold').text('( Pembimbing Pendamping )', colContentX + 250, curY);

                const rightX = 350;
                const ttdY = doc.y + 10;
                doc.fontSize(9.5).font('Helvetica').text('Ditetapkan di : Baubau', rightX, ttdY);
                doc.text(`Pada tanggal : ${dateStr}`, rightX, ttdY + 11);
                doc.font('Helvetica-Bold').text('Dekan,', rightX, ttdY + 22);

                const dekanTtdPath = resolveUploadPath(pengajuan && pengajuan.ttd_dekan_path) || resolveUploadPath('uploads/signatures/ttd_dekan_default.png');
                if (dekanTtdPath) doc.image(dekanTtdPath, rightX, ttdY + 34, { width: 95, height: 45 });
                doc.image(qrBuffer, rightX + 105, ttdY + 29, { width: 65, height: 65 });

                const namaDekan = 'Ir. HILDA SULAIMAN NUR, S.T., M.T.';
                const nidnDekan = '0916076602';
                doc.fontSize(9.5).font('Helvetica-Bold').text(namaDekan, rightX, ttdY + 88, { underline: true });
                doc.fontSize(9).font('Helvetica').text(`NIDN. ${nidnDekan}`, rightX, ttdY + 101);

                // ==================== BAGIAN 2: SK DOSEN PENGUJI (PAGE BARU) ====================
                doc.addPage();

                if (fs.existsSync(logoPath)) doc.image(logoPath, 40, 36, { width: 62 });
                doc.fontSize(12).font('Helvetica-Bold').text('UNIVERSITAS DAYANU IKHSANUDDIN', 110, 35, { align: 'center' });
                doc.fontSize(14).font('Helvetica-Bold').text('FAKULTAS TEKNIK', 110, 50, { align: 'center' });
                doc.fontSize(8.5).font('Helvetica').text('Jl. Sultan Dayanu Ikhsanuddin No. 124 Baubau Telp (0402) 2821327, Fax(0402) 2826682 Baubau 93724', 110, 68, { align: 'center' });

                doc.moveTo(40, 82).lineTo(555, 82).lineWidth(2).stroke('#000000');
                doc.moveTo(40, 85).lineTo(555, 85).lineWidth(0.8).stroke('#000000');

                doc.y = 95;
                doc.fontSize(11).font('Helvetica-Bold').text('SURAT KEPUTUSAN', 40, doc.y, { align: 'center' });
                doc.fontSize(10.5).font('Helvetica-Bold').text('DEKAN FAKULTAS TEKNIK UNIVERSITAS DAYANU IKHSANUDDIN', 40, doc.y + 2, { align: 'center' });
                doc.fontSize(10).font('Helvetica').text(`NOMOR : ${nomorResmi}`, 40, doc.y + 2, { align: 'center' });

                doc.moveDown(0.4);
                doc.fontSize(10).font('Helvetica-Bold').text('TENTANG', { align: 'center' });
                doc.fontSize(10.5).font('Helvetica-Bold').text('PENETAPAN PENGUJI TUGAS AKHIR MAHASISWA PROGRAM STRATA SATU', { align: 'center' });
                doc.fontSize(10).font('Helvetica-Bold').text(`A.N : ${namaMhs}  NOMOR INDUK: ${nimMhs}`, { align: 'center' });
                doc.fontSize(10).font('Helvetica-Bold').text('PROGRAM STUDI TEKNIK INFORMATIKA', { align: 'center' });

                doc.moveDown(0.4);
                doc.fontSize(9.5).font('Helvetica-Oblique').text('Dengan Rahmat Tuhan Yang Maha Esa', { align: 'center' });
                doc.fontSize(10).font('Helvetica-Bold').text('DEKAN FAKULTAS TEKNIK UNIVERSITAS DAYANU IKHSANUDDIN', { align: 'center' });

                curY = doc.y + 4;
                doc.fontSize(9.5).font('Helvetica-Bold').text('Menimbang', colHeaderX, curY);
                doc.text(':', colColonX, curY);
                doc.font('Helvetica').text(`a. Bahwa dalam rangka pelaksanaan Pengujian Tugas Akhir (Skripsi) bagi Sdr. ${namaMhs} Nomor Induk ${nimMhs} Mahasiswa Program Studi Teknik Informatika, maka dipandang perlu mengangkat Penguji.`, colContentX, curY, { width: contentWidth, align: 'justify', lineGap: 2 });

                curY = doc.y + 3;
                doc.font('Helvetica').text('b. Bahwa berdasarkan pada huruf (a) diatas, perlu ditetapkan dalam Surat Keputusan Dekan Fakultas Teknik Universitas Dayanu Ikhsanuddin..', colContentX, curY, { width: contentWidth, align: 'justify', lineGap: 2 });

                curY = doc.y + 5;
                doc.font('Helvetica-Bold').text('Mengingat', colHeaderX, curY);
                doc.text(':', colColonX, curY);
                doc.font('Helvetica').text('1. Peraturan Pemerintah Republik Indonesia Nomor 37 Tahun 2009, tentang Dosen', colContentX, curY, { width: contentWidth });
                curY = doc.y + 2.5;
                doc.text('2. Keputusan Rektor Nomor : 96/Q.13/UND/XII/2016, tentang Peraturan Akademik Universitas Dayanu Ikhsanuddin', colContentX, curY, { width: contentWidth });

                curY = doc.y + 5;
                doc.font('Helvetica-Bold').text('Memperhatikan', colHeaderX, curY);
                doc.text(':', colColonX, curY);
                doc.font('Helvetica').text('Surat Ketua Program Studi Teknik Informatika Nomor : 230/Q.18/TI-UND/II/2026 tentang Usulan Dosen Penguji Tugas Akhir Mahasiswa.', colContentX, curY, { width: contentWidth, align: 'justify' });

                curY = doc.y + 6;
                doc.font('Helvetica-Bold').text('MEMUTUSKAN', 40, curY, { align: 'center' });

                curY = doc.y + 5;
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
                doc.font('Helvetica-Bold').text(`1. ${penguji1Name}`, colContentX + 15, curY); doc.font('Helvetica-Bold').text('( Ketua Penguji )', colContentX + 250, curY);
                curY = doc.y + 2.5;
                doc.font('Helvetica-Bold').text(`2. ${penguji2Name}`, colContentX + 15, curY); doc.font('Helvetica-Bold').text('( Anggota Penguji )', colContentX + 250, curY);
                curY = doc.y + 2.5;
                doc.font('Helvetica-Bold').text(`3. ${penguji3Name}`, colContentX + 15, curY); doc.font('Helvetica-Bold').text('( Anggota Penguji )', colContentX + 250, curY);

                curY = doc.y + 6;
                doc.font('Helvetica-Bold').text('Kedua', colHeaderX, curY); doc.text(':', colColonX, curY);
                doc.font('Helvetica').text('Segala Biaya yang timbul sehubungan dengan Surat keputusan ini di bebankan pada Anggaran Rutin Universitas Dayanu Ikhsanuddin Baubau;', colContentX, curY, { width: contentWidth, align: 'justify' });

                curY = doc.y + 4;
                doc.font('Helvetica-Bold').text('Ketiga', colHeaderX, curY); doc.text(':', colColonX, curY);
                doc.font('Helvetica').text('Surat Keputusan ini berlaku sejak tanggal ditetapkan, dan apabila terdapat kekeliruan didalamnya akan di tinjau kembali dan diperbaiki sebagaimana mestinya.', colContentX, curY, { width: contentWidth, align: 'justify' });

                const ttdY2 = doc.y + 10;
                doc.fontSize(9.5).font('Helvetica').text('Ditetapkan di : Baubau', rightX, ttdY2);
                doc.text(`Pada tanggal : ${dateStr}`, rightX, ttdY2 + 11);
                doc.font('Helvetica-Bold').text('Dekan,', rightX, ttdY2 + 22);

                const dekanTtdPath2 = (customDekanTtd && fs.existsSync(customDekanTtd)) ? customDekanTtd : (fs.existsSync(defaultDekanTtd) ? defaultDekanTtd : null);
                if (dekanTtdPath2) doc.image(dekanTtdPath2, rightX, ttdY2 + 34, { width: 95, height: 45 });
                doc.image(qrBuffer, rightX + 105, ttdY2 + 29, { width: 65, height: 65 });

                doc.fontSize(9.5).font('Helvetica-Bold').text(namaDekan, rightX, ttdY2 + 88, { underline: true });
                doc.fontSize(9).font('Helvetica').text(`NIDN. ${nidnDekan}`, rightX, ttdY2 + 101);

                doc.end();
            } catch (err) {
                console.error('Error generating SK Pembimbing & Penguji PDF:', err);
                reject(err);
            }
        });
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
                const dekanTtdPath = resolveUploadPath(pengajuan && pengajuan.ttd_dekan_path) || resolveUploadPath('uploads/signatures/ttd_dekan_default.png');
                if (dekanTtdPath) {
                    doc.image(dekanTtdPath, rightX, ttdY + sigOffset, { width: 95, height: 45 });
                }
                doc.image(qrBuffer, rightX + 105, ttdY + sigOffset - 5, { width: 65, height: 65 });

                const namaDekan = 'Ir. HILDA SULAIMAN NUR, S.T., M.T.';
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
                const dekanTtdPath = resolveUploadPath(pengajuan && pengajuan.ttd_dekan_path) || resolveUploadPath('uploads/signatures/ttd_dekan_default.png');
                if (dekanTtdPath) {
                    doc.image(dekanTtdPath, rightX, ttdY + sigOffset, { width: 95, height: 45 });
                }
                doc.image(qrBuffer, rightX + 105, ttdY + sigOffset - 5, { width: 65, height: 65 });

                const namaDekan = 'Ir. HILDA SULAIMAN NUR, S.T., M.T.';
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
     * PDF Template Resmi: Lembar Persetujuan Waktu Seminar / Ujian Akhir
     */
    static generateLembarPersetujuanWaktuPdf({ pengajuan, mahasiswa, kaprodi, verifyUrl, signatureHash }) {
        return new Promise(async (resolve, reject) => {
            try {
                const doc = new PDFDocument({ size: 'A4', margin: 35 });
                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => resolve(Buffer.concat(buffers)));

                const qrBuffer = await QRCode.toBuffer(verifyUrl, {
                    errorCorrectionLevel: 'H',
                    margin: 1,
                    width: 75
                });

                // 1. KOP SURAT UNIDAYAN
                const logoPath = path.join(__dirname, '../../public/images/logo-unidayan.png');
                if (fs.existsSync(logoPath)) {
                    doc.image(logoPath, 45, 30, { width: 55 });
                }

                doc.fontSize(11).font('Helvetica-Bold').text('UNIVERSITAS DAYANU IKHSANUDDIN', 110, 28, { align: 'center' });
                doc.fontSize(12).font('Helvetica-Bold').text('FAKULTAS TEKNIK', 110, 42, { align: 'center' });
                doc.fontSize(11).font('Helvetica-Bold').text('PROGRAM STUDI TEKNIK INFORMATIKA', 110, 56, { align: 'center' });
                doc.fontSize(8).font('Helvetica').text('SK Akreditasi No. 3084/SK/BAN-PT/Ak-PPJ/S/V/2020', 110, 70, { align: 'center' });
                doc.fontSize(8).font('Helvetica').text('Kampus Palagimata : Jl. Sultan Hasanuddin No. 124 Telp (0402) 2821327 Baubau', 110, 81, { align: 'center' });

                // Kop Line
                doc.moveTo(35, 94).lineTo(560, 94).lineWidth(1.8).stroke('#000000');
                doc.moveTo(35, 96.5).lineTo(560, 96.5).lineWidth(0.8).stroke('#000000');

                // 2. JUDUL DOKUMEN
                doc.y = 106;
                doc.fontSize(11.5).font('Helvetica-Bold').text('Permohonan Persetujuan Seminar Ujian Akhir', 35, doc.y, { align: 'center' });

                // 3. IDENTITAS MAHASISWA & PEMBIMBING
                let curY = doc.y + 14;
                const labelX = 45;
                const colonX = 160;
                const valX = 170;

                const namaMhs = (mahasiswa && mahasiswa.nama_lengkap) ? mahasiswa.nama_lengkap.toUpperCase() : (pengajuan.mhs_nama ? pengajuan.mhs_nama.toUpperCase() : 'MUHAMMAD FARIS PRATAMA');
                const nimMhs = (mahasiswa && mahasiswa.nim) ? mahasiswa.nim : (pengajuan.mhs_nim ? pengajuan.mhs_nim : '22650025');
                const hpMhs = (mahasiswa && mahasiswa.no_hp) ? mahasiswa.no_hp : '085210423612';

                let dataDinamis = {};
                try {
                    dataDinamis = typeof pengajuan.data_dinamis === 'string' ? JSON.parse(pengajuan.data_dinamis) : pengajuan.data_dinamis;
                } catch (e) {}

                let p1Name = 'Helson Hamid, S.T., M.T.';
                let p2Name = 'Fithriah Musadat, S.Si., M.T.';
                let penguji1Name = 'Muhammad Mukmin, S.Kom., M.T.';
                let penguji2Name = 'LM. Fajar Israwan, S.Kom., M.Kom., M.M.';
                let penguji3Name = 'Asniati, S.T., M.T.';

                if (dataDinamis && dataDinamis.pembimbing_1_id) {
                    const p1 = await DosenModel.findById(dataDinamis.pembimbing_1_id);
                    if (p1) p1Name = p1.nama_dosen;
                }
                if (dataDinamis && dataDinamis.pembimbing_2_id) {
                    const p2 = await DosenModel.findById(dataDinamis.pembimbing_2_id);
                    if (p2) p2Name = p2.nama_dosen;
                }
                if (dataDinamis && dataDinamis.penguji_1_id) {
                    const pg1 = await DosenModel.findById(dataDinamis.penguji_1_id);
                    if (pg1) penguji1Name = pg1.nama_dosen;
                }
                if (dataDinamis && dataDinamis.penguji_2_id) {
                    const pg2 = await DosenModel.findById(dataDinamis.penguji_2_id);
                    if (pg2) penguji2Name = pg2.nama_dosen;
                }
                if (dataDinamis && dataDinamis.penguji_3_id) {
                    const pg3 = await DosenModel.findById(dataDinamis.penguji_3_id);
                    if (pg3) penguji3Name = pg3.nama_dosen;
                }

                const judulTa = (mahasiswa && mahasiswa.judul_ta) ? mahasiswa.judul_ta : (pengajuan.perihal ? pengajuan.perihal : 'Aplikasi Mobile Terintegrasi untuk Manajemen Donor Darah Di PMI Kota Baubau');

                const addRow = (label, val, isBold = false, customY = null) => {
                    const yPos = customY || curY;
                    doc.fontSize(10).font('Helvetica').text(label, labelX, yPos);
                    doc.text(':', colonX, yPos);
                    if (isBold) {
                        doc.font('Helvetica-Bold').text(val, valX, yPos, { width: 380 });
                    } else {
                        doc.font('Helvetica').text(val, valX, yPos, { width: 380 });
                    }
                    curY = doc.y + 4;
                };

                addRow('Nama Mahasiswa', namaMhs, true);
                addRow('No.Stambuk', nimMhs, true);
                addRow('No.Handphone', hpMhs, true);
                addRow('Program Studi', 'TEKNIK INFORMATIKA', true);

                // Dosen Pembimbing Row
                doc.fontSize(10).font('Helvetica').text('Dosen Pembimbing', labelX, curY);
                doc.text(':', colonX, curY);
                doc.font('Helvetica-Bold').text(`1. ${p1Name}`, valX, curY);
                doc.font('Helvetica-Bold').text('(Utama)', valX + 260, curY);
                curY = doc.y + 3;
                doc.font('Helvetica-Bold').text(`2. ${p2Name}`, valX, curY);
                doc.font('Helvetica-Bold').text('(Pendamping)', valX + 260, curY);
                curY = doc.y + 6;

                // Judul Tugas Akhir
                doc.fontSize(10).font('Helvetica').text('Judul Tugas Akhir', labelX, curY);
                doc.text(':', colonX, curY);
                doc.font('Helvetica-BoldOblique').text(judulTa, valX, curY, { width: 380, align: 'justify', lineGap: 2 });
                curY = doc.y + 8;

                // Paragraf Permohonan
                doc.fontSize(9.5).font('Helvetica').text('Mengajukan Permohonan untuk diselenggarakan Seminar Proposal/Hasil/Ujian Akhir. untuk itu, bersama ini terlampir naskah Proposal yang telah disetujui Dosen Pembimbing.', labelX, curY, { width: 510, align: 'justify', lineGap: 2 });

                curY = doc.y + 10;
                // Blok Mahasiswa Sign (Right side)
                const mhsSignRightX = 360;
                doc.fontSize(9.5).font('Helvetica').text('Baubau, ....................', mhsSignRightX, curY);
                curY += 38;
                doc.fontSize(10).font('Helvetica-Bold').text(namaMhs, mhsSignRightX, curY, { underline: true });

                curY += 18;
                // 4. TABEL PERSETUJUAN PENILAIAN
                doc.fontSize(9.5).font('Helvetica').text('Persetujuan Penilaian   :', labelX, curY);
                curY += 12;

                const tableX = 35;
                const colWidths = [185, 95, 110, 135]; // Total = 525
                const rowHeight = 22;

                const tableTopY = curY;
                const headerHeight = 32;

                // Table Outer Box & Grid Lines
                doc.lineWidth(0.8).strokeColor('#000000');

                // Header Top Box
                doc.rect(tableX, tableTopY, 525, headerHeight).stroke();

                // Vertical Column Dividers in Header
                let xAcc = tableX;
                doc.moveTo(xAcc + colWidths[0], tableTopY).lineTo(xAcc + colWidths[0], tableTopY + headerHeight).stroke();
                xAcc += colWidths[0];

                doc.moveTo(xAcc + colWidths[1], tableTopY).lineTo(xAcc + colWidths[1], tableTopY + headerHeight).stroke();
                xAcc += colWidths[1];

                doc.moveTo(xAcc + colWidths[2], tableTopY).lineTo(xAcc + colWidths[2], tableTopY + headerHeight).stroke();
                xAcc += colWidths[2];

                // Sub-headers horizontal line inside Col 3 & 4
                doc.moveTo(tableX + colWidths[0] + colWidths[1], tableTopY + 16).lineTo(tableX + 525, tableTopY + 16).stroke();

                // Sub-header vertical dividers for Col 3 (Penerimaan Naskah)
                const col3X = tableX + colWidths[0] + colWidths[1];
                doc.moveTo(col3X + 60, tableTopY + 16).lineTo(col3X + 60, tableTopY + headerHeight).stroke();

                // Sub-header vertical dividers for Col 4 (Persetujuan Waktu Seminar)
                const col4X = col3X + colWidths[2];
                doc.moveTo(col4X + 45, tableTopY + 16).lineTo(col4X + 45, tableTopY + headerHeight).stroke();
                doc.moveTo(col4X + 85, tableTopY + 16).lineTo(col4X + 85, tableTopY + headerHeight).stroke();

                // Header Texts
                doc.fontSize(9.5).font('Helvetica-Bold');
                doc.text('Nama', tableX + 5, tableTopY + 10, { width: colWidths[0] - 10, align: 'center' });
                doc.text('Jabatan', tableX + colWidths[0] + 5, tableTopY + 10, { width: colWidths[1] - 10, align: 'center' });
                doc.text('Penerimaan Naskah', col3X + 2, tableTopY + 3, { width: colWidths[2] - 4, align: 'center' });
                doc.text('Persetujuan Waktu Seminar', col4X + 2, tableTopY + 3, { width: colWidths[3] - 4, align: 'center' });

                doc.fontSize(8.5).font('Helvetica-Bold');
                doc.text('Tanggal', col3X + 2, tableTopY + 19, { width: 56, align: 'center' });
                doc.text('Paraf', col3X + 62, tableTopY + 19, { width: 46, align: 'center' });

                doc.text('Tanggal', col4X + 2, tableTopY + 19, { width: 41, align: 'center' });
                doc.text('Jam', col4X + 47, tableTopY + 19, { width: 36, align: 'center' });
                doc.text('Tanda Tangan', col4X + 87, tableTopY + 19, { width: 46, align: 'center' });

                // Rows Content
                const tableRows = [
                    { nama: p1Name, jabatan: 'Pembimbing I' },
                    { nama: p2Name, jabatan: 'Pembimbing II' },
                    { nama: penguji1Name, jabatan: 'Penguji I' },
                    { nama: penguji2Name, jabatan: 'Penguji II' },
                    { nama: penguji3Name, jabatan: 'Penguji III' }
                ];

                let rowY = tableTopY + headerHeight;

                tableRows.forEach(r => {
                    const currRowH = (r.nama.length > 32) ? 26 : rowHeight;
                    doc.rect(tableX, rowY, 525, currRowH).stroke();

                    // Vertical Dividers
                    doc.moveTo(tableX + colWidths[0], rowY).lineTo(tableX + colWidths[0], rowY + currRowH).stroke();
                    doc.moveTo(col3X, rowY).lineTo(col3X, rowY + currRowH).stroke();
                    doc.moveTo(col3X + 60, rowY).lineTo(col3X + 60, rowY + currRowH).stroke();
                    doc.moveTo(col4X, rowY).lineTo(col4X, rowY + currRowH).stroke();
                    doc.moveTo(col4X + 45, rowY).lineTo(col4X + 45, rowY + currRowH).stroke();
                    doc.moveTo(col4X + 85, rowY).lineTo(col4X + 85, rowY + currRowH).stroke();

                    // Text Content
                    doc.fontSize(9).font('Helvetica-Bold').text(r.nama, tableX + 6, rowY + 5, { width: colWidths[0] - 12 });
                    doc.fontSize(9).font('Helvetica').text(r.jabatan, tableX + colWidths[0] + 6, rowY + 5, { width: colWidths[1] - 12, align: 'center' });

                    rowY += currRowH;
                });

                curY = rowY + 12;

                // 5. TEMPAT UJIAN / WAKTU
                doc.fontSize(9.5).font('Helvetica').text('Tempat Ujian / Waktu   : ....................................................................................................................................', labelX, curY);

                curY += 24;

                // 6. BOTTOM CATATAN & KAPRODI SIGNATURE BLOCK
                const catatanLeftX = 45;
                const kaprodiRightX = 360;

                // Left Catatan
                doc.fontSize(8.5).font('Helvetica-Bold').text('Catatan :', catatanLeftX, curY);
                let catY = curY + 12;
                doc.fontSize(8).font('Helvetica');
                doc.text('*  Proposal Telah disetujui oleh Dosen Pembimbing', catatanLeftX, catY); catY += 11;
                doc.text('*  Tanggal Penyelenggaraan Seminar 7 s/d 15 Hari Setelah Naskah diterima', catatanLeftX, catY); catY += 11;
                doc.text('*  Aktif mengikuti seminar yang diselenggarakan oleh Fakultas Teknik Prodi Teknik Informatika', catatanLeftX, catY); catY += 11;
                doc.text('*  Telah Melunasi SPP', catatanLeftX, catY);

                // Right Kaprodi
                doc.fontSize(9.5).font('Helvetica').text('Deketahui :', kaprodiRightX, curY);
                doc.text('Plt. Ketua Program Studi,', kaprodiRightX, curY + 12);

                let sigOffset = 24;
                if (pengajuan && pengajuan.ttd_kaprodi_path) {
                    const kaprodiTtdPath = path.join(__dirname, '../../public', pengajuan.ttd_kaprodi_path);
                    if (fs.existsSync(kaprodiTtdPath)) {
                        doc.image(kaprodiTtdPath, kaprodiRightX, curY + sigOffset, { width: 90, height: 42 });
                    }
                }
                doc.image(qrBuffer, kaprodiRightX + 98, curY + sigOffset - 4, { width: 60, height: 60 });

                const namaKaprodi = (kaprodi && kaprodi.nama_dosen) ? kaprodi.nama_dosen : 'Prof. Dr. RASMUIN, S.Pd., M.Pd.';
                const nipKaprodi = (kaprodi && kaprodi.nip_nidn) ? kaprodi.nip_nidn : '196812311994031012';

                doc.fontSize(9.5).font('Helvetica-Bold').text(namaKaprodi, kaprodiRightX, curY + 75, { underline: true });
                doc.fontSize(9).font('Helvetica').text(`NIP. ${nipKaprodi}`, kaprodiRightX, curY + 88);

                // Footer Digital Verification
                const footerY = 790;
                doc.moveTo(35, footerY).lineTo(560, footerY).lineWidth(0.5).stroke('#A0A0A0');
                doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#555555')
                    .text('Dokumen Lembar Persetujuan Waktu Seminar Ujian Akhir FT UNIDAYAN sah diterbitkan secara digital & dilindungi E-Signature QR Code.', 35, footerY + 4, { align: 'center' });
                doc.text(`Verifikasi Keaslian Publik: ${verifyUrl}`, 35, footerY + 13, { align: 'center' });

                doc.end();
            } catch (err) {
                console.error('Error generating Lembar Persetujuan Waktu PDF:', err);
                reject(err);
            }
        });
    }

    /**
     * PDF Template Resmi: Kartu Bimbingan Tugas Akhir / Skripsi (2 Halaman)
     */
    static generateKartuBimbinganPdf({ pengajuan, mahasiswa, kaprodi, verifyUrl, signatureHash }) {
        return new Promise(async (resolve, reject) => {
            try {
                const doc = new PDFDocument({ size: 'A4', margin: 35 });
                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => resolve(Buffer.concat(buffers)));

                const qrBuffer = await QRCode.toBuffer(verifyUrl, {
                    errorCorrectionLevel: 'H',
                    margin: 1,
                    width: 70
                });

                // ==================== HALAMAN 1 ====================
                // 1. KOP SURAT UNIDAYAN
                const logoPath = path.join(__dirname, '../../public/images/logo-unidayan.png');
                if (fs.existsSync(logoPath)) {
                    doc.image(logoPath, 45, 28, { width: 55 });
                }

                doc.fontSize(11).font('Helvetica-Bold').text('UNIVERSITAS DAYANU IKHSANUDDIN', 110, 26, { align: 'center' });
                doc.fontSize(12).font('Helvetica-Bold').text('FAKULTAS TEKNIK', 110, 40, { align: 'center' });
                doc.fontSize(11).font('Helvetica-Bold').text('PROGRAM STUDI TEKNIK INFORMATIKA', 110, 54, { align: 'center' });
                doc.fontSize(8).font('Helvetica').text('Terakreditasi (S-1) No. 3084/SK/BAN-PT/Ak-PPJ/S/V/2020', 110, 68, { align: 'center' });
                doc.fontSize(8).font('Helvetica').text('Kampus Palagimata : Jl. Sultan Dayanu Ikhsanuddin No.124 Telp.(0402)2821327 Baubau', 110, 79, { align: 'center' });
                doc.fontSize(8).font('Helvetica-Oblique').text('Website : fatek.unidayan.ac.id', 110, 90, { align: 'center' });

                // Kop Line
                doc.moveTo(35, 102).lineTo(560, 102).lineWidth(1.8).stroke('#000000');
                doc.moveTo(35, 104.5).lineTo(560, 104.5).lineWidth(0.8).stroke('#000000');

                // 2. IDENTITAS KARTU BIMBINGAN
                let curY = 114;
                const labelX = 45;
                const colonX = 160;
                const valX = 170;

                let dataDinamis = {};
                try {
                    dataDinamis = typeof pengajuan.data_dinamis === 'string' ? JSON.parse(pengajuan.data_dinamis) : pengajuan.data_dinamis;
                } catch (e) {}

                const db = require('../../config/database');
                const namaMhs = (mahasiswa && mahasiswa.nama_lengkap) ? mahasiswa.nama_lengkap.toUpperCase() : (pengajuan.mhs_nama ? pengajuan.mhs_nama.toUpperCase() : 'MUHAMMAD FARIS PRATAMA');
                const nimMhs = (mahasiswa && mahasiswa.nim) ? mahasiswa.nim : (pengajuan.mhs_nim ? pengajuan.mhs_nim : '22650025');
                
                let judulTa = dataDinamis.judul_ta || (mahasiswa && mahasiswa.judul_ta && mahasiswa.judul_ta !== 'null' && mahasiswa.judul_ta !== '-' ? mahasiswa.judul_ta : '');
                
                let p1Name = dataDinamis.pembimbing_1_nama || '';
                let p2Name = dataDinamis.pembimbing_2_nama || '';

                if (dataDinamis && dataDinamis.pembimbing_1_id && !p1Name) {
                    const p1 = await DosenModel.findById(dataDinamis.pembimbing_1_id);
                    if (p1) p1Name = p1.nama_dosen;
                }
                if (dataDinamis && dataDinamis.pembimbing_2_id && !p2Name) {
                    const p2 = await DosenModel.findById(dataDinamis.pembimbing_2_id);
                    if (p2) p2Name = p2.nama_dosen;
                }

                // Fallback search from database if details are empty
                if (mahasiswa && mahasiswa.id && (!judulTa || !p1Name || !p2Name)) {
                    const approvedProp = await db.get("SELECT * FROM pengajuan_judul_ta WHERE mahasiswa_id = ? AND status = 'diterima' ORDER BY id DESC LIMIT 1", [mahasiswa.id]);
                    const plotting = await db.get("SELECT * FROM plotting_tugas_akhir WHERE mahasiswa_id = ? ORDER BY id DESC LIMIT 1", [mahasiswa.id]);

                    if (!judulTa && approvedProp && approvedProp.judul_ta) judulTa = approvedProp.judul_ta;

                    const p1Id = approvedProp ? approvedProp.dosen_pembimbing_1_id : (plotting ? plotting.dosen_pembimbing_1_id : null);
                    const p2Id = approvedProp ? approvedProp.dosen_pembimbing_2_id : (plotting ? plotting.dosen_pembimbing_2_id : null);

                    if (!p1Name && p1Id) {
                        const p1 = await DosenModel.findById(p1Id);
                        if (p1) p1Name = p1.nama_dosen;
                    }
                    if (!p2Name && p2Id) {
                        const p2 = await DosenModel.findById(p2Id);
                        if (p2) p2Name = p2.nama_dosen;
                    }
                }

                if (!judulTa) judulTa = pengajuan.perihal || 'Tugas Akhir / Skripsi';
                if (!p1Name) p1Name = 'Ir. MOH. ARIF SURYAWAN, S.Kom., M.T.';
                if (!p2Name) p2Name = 'Ir. ASNIATI, S.T., M.T.';

                const addRow = (label, val, isBold = false) => {
                    doc.fontSize(10).font('Helvetica-Bold').text(label, labelX, curY);
                    doc.font('Helvetica-Bold').text(':', colonX, curY);
                    if (isBold) {
                        doc.font('Helvetica-Bold').text(val, valX, curY, { width: 380 });
                    } else {
                        doc.font('Helvetica').text(val, valX, curY, { width: 380 });
                    }
                    curY = doc.y + 3.5;
                };

                const pembimbingRole = dataDinamis && dataDinamis.pembimbing_role ? parseInt(dataDinamis.pembimbing_role, 10) : 1;

                let targetDosenName = '';
                if (pembimbingRole === 2) {
                    targetDosenName = (dataDinamis && dataDinamis.pembimbing_nama) ? dataDinamis.pembimbing_nama : ((dataDinamis && dataDinamis.pembimbing_2_nama) ? dataDinamis.pembimbing_2_nama : p2Name);
                    targetDosenName += ' (Pendamping)';
                } else {
                    targetDosenName = (dataDinamis && dataDinamis.pembimbing_nama) ? dataDinamis.pembimbing_nama : ((dataDinamis && dataDinamis.pembimbing_1_nama) ? dataDinamis.pembimbing_1_nama : p1Name);
                    targetDosenName += ' (Utama)';
                }

                addRow('Nama Mahasiswa', namaMhs, true);
                addRow('NIM', nimMhs, true);
                addRow('Fakultas/ Prodi', 'Teknik / Teknik Informatika', true);
                addRow('Jenjang Program', 'Strata Satu ( S-1)', true);
                addRow('Judul Tugas Akhir', judulTa, true);
                addRow('Mata Kuliah', 'Tugas Akhir / Skripsi', true);
                addRow('Dosen Pembimbing', targetDosenName, true);

                curY += 6;

                // 3. TABEL ASISTENSI (PAGE 1)
                const tableX = 35;
                const colWidths = [30, 115, 230, 80, 70]; // Total = 525
                const headerH = 26;
                const rowH = 24;
                const numRowsP1 = 18; // 18 rows on Page 1

                let tableTopY = curY;
                doc.lineWidth(0.8).strokeColor('#000000');

                // Header Box
                doc.rect(tableX, tableTopY, 525, headerH).stroke();

                // Vertical Dividers Header
                let xAcc = tableX;
                doc.moveTo(xAcc + colWidths[0], tableTopY).lineTo(xAcc + colWidths[0], tableTopY + headerH).stroke(); xAcc += colWidths[0];
                doc.moveTo(xAcc + colWidths[1], tableTopY).lineTo(xAcc + colWidths[1], tableTopY + headerH).stroke(); xAcc += colWidths[1];
                doc.moveTo(xAcc + colWidths[2], tableTopY).lineTo(xAcc + colWidths[2], tableTopY + headerH).stroke(); xAcc += colWidths[2];
                doc.moveTo(xAcc + colWidths[3], tableTopY).lineTo(xAcc + colWidths[3], tableTopY + headerH).stroke();

                // Header Titles
                doc.fontSize(9).font('Helvetica-Bold');
                doc.text('No.', tableX, tableTopY + 8, { width: colWidths[0], align: 'center' });
                doc.text('Tanggal Asistensi', tableX + colWidths[0], tableTopY + 8, { width: colWidths[1], align: 'center' });
                doc.text('Koreksi / Keterangan', tableX + colWidths[0] + colWidths[1], tableTopY + 8, { width: colWidths[2], align: 'center' });
                doc.text('Paraf Dosen\nPembimbing', tableX + colWidths[0] + colWidths[1] + colWidths[2], tableTopY + 3, { width: colWidths[3], align: 'center' });
                doc.text('Paraf\nMahasiswa', tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableTopY + 3, { width: colWidths[4], align: 'center' });

                let rY = tableTopY + headerH;
                for (let i = 1; i <= numRowsP1; i++) {
                    doc.rect(tableX, rY, 525, rowH).stroke();
                    let xPos = tableX;
                    colWidths.forEach(w => {
                        doc.moveTo(xPos + w, rY).lineTo(xPos + w, rY + rowH).stroke();
                        xPos += w;
                    });
                    doc.fontSize(8.5).font('Helvetica').text(`${i}.`, tableX + 2, rY + 7, { width: colWidths[0] - 4, align: 'center' });
                    rY += rowH;
                }

                // ==================== HALAMAN 2 ====================
                doc.addPage({ size: 'A4', margin: 35 });

                let rY2 = 40;
                const numRowsP2 = 24; // 24 rows on Page 2

                // Header Page 2
                doc.rect(tableX, rY2, 525, headerH).stroke();
                let xAcc2 = tableX;
                doc.moveTo(xAcc2 + colWidths[0], rY2).lineTo(xAcc2 + colWidths[0], rY2 + headerH).stroke(); xAcc2 += colWidths[0];
                doc.moveTo(xAcc2 + colWidths[1], rY2).lineTo(xAcc2 + colWidths[1], rY2 + headerH).stroke(); xAcc2 += colWidths[1];
                doc.moveTo(xAcc2 + colWidths[2], rY2).lineTo(xAcc2 + colWidths[2], rY2 + headerH).stroke(); xAcc2 += colWidths[2];
                doc.moveTo(xAcc2 + colWidths[3], rY2).lineTo(xAcc2 + colWidths[3], rY2 + headerH).stroke();

                doc.fontSize(9).font('Helvetica-Bold');
                doc.text('No.', tableX, rY2 + 8, { width: colWidths[0], align: 'center' });
                doc.text('Tanggal Asistensi', tableX + colWidths[0], rY2 + 8, { width: colWidths[1], align: 'center' });
                doc.text('Koreksi / Keterangan', tableX + colWidths[0] + colWidths[1], rY2 + 8, { width: colWidths[2], align: 'center' });
                doc.text('Paraf Dosen\nPembimbing', tableX + colWidths[0] + colWidths[1] + colWidths[2], rY2 + 3, { width: colWidths[3], align: 'center' });
                doc.text('Paraf\nMahasiswa', tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], rY2 + 3, { width: colWidths[4], align: 'center' });

                rY2 += headerH;
                for (let i = numRowsP1 + 1; i <= numRowsP1 + numRowsP2; i++) {
                    doc.rect(tableX, rY2, 525, rowH).stroke();
                    let xPos = tableX;
                    colWidths.forEach(w => {
                        doc.moveTo(xPos + w, rY2).lineTo(xPos + w, rY2 + rowH).stroke();
                        xPos += w;
                    });
                    doc.fontSize(8.5).font('Helvetica').text(`${i}.`, tableX + 2, rY2 + 7, { width: colWidths[0] - 4, align: 'center' });
                    rY2 += rowH;
                }

                // Footer Keterangan Cetak (Bottom Left Page 2)
                let ketY = rY2 + 15;
                doc.fontSize(9).font('Helvetica').text('Keterangan :', 45, ketY);
                ketY += 12;
                doc.fontSize(9.5).font('Helvetica-Bold').text('Kartu diatas dicetak 2 sisi dalam 1 Lembar kertas jilid warna putih', 45, ketY, { underline: true });

                // Footer Digital Verification
                const footerY = 790;
                doc.moveTo(35, footerY).lineTo(560, footerY).lineWidth(0.5).stroke('#A0A0A0');
                doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#555555')
                    .text('Dokumen Resmi Kartu Bimbingan TA FT UNIDAYAN sah diterbitkan secara digital & dilindungi E-Signature QR Code.', 35, footerY + 4, { align: 'center' });
                doc.text(`Verifikasi Keaslian Publik: ${verifyUrl}`, 35, footerY + 13, { align: 'center' });

                doc.end();
            } catch (err) {
                console.error('Error generating Kartu Bimbingan PDF:', err);
                reject(err);
            }
        });
    }

    /**
     * PDF Template Resmi: Surat Undangan Seminar (Sempro / Semhas / Sidang Akhir)
     */
    static generateSuratUndanganSeminarPdf({ pengajuan, mahasiswa, kaprodi, verifyUrl, signatureHash }) {
        return new Promise(async (resolve, reject) => {
            try {
                const doc = new PDFDocument({ size: 'A4', margin: 40 });
                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => resolve(Buffer.concat(buffers)));

                const qrBuffer = await QRCode.toBuffer(verifyUrl, {
                    errorCorrectionLevel: 'H',
                    margin: 1,
                    width: 75
                });

                // 1. KOP SURAT UNIDAYAN
                const logoPath = path.join(__dirname, '../../public/images/logo-unidayan.png');
                if (fs.existsSync(logoPath)) {
                    doc.image(logoPath, 45, 30, { width: 58 });
                }

                doc.fontSize(12).font('Helvetica-Bold').text('UNIVERSITAS DAYANU IKHSANUDDIN', 110, 28, { align: 'center' });
                doc.fontSize(13).font('Helvetica-Bold').text('FAKULTAS TEKNIK', 110, 43, { align: 'center' });
                doc.fontSize(12).font('Helvetica-Bold').text('PROGRAM STUDI TEKNIK INFORMATIKA', 110, 58, { align: 'center' });
                doc.fontSize(8.5).font('Helvetica').text('Terakreditasi (S-1) No. 3084/SK/BAN-PT/Ak-PPJ/S/V/2020', 110, 73, { align: 'center' });
                doc.fontSize(8.5).font('Helvetica').text('Kampus Palagimata: Jl. Sultan Dayanu Ikhsanuddin No.124 Telp(0402) 2821327 Baubau', 110, 85, { align: 'center' });

                // Kop Line
                doc.moveTo(40, 98).lineTo(555, 98).lineWidth(2).stroke('#000000');
                doc.moveTo(40, 101).lineTo(555, 101).lineWidth(0.8).stroke('#000000');

                // Determine Category Title
                const kode = pengajuan ? (pengajuan.kode_surat || '') : '';
                const namaSurat = pengajuan ? (pengajuan.nama_surat || '').toLowerCase() : '';

                let halLabel = 'UNDANGAN SEMINAR HASIL';
                let jenisKategoriText = 'Seminar Hasil';

                if (kode.includes('SEMPRO') || namaSurat.includes('proposal') || namaSurat.includes('sempro')) {
                    halLabel = 'UNDANGAN SEMINAR PROPOSAL';
                    jenisKategoriText = 'Seminar Proposal';
                } else if (kode.includes('SIDANG') || namaSurat.includes('sidang') || namaSurat.includes('munaqasyah')) {
                    halLabel = 'UNDANGAN SIDANG AKHIR / MUNAQASYAH';
                    jenisKategoriText = 'Sidang Akhir / Munaqasyah';
                }

                // 2. NOMOR & HAL SURAT
                let curY = 114;
                const nomorResmi = pengajuan.nomor_surat ? pengajuan.nomor_surat : '633/Q20/TI-UND/VI/2026';

                doc.fontSize(10.5).font('Helvetica').text('Nomor', 40, curY);
                doc.text(':', 100, curY);
                doc.text(nomorResmi, 110, curY);

                curY += 14;
                doc.text('Lampiran', 40, curY);
                doc.text(':', 100, curY);
                doc.text('--', 110, curY);

                curY += 14;
                doc.text('Hal', 40, curY);
                doc.text(':', 100, curY);
                doc.font('Helvetica-Bold').text(halLabel, 110, curY, { underline: true });

                curY += 26;

                // 3. MAJELIS PENGUJI ALAMAT TUJUAN
                let dataDinamis = {};
                try {
                    dataDinamis = typeof pengajuan.data_dinamis === 'string' ? JSON.parse(pengajuan.data_dinamis) : pengajuan.data_dinamis;
                } catch (e) {}

                const db = require('../../config/database');
                let p1Name = '';
                let p2Name = '';
                let penguji1Name = '';
                let penguji2Name = '';
                let penguji3Name = '';
                let approvedTitle = '';

                if (mahasiswa && mahasiswa.id) {
                    const approvedProp = await db.get("SELECT * FROM pengajuan_judul_ta WHERE mahasiswa_id = ? AND status = 'diterima' ORDER BY id DESC LIMIT 1", [mahasiswa.id]);
                    const plotting = await db.get("SELECT * FROM plotting_tugas_akhir WHERE mahasiswa_id = ? ORDER BY id DESC LIMIT 1", [mahasiswa.id]);

                    if (approvedProp && approvedProp.judul_ta) approvedTitle = approvedProp.judul_ta.toUpperCase();

                    const p1Id = (dataDinamis && dataDinamis.pembimbing_1_id) || (approvedProp ? approvedProp.dosen_pembimbing_1_id : (plotting ? plotting.dosen_pembimbing_1_id : null));
                    const p2Id = (dataDinamis && dataDinamis.pembimbing_2_id) || (approvedProp ? approvedProp.dosen_pembimbing_2_id : (plotting ? plotting.dosen_pembimbing_2_id : null));

                    const pg1Id = (dataDinamis && dataDinamis.penguji_1_id) || (plotting ? plotting.dosen_penguji_1_id : null);
                    const pg2Id = (dataDinamis && dataDinamis.penguji_2_id) || (plotting ? plotting.dosen_penguji_2_id : null);
                    const pg3Id = (dataDinamis && dataDinamis.penguji_3_id) || (plotting ? plotting.dosen_penguji_3_id : null);

                    if (p1Id) {
                        const p1 = await DosenModel.findById(p1Id);
                        if (p1) p1Name = p1.nama_dosen.toUpperCase();
                    }
                    if (p2Id) {
                        const p2 = await DosenModel.findById(p2Id);
                        if (p2) p2Name = p2.nama_dosen.toUpperCase();
                    }
                    if (pg1Id) {
                        const pg1 = await DosenModel.findById(pg1Id);
                        if (pg1) penguji1Name = pg1.nama_dosen.toUpperCase();
                    }
                    if (pg2Id) {
                        const pg2 = await DosenModel.findById(pg2Id);
                        if (pg2) penguji2Name = pg2.nama_dosen.toUpperCase();
                    }
                    if (pg3Id) {
                        const pg3 = await DosenModel.findById(pg3Id);
                        if (pg3) penguji3Name = pg3.nama_dosen.toUpperCase();
                    }
                }

                if (!p1Name) p1Name = 'Ir. MOH. ARIF SURYAWAN, S.Kom., M.T.';
                if (!p2Name) p2Name = 'Ir. ASNIATI, S.T., M.T.';
                if (!penguji1Name) penguji1Name = 'Ir. LM. FAJAR ISRAWAN, S.Kom., M.Kom., M.M.';
                if (!penguji2Name) penguji2Name = 'NURUL HIDAYAH, S.Kom., M.Kom.';
                if (!penguji3Name) penguji3Name = 'Ir. JABAL NUR, S.Kom., M.T.';

                doc.fontSize(10.5).font('Helvetica').text('Kepada Yth Majelis Penguji,', 40, curY);
                curY += 15;
                doc.fontSize(10.5).font('Helvetica-Bold').text(`1. ${penguji1Name}`, 40, curY);
                curY += 14;
                doc.text(`2. ${penguji2Name}`, 40, curY);
                curY += 14;
                doc.text(`3. ${penguji3Name}`, 40, curY);

                curY += 26;

                // 4. PARAGRAF PEMBUKA
                const namaMhs = (mahasiswa && mahasiswa.nama_lengkap) ? mahasiswa.nama_lengkap.toUpperCase() : (pengajuan.mhs_nama ? pengajuan.mhs_nama.toUpperCase() : 'MUHAMAD ADRIAN');
                const nimMhs = (mahasiswa && mahasiswa.nim) ? mahasiswa.nim : (pengajuan.mhs_nim ? pengajuan.mhs_nim : '22 650 119');
                const judulTa = approvedTitle || ((mahasiswa && mahasiswa.judul_ta && mahasiswa.judul_ta !== 'null' && mahasiswa.judul_ta !== '-') ? mahasiswa.judul_ta.toUpperCase() : (pengajuan.perihal ? pengajuan.perihal.toUpperCase() : 'TUGAS AKHIR / SKRIPSI'));

                doc.fontSize(10.5).font('Helvetica').text('Dengan Hormat,', 40, curY);
                curY += 16;
                doc.fontSize(10.5).font('Helvetica').text(`Kami mengundang Bapak/Ibu, Saudara (i) untuk menghadiri ${jenisKategoriText} bagi saudara (i) `, 40, curY, { continued: true });
                doc.font('Helvetica-Bold').text(namaMhs, { continued: true });
                doc.font('Helvetica').text(' No. Stambuk ', { continued: true });
                doc.font('Helvetica-Bold').text(nimMhs, { continued: true });
                doc.font('Helvetica').text(' Program Studi Teknik Informatika, yang akan dilaksanakan pada :', { align: 'justify', lineGap: 3 });

                curY = doc.y + 14;

                // 5. DETAIL PELAKSANAAN
                const hariTanggal = (dataDinamis && (dataDinamis.hari_tanggal || dataDinamis.tanggal_ujian)) ? (dataDinamis.hari_tanggal || dataDinamis.tanggal_ujian) : "Jum'at, 19 June 2026";
                const pukul = (dataDinamis && (dataDinamis.pukul || dataDinamis.waktu_ujian)) ? (dataDinamis.pukul || dataDinamis.waktu_ujian) : ((dataDinamis && dataDinamis.jam_mulai) ? `${dataDinamis.jam_mulai} - ${dataDinamis.jam_selesai || ''} WITA` : '15:00 Wita s/d Selesai');
                const bertempatDi = (dataDinamis && (dataDinamis.bertempat_di || dataDinamis.ruangan || dataDinamis.ruang_ujian)) ? (dataDinamis.bertempat_di || dataDinamis.ruangan || dataDinamis.ruang_ujian) : 'R. Teknik Informatika';

                const labelColX = 40;
                const colonColX = 145;
                const valColX = 155;

                const addDetailRow = (lbl, val, isBold = false) => {
                    doc.fontSize(10.5).font('Helvetica').text(lbl, labelColX, curY);
                    doc.text(':', colonColX, curY);
                    if (isBold) {
                        doc.font('Helvetica-Bold').text(val, valColX, curY, { width: 400, align: 'justify', lineGap: 2 });
                    } else {
                        doc.font('Helvetica').text(val, valColX, curY, { width: 400, align: 'justify' });
                    }
                    curY = doc.y + 5;
                };

                addDetailRow('Hari/Tanggal', hariTanggal);
                addDetailRow('Pukul', pukul);
                addDetailRow('Bertempat di', bertempatDi);
                addDetailRow('Judul Seminar', judulTa, true);

                // Dosen Pembimbing Row
                doc.fontSize(10.5).font('Helvetica').text('Dosen Pembimbing', labelColX, curY);
                doc.text(':', colonColX, curY);

                curY += 13;
                doc.fontSize(10.5).font('Helvetica').text('Utama', labelColX, curY);
                doc.text(':', colonColX, curY);
                doc.font('Helvetica-Bold').text(p1Name, valColX, curY);

                curY += 13;
                doc.fontSize(10.5).font('Helvetica').text('Pendamping', labelColX, curY);
                doc.text(':', colonColX, curY);
                doc.font('Helvetica-Bold').text(p2Name, valColX, curY);

                curY += 24;

                // 6. PARAGRAF PENUTUP
                doc.fontSize(10.5).font('Helvetica').text('Atas perhatian dan kehadirannya, disampaikan terima kasih.', 40, curY);

                // 7. BLOK TANDA TANGAN KAPRODI
                const rightX = 330;
                const ttdY = curY + 35;
                const dateStr = this.formatDateIndonesian(new Date());

                doc.fontSize(10.5).font('Helvetica').text(`Baubau, ${dateStr}`, rightX, ttdY);
                doc.font('Helvetica-Bold').text('Plt. Kaprodi Teknik Informatika,', rightX, ttdY + 14);

                let sigOffset = 30;
                const kaprodiTtdPath = resolveUploadPath(pengajuan && pengajuan.ttd_kaprodi_path) || resolveUploadPath('uploads/signatures/ttd_kaprodi_default.png');
                if (kaprodiTtdPath) {
                    doc.image(kaprodiTtdPath, rightX, ttdY + sigOffset, { width: 95, height: 45 });
                }
                doc.image(qrBuffer, rightX + 110, ttdY + sigOffset - 4, { width: 68, height: 68 });

                const namaKaprodi = (kaprodi && kaprodi.nama_dosen) ? kaprodi.nama_dosen : 'Prof. Dr. Rasmuin, S.Pd., M.Pd.';
                const nipKaprodi = (kaprodi && kaprodi.nip_nidn) ? kaprodi.nip_nidn : '196812311994031012';

                const nameY = ttdY + 95;
                doc.fontSize(10.5).font('Helvetica-Bold').text(namaKaprodi, rightX, nameY, { underline: true });
                doc.fontSize(10).font('Helvetica-Bold').text(`NIP. ${nipKaprodi}`, rightX, nameY + 15);

                // 8. FOOTER DIGITAL VERIFICATION
                const footerY = 780;
                doc.moveTo(40, footerY).lineTo(555, footerY).lineWidth(0.5).stroke('#A0A0A0');
                doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#555555')
                    .text('Dokumen Resmi Surat Undangan Seminar FT UNIDAYAN sah diterbitkan secara digital & dilindungi E-Signature QR Code.', 40, footerY + 4, { align: 'center' });
                doc.text(`Verifikasi Keaslian Publik: ${verifyUrl}`, 40, footerY + 13, { align: 'center' });

                doc.end();
            } catch (err) {
                console.error('Error generating Surat Undangan Seminar PDF:', err);
                reject(err);
            }
        });
    }

    /**
     * PDF Template Resmi: Berita Acara Ujian / Seminar Tugas Akhir (Lengkap dengan Rekap Nilai & Daftar Hadir)
     */
    static generateBeritaAcaraUjianPdf({ pengajuan, mahasiswa, kaprodi, verifyUrl, signatureHash }) {
        return new Promise(async (resolve, reject) => {
            try {
                const doc = new PDFDocument({ size: 'A4', margin: 35 });
                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => resolve(Buffer.concat(buffers)));

                const qrBuffer = await QRCode.toBuffer(verifyUrl, {
                    errorCorrectionLevel: 'H',
                    margin: 1,
                    width: 70
                });

                const logoPath = path.join(__dirname, '../../public/images/logo-unidayan.png');

                // Dynamic values
                const namaMhs = (mahasiswa && mahasiswa.nama_lengkap) ? mahasiswa.nama_lengkap.toUpperCase() : (pengajuan.mhs_nama ? pengajuan.mhs_nama.toUpperCase() : 'SANJAY PRATAMA TIANLEAN');
                const nimMhs = (mahasiswa && mahasiswa.nim) ? mahasiswa.nim : (pengajuan.mhs_nim ? pengajuan.mhs_nim : '22650128');
                let judulTa = (mahasiswa && mahasiswa.judul_ta) ? mahasiswa.judul_ta.toUpperCase() : (pengajuan.perihal ? pengajuan.perihal.toUpperCase() : 'PENERAPAN TEKNOLOGI GLOBAL POSITIONING SYSTEM (GPS) BERBASIS ANDROID PADA APLIKASI ABSENSI DIGITAL');

                let dataDinamis = {};
                try {
                    dataDinamis = typeof pengajuan.data_dinamis === 'string' ? JSON.parse(pengajuan.data_dinamis) : pengajuan.data_dinamis;
                } catch (e) {}

                let p1Name = 'Ir. LM. FAJAR ISRAWAN, S.Kom., M.Kom., M.M.';
                let p2Name = 'NURUL HIDAYAH, S.Kom., M.Kom.';
                let penguji1Name = 'Ir. JABAL NUR, S.Kom., M.T.';
                let penguji2Name = 'Ir. HENNY HAMSINAR, S.Kom., M.T., M.M.';
                let penguji3Name = 'HELSON HAMID, S.T., M.T.';

                const db = require('../../config/database');
                if (mahasiswa && mahasiswa.id) {
                    const approvedProp = await db.get("SELECT * FROM pengajuan_judul_ta WHERE mahasiswa_id = ? AND status = 'diterima' ORDER BY id DESC LIMIT 1", [mahasiswa.id]);
                    const plotting = await db.get("SELECT * FROM plotting_tugas_akhir WHERE mahasiswa_id = ? ORDER BY id DESC LIMIT 1", [mahasiswa.id]);

                    if (approvedProp && approvedProp.judul_ta) judulTa = approvedProp.judul_ta.toUpperCase();

                    const p1Id = (dataDinamis && dataDinamis.pembimbing_1_id) || (approvedProp ? approvedProp.dosen_pembimbing_1_id : (plotting ? plotting.dosen_pembimbing_1_id : null));
                    const p2Id = (dataDinamis && dataDinamis.pembimbing_2_id) || (approvedProp ? approvedProp.dosen_pembimbing_2_id : (plotting ? plotting.dosen_pembimbing_2_id : null));

                    const pg1Id = (dataDinamis && dataDinamis.penguji_1_id) || (plotting ? plotting.dosen_penguji_1_id : null);
                    const pg2Id = (dataDinamis && dataDinamis.penguji_2_id) || (plotting ? plotting.dosen_penguji_2_id : null);
                    const pg3Id = (dataDinamis && dataDinamis.penguji_3_id) || (plotting ? plotting.dosen_penguji_3_id : null);

                    if (p1Id) {
                        const p1 = await DosenModel.findById(p1Id);
                        if (p1) p1Name = p1.nama_dosen.toUpperCase();
                    }
                    if (p2Id) {
                        const p2 = await DosenModel.findById(p2Id);
                        if (p2) p2Name = p2.nama_dosen.toUpperCase();
                    }
                    if (pg1Id) {
                        const pg1 = await DosenModel.findById(pg1Id);
                        if (pg1) penguji1Name = pg1.nama_dosen.toUpperCase();
                    }
                    if (pg2Id) {
                        const pg2 = await DosenModel.findById(pg2Id);
                        if (pg2) penguji2Name = pg2.nama_dosen.toUpperCase();
                    }
                    if (pg3Id) {
                        const pg3 = await DosenModel.findById(pg3Id);
                        if (pg3) penguji3Name = pg3.nama_dosen.toUpperCase();
                    }
                }

                let hariTanggalVal = (dataDinamis && (dataDinamis.hari_tanggal || dataDinamis.tanggal_ujian)) ? (dataDinamis.hari_tanggal || dataDinamis.tanggal_ujian) : '...............................................';
                let jamVal = (dataDinamis && (dataDinamis.pukul || dataDinamis.waktu_ujian)) ? (dataDinamis.pukul || dataDinamis.waktu_ujian) : ((dataDinamis && dataDinamis.jam_mulai) ? `${dataDinamis.jam_mulai} - ${dataDinamis.jam_selesai || ''} WITA` : '............ WITA');
                let tempatVal = (dataDinamis && (dataDinamis.bertempat_di || dataDinamis.ruangan || dataDinamis.ruang_ujian)) ? (dataDinamis.bertempat_di || dataDinamis.ruangan || dataDinamis.ruang_ujian) : 'Ruang Fakultas Teknik UNIDAYAN';

                // ==================== HALAMAN 1: BERITA ACARA SEMINAR ====================
                if (fs.existsSync(logoPath)) {
                    doc.image(logoPath, 45, 28, { width: 55 });
                }

                doc.fontSize(11).font('Helvetica-Bold').text('UNIVERSITAS DAYANU IKHSANUDDIN', 110, 26, { align: 'center' });
                doc.fontSize(12).font('Helvetica-Bold').text('FAKULTAS TEKNIK', 110, 40, { align: 'center' });
                doc.fontSize(11).font('Helvetica-Bold').text('PROGRAM STUDI TEKNIK INFORMATIKA', 110, 54, { align: 'center' });
                doc.fontSize(8).font('Helvetica').text('Terakreditasi (S-1) No.3084/SK/BAN-PT/Ak-PPJ/S/V/2020', 110, 68, { align: 'center' });
                doc.fontSize(8).font('Helvetica').text('Kampus Palagimata : Jl. Sultan Dayanu Ikhsanuddin No. 124 fax. (0402) 2821138 Baubau', 110, 79, { align: 'center' });

                doc.moveTo(35, 95).lineTo(560, 95).lineWidth(1.8).stroke('#000000');
                doc.moveTo(35, 97.5).lineTo(560, 97.5).lineWidth(0.8).stroke('#000000');

                // Judul Document
                doc.y = 106;
                const kategoriSeminar = (dataDinamis && dataDinamis.jenis_seminar) ? dataDinamis.jenis_seminar.toUpperCase() : (pengajuan.perihal ? pengajuan.perihal.toUpperCase() : 'BERITA ACARA SEMINAR / UJIAN TA');
                doc.fontSize(11.5).font('Helvetica-Bold').text(kategoriSeminar.includes('BERITA ACARA') ? kategoriSeminar : `BERITA ACARA ${kategoriSeminar}`, 35, doc.y, { align: 'center', underline: true });

                let curY = doc.y + 14;
                const labelX = 45;
                const colonX = 145;
                const valX = 155;

                doc.fontSize(10).font('Helvetica').text('Pada hari ini', labelX, curY); doc.text(':', colonX, curY); doc.font('Helvetica-Bold').text(hariTanggalVal, valX, curY); curY += 13;
                doc.font('Helvetica').text('Bertempat', labelX, curY); doc.text(':', colonX, curY); doc.font('Helvetica').text(tempatVal, valX, curY); curY += 13;
                doc.font('Helvetica').text('J a m', labelX, curY); doc.text(':', colonX, curY); doc.font('Helvetica-Bold').text(jamVal, valX, curY); curY += 18;

                doc.fontSize(10.5).font('Helvetica-Bold').text('TELAH DISELENGGARAKAN PROPOSAL', 35, curY, { align: 'center' });
                curY += 18;

                doc.fontSize(10).font('Helvetica').text('Nama', labelX, curY); doc.text(':', colonX, curY); doc.font('Helvetica-Bold').text(namaMhs, valX, curY); doc.font('Helvetica').text('Tanda Tangan  ..........', 390, curY); curY += 14;
                doc.font('Helvetica').text('No. Induk Mahasiswa', labelX, curY); doc.text(':', colonX, curY); doc.font('Helvetica-Bold').text(nimMhs, valX, curY); curY += 14;
                doc.font('Helvetica').text('Program Studi/ Jurusan', labelX, curY); doc.text(':', colonX, curY); doc.text('Teknik Informatika', valX, curY); curY += 14;
                doc.font('Helvetica').text('Perguruan Tinggi', labelX, curY); doc.text(':', colonX, curY); doc.text('Universitas Dayanu Ikhsanuddin (UNIDAYAN) Baubau', valX, curY); curY += 14;
                doc.font('Helvetica').text('Judul Skripsi', labelX, curY); doc.text(':', colonX, curY); doc.font('Helvetica-Bold').text(judulTa, valX, curY, { width: 390, align: 'justify', lineGap: 2 }); curY = doc.y + 6;

                doc.font('Helvetica').text('Dosen Pembimbing', labelX, curY); doc.text(':', colonX, curY);
                doc.font('Helvetica-Bold').text(`1. ${p1Name}`, valX, curY); doc.text('(Utama)', valX + 260, curY); curY += 14;
                doc.font('Helvetica-Bold').text(`2. ${p2Name}`, valX, curY); doc.text('(Pendamping)', valX + 260, curY); curY += 18;

                doc.font('Helvetica').text('Saudara tersebut dinyatakan', labelX, curY); doc.text(':', colonX, curY); doc.font('Helvetica-Bold').text('LULUS / TIDAK LULUS', valX, curY); curY += 14;
                doc.font('Helvetica').text('Dengan Nilai', labelX, curY); doc.text(':', colonX, curY); doc.text('...............................', valX, curY); curY += 14;
                doc.font('Helvetica').text('Huruf', labelX, curY); doc.text(':', colonX, curY); doc.font('Helvetica-Bold').text('A , A- , B+ , B , B- , C+ , C , D , E', valX, curY, { underline: true }); curY += 20;

                // Tabel Susunan Tim Penguji
                doc.fontSize(9.5).font('Helvetica-Bold').text('SUSUNAN TIM PENGUJI', 35, curY, { align: 'center' }); curY += 10;

                const tableX = 50;
                const colW = [35, 235, 115, 110]; // Total = 495
                const rowH = 22;

                doc.lineWidth(0.8).strokeColor('#000000');
                doc.rect(tableX, curY, 495, rowH).stroke();

                let xAcc = tableX;
                doc.moveTo(xAcc + colW[0], curY).lineTo(xAcc + colW[0], curY + rowH).stroke(); xAcc += colW[0];
                doc.moveTo(xAcc + colW[1], curY).lineTo(xAcc + colW[1], curY + rowH).stroke(); xAcc += colW[1];
                doc.moveTo(xAcc + colW[2], curY).lineTo(xAcc + colW[2], curY + rowH).stroke(); xAcc += colW[2];

                doc.fontSize(9).font('Helvetica-Bold');
                doc.text('NO', tableX, curY + 6, { width: colW[0], align: 'center' });
                doc.text('NAMA', tableX + colW[0], curY + 6, { width: colW[1], align: 'center' });
                doc.text('JABATAN DLM TIM', tableX + colW[0] + colW[1], curY + 2, { width: colW[2], align: 'center' });
                doc.text('TANDA TANGAN', tableX + colW[0] + colW[1] + colW[2], curY + 2, { width: colW[3], align: 'center' });

                const timPenguji = [
                    { nama: p1Name, jab: 'Pemb. Utama' },
                    { nama: p2Name, jab: 'Pemb. Pendamping' },
                    { nama: penguji1Name, jab: 'Ketua Penguji' },
                    { nama: penguji2Name, jab: 'Anggota Penguji' },
                    { nama: penguji3Name, jab: 'Anggota Penguji' }
                ];

                let rY = curY + rowH;
                timPenguji.forEach((t, idx) => {
                    doc.rect(tableX, rY, 495, rowH).stroke();
                    let xPos = tableX;
                    colW.forEach(w => { doc.moveTo(xPos + w, rY).lineTo(xPos + w, rY + rowH).stroke(); xPos += w; });
                    doc.fontSize(8.5).font('Helvetica').text(`${idx + 1}.`, tableX, rY + 6, { width: colW[0], align: 'center' });
                    doc.font('Helvetica-Bold').text(t.nama, tableX + colW[0] + 6, rY + 6, { width: colW[1] - 12 });
                    doc.font('Helvetica').text(t.jab, tableX + colW[0] + colW[1], rY + 6, { width: colW[2], align: 'center' });
                    rY += rowH;
                });

                curY = rY + 15;
                doc.fontSize(9.5).font('Helvetica').text('Baubau,................................... 2026', 360, curY); curY += 14;
                doc.text('Mengetahui :', 240, curY); curY += 14;

                doc.fontSize(9.5).font('Helvetica-Bold').text('Pembimbing Utama', 80, curY, { align: 'center', width: 200 });
                doc.text('Pembimbing Pendamping', 320, curY, { align: 'center', width: 200 }); curY += 45;

                doc.fontSize(9.5).font('Helvetica-Bold').text(p1Name, 50, curY, { align: 'center', width: 240, underline: true });
                doc.text(p2Name, 300, curY, { align: 'center', width: 240, underline: true });

                // ==================== HALAMAN 2: REKAPITULASI NILAI SEMINAR ====================
                doc.addPage({ size: 'A4', margin: 35 });

                if (fs.existsSync(logoPath)) {
                    doc.image(logoPath, 45, 28, { width: 55 });
                }

                doc.fontSize(11).font('Helvetica-Bold').text('UNIVERSITAS DAYANU IKHSANUDDIN', 110, 26, { align: 'center' });
                doc.fontSize(12).font('Helvetica-Bold').text('FAKULTAS TEKNIK', 110, 40, { align: 'center' });
                doc.fontSize(11).font('Helvetica-Bold').text('PROGRAM STUDI TEKNIK INFORMATIKA', 110, 54, { align: 'center' });
                doc.fontSize(8).font('Helvetica').text('Terakreditasi (S-1) No.3084/SK/BAN-PT/Ak-PPJ/S/V/2020', 110, 68, { align: 'center' });
                doc.fontSize(8).font('Helvetica').text('Kampus Palagimata : Jl. Sultan Dayanu Ikhsanuddin No. 124 fax. (0402) 2821138 Baubau', 110, 79, { align: 'center' });

                doc.moveTo(35, 95).lineTo(560, 95).lineWidth(1.8).stroke('#000000');
                doc.moveTo(35, 97.5).lineTo(560, 97.5).lineWidth(0.8).stroke('#000000');

                doc.y = 106;
                doc.fontSize(11.5).font('Helvetica-Bold').text('REKAPITULASI\nNILAI SEMINAR PROPOSAL', 35, doc.y, { align: 'center' });

                curY = doc.y + 14;
                doc.fontSize(10).font('Helvetica').text('Nama mahasiswa', labelX, curY); doc.text(':', colonX, curY); doc.font('Helvetica-Bold').text(namaMhs, valX, curY); curY += 14;
                doc.font('Helvetica').text('No. Induk Mahasiswa', labelX, curY); doc.text(':', colonX, curY); doc.font('Helvetica-Bold').text(nimMhs, valX, curY); curY += 14;
                doc.font('Helvetica').text('Program Studi', labelX, curY); doc.text(':', colonX, curY); doc.text('Teknik Informatika', valX, curY); curY += 14;
                doc.font('Helvetica').text('Dosen Pembimbing', labelX, curY); doc.text(':', colonX, curY);
                doc.font('Helvetica-Bold').text(`1. ${p1Name}`, valX, curY); doc.text('(Utama)', valX + 260, curY); curY += 14;
                doc.font('Helvetica-Bold').text(`2. ${p2Name}`, valX, curY); doc.text('(Pendamping)', valX + 260, curY); curY += 14;

                doc.font('Helvetica').text('Judul Penelitian', labelX, curY); doc.text(':', colonX, curY); doc.font('Helvetica-Bold').text(judulTa, valX, curY, { width: 390, align: 'justify', lineGap: 2 }); curY = doc.y + 6;
                doc.font('Helvetica').text('Hari/Tanggal', labelX, curY); doc.text(':', colonX, curY); doc.text('................/............................', valX, curY); curY += 14;
                doc.font('Helvetica').text('Waktu diskusi', labelX, curY); doc.text(':', colonX, curY); doc.text('90 menit', valX, curY); curY += 20;

                // Table Rekap Nilai
                const colW2 = [35, 245, 95, 120]; // Total = 495
                doc.rect(tableX, curY, 495, rowH).stroke();

                doc.fontSize(9).font('Helvetica-Bold');
                doc.text('No.', tableX, curY + 6, { width: colW2[0], align: 'center' });
                doc.text('Nama Penguji', tableX + colW2[0], curY + 6, { width: colW2[1], align: 'center' });
                doc.text('Nilai', tableX + colW2[0] + colW2[1], curY + 6, { width: colW2[2], align: 'center' });
                doc.text('Tanda Tangan', tableX + colW2[0] + colW2[1] + colW2[2], curY + 6, { width: colW2[3], align: 'center' });

                rY = curY + rowH;
                const pengujiList2 = [p1Name, p2Name, penguji1Name, penguji2Name, penguji3Name];
                pengujiList2.forEach((pName, idx) => {
                    doc.rect(tableX, rY, 495, rowH).stroke();
                    let xPos = tableX;
                    colW2.forEach(w => { doc.moveTo(xPos + w, rY).lineTo(xPos + w, rY + rowH).stroke(); xPos += w; });
                    doc.fontSize(8.5).font('Helvetica').text(`${idx + 1}.`, tableX, rY + 6, { width: colW2[0], align: 'center' });
                    doc.font('Helvetica-Bold').text(pName, tableX + colW2[0] + 6, rY + 6, { width: colW2[1] - 12 });
                    doc.font('Helvetica').text('.....................', tableX + colW2[0] + colW2[1], rY + 6, { width: colW2[2], align: 'center' });
                    doc.font('Helvetica').text(`${idx + 1}. ....................`, tableX + colW2[0] + colW2[1] + colW2[2] + 6, rY + 6);
                    rY += rowH;
                });

                // Row Nilai Rata Rata
                doc.rect(tableX, rY, 495, rowH).stroke();
                doc.fontSize(9).font('Helvetica-Bold').text('Nilai Rata-Rata', tableX, rY + 6, { width: colW2[0] + colW2[1], align: 'center' });
                doc.moveTo(tableX + colW2[0] + colW2[1], rY).lineTo(tableX + colW2[0] + colW2[1], rY + rowH).stroke();
                doc.font('Helvetica').text('.....................', tableX + colW2[0] + colW2[1], rY + 6, { width: colW2[2], align: 'center' });
                rY += rowH + 15;

                // Legend Penilaian & TTD Pembimbing Utama
                doc.fontSize(8.5).font('Helvetica-BoldOblique').text('Penilaian Seminar : Nilai Lulus > 70', labelX, rY);
                let legY = rY + 12;
                doc.fontSize(8).font('Helvetica-Oblique');
                doc.text('1.  > 85   = A', labelX, legY); doc.text('4.  > 71 – 75  = B', labelX + 80, legY); doc.text('7.  > 51 – 60  = C', labelX + 170, legY); legY += 10;
                doc.text('2.  > 81 – 85 = A-', labelX, legY); doc.text('5.  > 66 – 70  = B-', labelX + 80, legY); doc.text('8.  > 45 – 50  = D', labelX + 170, legY); legY += 10;
                doc.text('3.  > 76 – 80 = B+', labelX, legY); doc.text('6.  > 61 – 65  = C+', labelX + 80, legY); doc.text('9.  < 45  = E', labelX + 170, legY);

                const signRightX = 350;
                doc.fontSize(9.5).font('Helvetica').text('Baubau, ..................................', signRightX, rY);
                doc.text('Pembimbing Utama,', signRightX, rY + 14);
                doc.fontSize(9.5).font('Helvetica-Bold').text(p1Name, signRightX, rY + 60, { underline: true });

                // Footer Digital Verification
                const footerY = 790;
                doc.moveTo(35, footerY).lineTo(560, footerY).lineWidth(0.5).stroke('#A0A0A0');
                doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#555555')
                    .text('Dokumen Resmi Berita Acara Ujian / Seminar TA FT UNIDAYAN sah diterbitkan secara digital & dilindungi E-Signature QR Code.', 35, footerY + 4, { align: 'center' });
                doc.text(`Verifikasi Keaslian Publik: ${verifyUrl}`, 35, footerY + 13, { align: 'center' });

                doc.end();
            } catch (err) {
                console.error('Error generating Berita Acara Ujian PDF:', err);
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
                const kaprodiTtdPath = resolveUploadPath(pengajuan && pengajuan.ttd_kaprodi_path) || resolveUploadPath('uploads/signatures/ttd_kaprodi_default.png');
                if (kaprodiTtdPath) {
                    doc.image(kaprodiTtdPath, rightX, ttdY + signatureOffset, { width: 95, height: 45 });
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
