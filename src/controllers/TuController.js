const fs = require('fs');
const path = require('path');
const SuratModel = require('../models/SuratModel');
const MahasiswaModel = require('../models/MahasiswaModel');
const DosenModel = require('../models/DosenModel');
const UserModel = require('../models/UserModel');
const GDriveDocModel = require('../models/GDriveDocModel');
const DisposisiModel = require('../models/DisposisiModel');
const PdfGeneratorService = require('../services/PdfGeneratorService');
const ESignatureService = require('../services/ESignatureService');
const gdriveService = require('../services/GDriveStorageService');
const appConfig = require('../../config/app');
const { getUploadsDir } = require('../utils/pathHelper');

class TuController {
    static async dashboard(req, res) {
        try {
            const user = req.session.user;
            const JudulTaModel = require('../models/JudulTaModel');

            // Fetch live database rows
            let allSurat = await SuratModel.getByFilter({ statusList: null });
            allSurat = (allSurat || []).filter(s => 
                s.kode_surat !== 'KARTU-BIMBINGAN' && 
                s.kode_surat !== 'BA-UJIAN' && 
                s.template_path !== 'kartu_bimbingan' && 
                s.template_path !== 'berita_acara_ujian'
            );

            let pendingSurat = await SuratModel.getByStatus(['pending_tu', 'pending_pembimbing_1', 'pending_pembimbing_2', 'pending_sekprodi', 'pending_kaprodi']);
            pendingSurat = (pendingSurat || []).filter(s => 
                s.kode_surat !== 'KARTU-BIMBINGAN' && 
                s.kode_surat !== 'BA-UJIAN' && 
                s.template_path !== 'kartu_bimbingan' && 
                s.template_path !== 'berita_acara_ujian'
            );

            let completedSurat = await SuratModel.getByStatus(['selesai']);
            completedSurat = (completedSurat || []).filter(s => 
                s.kode_surat !== 'KARTU-BIMBINGAN' && 
                s.kode_surat !== 'BA-UJIAN' && 
                s.template_path !== 'kartu_bimbingan' && 
                s.template_path !== 'berita_acara_ujian'
            );
            
            const allJudul = await JudulTaModel.getAllProposals();
            const pendingJudul = allJudul.filter(j => j.status === 'pending_tu' || j.status === 'menunggu_verifikasi');

            return res.render('tu/dashboard', {
                title: 'Dashboard Staff TU - Overview Administrasi TA',
                user,
                allSuratCount: allSurat ? allSurat.length : 0,
                pendingCount: pendingSurat ? pendingSurat.length : 0,
                completedCount: completedSurat ? completedSurat.length : 0,
                pendingJudulCount: pendingJudul ? pendingJudul.length : 0,
                allSurat: allSurat || [],
                allJudul: allJudul || []
            });
        } catch (err) {
            console.error('TU dashboard error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async renderPenomoran(req, res) {
        try {
            const { id } = req.params;
            const pengajuan = await SuratModel.getDetailById(id);
            if (!pengajuan) {
                return res.status(404).send('Pengajuan tidak ditemukan.');
            }

            const docs = await GDriveDocModel.getBySuratId(id);
            const riwayat = await DisposisiModel.getBySuratId(id);

            // Default auto-generated nomor surat
            const defaultNomor = `B/${Math.floor(100 + Math.random() * 900)}/UN.1/TI/TA/2026`;

            let dinamisObj = {};
            try {
                dinamisObj = typeof pengajuan.data_dinamis === 'string' ? JSON.parse(pengajuan.data_dinamis) : (pengajuan.data_dinamis || {});
            } catch (e) {}

            const parseIndonesianDateToISO = (str) => {
                if (!str || typeof str !== 'string') return null;
                const trimmed = str.trim();
                if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
                const months = {
                    januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06',
                    juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12'
                };
                const cleanStr = trimmed.toLowerCase().replace(/,/g, '');
                const tokens = cleanStr.split(/\s+/);
                let day = null, month = null, year = null;
                for (const t of tokens) {
                    if (months[t]) month = months[t];
                    else if (/^\d{1,2}$/.test(t) && !day) day = t.padStart(2, '0');
                    else if (/^\d{4}$/.test(t)) year = t;
                }
                if (year && month && day) return `${year}-${month}-${day}`;
                return null;
            };

            const parsePukulToHours = (str) => {
                if (!str || typeof str !== 'string') return { jamMulai: '09:00', jamSelesai: '11:00' };
                const match = str.match(/(\d{1,2})[\.:](\d{2})\s*(?:-|s\/d)?\s*(\d{1,2})?[\.:]?(\d{2})?/i);
                if (match) {
                    const jamMulai = `${match[1].padStart(2, '0')}:${match[2]}`;
                    const jamSelesai = (match[3] && match[4]) ? `${match[3].padStart(2, '0')}:${match[4]}` : '11:00';
                    return { jamMulai, jamSelesai };
                }
                return { jamMulai: '09:00', jamSelesai: '11:00' };
            };

            const defaultTgl = dinamisObj.tanggal_ujian || parseIndonesianDateToISO(dinamisObj.hari_tanggal) || new Date().toISOString().split('T')[0];
            const parsedPukul = parsePukulToHours(dinamisObj.pukul || dinamisObj.waktu_ujian);
            const defaultJamMulai = dinamisObj.jam_mulai || parsedPukul.jamMulai;
            const defaultJamSelesai = dinamisObj.jam_selesai || parsedPukul.jamSelesai;
            const defaultRuangan = dinamisObj.ruangan || dinamisObj.bertempat_di || dinamisObj.ruang_ujian || 'Ruang Ujian & Seminar TI';

            const db = require('../../config/database');
            const votes = await db.query(`
                SELECT p.*, d.nama_dosen, d.no_hp
                FROM persetujuan_jadwal_dosen p
                JOIN dosen d ON p.dosen_id = d.id
                WHERE p.pengajuan_surat_id = ?
                ORDER BY p.id ASC
            `, [id]);

            return res.render('tu/detail_penomoran', {
                title: 'Penomoran Surat & Penerbitan PDF',
                user: req.session.user,
                pengajuan,
                docs,
                riwayat,
                defaultNomor,
                dinamisObj,
                defaultTgl,
                defaultJamMulai,
                defaultJamSelesai,
                defaultRuangan,
                dosenScheduleVotes: votes || [],
                dosenVoteProgress: (votes || []).length
            });
        } catch (err) {
            console.error('Render penomoran error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async processPenomoranAndGeneratePdf(req, res) {
        try {
            const { id } = req.params;
            const { nomor_surat, tanggal_ujian, jam_mulai, jam_selesai, ruangan } = req.body;
            const user = req.session.user;

            const pengajuan = await SuratModel.getDetailById(id);
            if (!pengajuan) {
                return res.status(404).send('Pengajuan tidak ditemukan.');
            }

            // 1. Simpan Nomor Surat Resmi
            await SuratModel.setNomorSurat(id, nomor_surat);
            pengajuan.nomor_surat = nomor_surat;

            let dinamisObj = {};
            try {
                dinamisObj = typeof pengajuan.data_dinamis === 'string' ? JSON.parse(pengajuan.data_dinamis) : (pengajuan.data_dinamis || {});
            } catch (e) {}

            const parseIndonesianDateToISO = (str) => {
                if (!str || typeof str !== 'string') return null;
                const trimmed = str.trim();
                if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
                const months = {
                    januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06',
                    juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12'
                };
                const cleanStr = trimmed.toLowerCase().replace(/,/g, '');
                const tokens = cleanStr.split(/\s+/);
                let day = null, month = null, year = null;
                for (const t of tokens) {
                    if (months[t]) month = months[t];
                    else if (/^\d{1,2}$/.test(t) && !day) day = t.padStart(2, '0');
                    else if (/^\d{4}$/.test(t)) year = t;
                }
                if (year && month && day) return `${year}-${month}-${day}`;
                return null;
            };

            const parsePukulToHours = (str) => {
                if (!str || typeof str !== 'string') return { jamMulai: '09:00', jamSelesai: '11:00' };
                const match = str.match(/(\d{1,2})[\.:](\d{2})\s*(?:-|s\/d)?\s*(\d{1,2})?[\.:]?(\d{2})?/i);
                if (match) {
                    const jamMulai = `${match[1].padStart(2, '0')}:${match[2]}`;
                    const jamSelesai = (match[3] && match[4]) ? `${match[3].padStart(2, '0')}:${match[4]}` : '11:00';
                    return { jamMulai, jamSelesai };
                }
                return { jamMulai: '09:00', jamSelesai: '11:00' };
            };

            const tglUjian = tanggal_ujian || dinamisObj.tanggal_ujian || parseIndonesianDateToISO(dinamisObj.hari_tanggal) || new Date().toISOString().split('T')[0];
            const parsedPukul = parsePukulToHours(dinamisObj.pukul || dinamisObj.waktu_ujian);
            const jMulai = jam_mulai || dinamisObj.jam_mulai || parsedPukul.jamMulai;
            const jSelesai = jam_selesai || dinamisObj.jam_selesai || parsedPukul.jamSelesai;
            const tempatRuangan = ruangan || dinamisObj.ruangan || dinamisObj.bertempat_di || dinamisObj.ruang_ujian || 'Ruang Ujian & Seminar TI';

            // Sync updated schedule info back to pengajuan_surat.data_dinamis
            dinamisObj.tanggal_ujian = tglUjian;
            dinamisObj.jam_mulai = jMulai;
            dinamisObj.jam_selesai = jSelesai;
            dinamisObj.ruangan = tempatRuangan;

            const db = require('../../config/database');
            await db.run('UPDATE pengajuan_surat SET data_dinamis = ? WHERE id = ?', [JSON.stringify(dinamisObj), id]);
            pengajuan.data_dinamis = JSON.stringify(dinamisObj);

            const isUndangan = pengajuan.kode_surat && (pengajuan.kode_surat.startsWith('UND-') || pengajuan.kode_surat.includes('UNDANGAN') || pengajuan.kode_surat === 'LMBR-PERSETUJUAN-WKT');

            // 1. Update status to 'selesai' immediately
            await SuratModel.updateStatus(id, 'selesai');
            await DisposisiModel.addLog({
                pengajuan_surat_id: id,
                actor_user_id: user.id,
                actor_role: 'staff_tu',
                status_sebelumnya: pengajuan.status,
                status_sesudahnya: 'selesai',
                catatan_revisi: `Penomoran & Jadwal Ujian Resmi disetujui dan diterbitkan oleh Staff TU (Nomor: ${nomor_surat}, Tanggal: ${tglUjian}, Waktu: ${jMulai}-${jSelesai}, Ruang: ${tempatRuangan}). Status diset ke SELESAI.`
            });

            // 2. Generate PDF Document Stream & Upload to Google Drive
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

            const ROOT_FOLDER = appConfig.gdriveRootFolderId;
            const tahunFolderId = await gdriveService.getOrCreateFolder('2026', ROOT_FOLDER);
            const mhsFolderName = `${mhs.nim}_${mhs.nama_lengkap.replace(/\s+/g, '_')}`;
            const mhsFolderId = await gdriveService.getOrCreateFolder(mhsFolderName, tahunFolderId);
            const pdfFolderId = await gdriveService.getOrCreateFolder('Surat_Resmi_PDF', mhsFolderId);

            const pdfFileName = `${pengajuan.kode_surat}_${mhs.nim}_FINAL.pdf`;
            const driveResult = await gdriveService.uploadFileStream(
                pdfBuffer,
                pdfFileName,
                'application/pdf',
                pdfFolderId
            );

            await GDriveDocModel.saveMetadata({
                pengajuan_surat_id: id,
                gdrive_file_id: driveResult.id,
                gdrive_folder_id: pdfFolderId,
                nama_file_original: pdfFileName,
                kategori_berkas: 'surat_final_pdf',
                mime_type: 'application/pdf',
                file_size_bytes: driveResult.size || pdfBuffer.length,
                web_view_link: driveResult.webViewLink,
                web_content_link: driveResult.webContentLink
            });

            // 3. Dispatch WhatsApp Notification to 5 Dosen
            try {
                const WhatsAppService = require('../services/WhatsAppService');
                const plot = await db.get('SELECT dosen_pembimbing_1_id, dosen_pembimbing_2_id, dosen_penguji_1_id, dosen_penguji_2_id, dosen_penguji_3_id FROM plotting_tugas_akhir WHERE mahasiswa_id = ?', [pengajuan.mahasiswa_id]);
                
                let p1 = plot ? plot.dosen_pembimbing_1_id : null;
                let p2 = plot ? plot.dosen_pembimbing_2_id : null;
                let u1 = plot ? plot.dosen_penguji_1_id : null;
                let u2 = plot ? plot.dosen_penguji_2_id : null;
                let u3 = plot ? plot.dosen_penguji_3_id : null;

                const fallbackDosenList = await db.query('SELECT id FROM dosen WHERE id NOT IN (?, ?)', [p1 || 0, p2 || 0]);
                if (!u1 && fallbackDosenList.length > 0) u1 = fallbackDosenList[0].id;
                if (!u2 && fallbackDosenList.length > 1) u2 = fallbackDosenList[1].id;
                if (!u3 && fallbackDosenList.length > 2) u3 = fallbackDosenList[2].id;

                const targetDosen = [
                    { id: p1, peran: 'Dosen Pembimbing Utama' },
                    { id: p2, peran: 'Dosen Pembimbing Pendamping' },
                    { id: u1, peran: 'Dosen Penguji 1' },
                    { id: u2, peran: 'Dosen Penguji 2' },
                    { id: u3, peran: 'Dosen Penguji 3' }
                ];

                for (const item of targetDosen) {
                    if (item.id) {
                        const d = await DosenModel.findById(item.id);
                        if (d && d.no_hp) {
                            if (isUndangan) {
                                WhatsAppService.sendUndanganNotification({
                                    dosenPhone: d.no_hp,
                                    dosenNama: d.nama_dosen,
                                    mhsNama: mhs ? mhs.nama_lengkap : pengajuan.mhs_nama,
                                    mhsNim: mhs ? mhs.nim : pengajuan.mhs_nim,
                                    jenisSurat: pengajuan.nama_surat,
                                    perihal: pengajuan.perihal,
                                    nomorSurat: nomor_surat,
                                    tanggal: tglUjian,
                                    waktu: `${jMulai} - ${jSelesai}`,
                                    ruangan: tempatRuangan
                                }).catch(e => console.warn(`WA error ${item.peran}:`, e.message));
                            } else {
                                WhatsAppService.sendSkNotification({
                                    dosenPhone: d.no_hp,
                                    dosenNama: d.nama_dosen,
                                    mhsNama: mhs ? mhs.nama_lengkap : pengajuan.mhs_nama,
                                    mhsNim: mhs ? mhs.nim : pengajuan.mhs_nim,
                                    nomorSk: nomor_surat,
                                    judulTa: pengajuan.mhs_judul_ta || pengajuan.perihal,
                                    peranDosen: item.peran
                                }).catch(e => console.warn(`WA error ${item.peran}:`, e.message));
                            }
                        }
                    }
                }
            } catch (waErr) {
                console.warn('WhatsApp Undangan Dispatch Warning:', waErr.message);
            }

            return res.redirect(`/tu/daftar-surat?success=${encodeURIComponent('Nomor Surat (' + nomor_surat + ') & PDF Resmi berhasil diterbitkan (Status: SELESAI)!')}`);
        } catch (err) {
            console.error('Process penomoran error:', err);
            return res.status(500).send('Internal Server Error: ' + err.message);
        }
    }
    static async renderDaftarSurat(req, res) {
        try {
            const user = req.session.user;
            const jenis_surat_id = req.query.jenis_surat_id || null;
            let jenisList = await SuratModel.getJenisSuratList();

            // Filter out auto-approved letter types from dropdown filter list
            jenisList = (jenisList || []).filter(j => 
                j.kode_surat !== 'KARTU-BIMBINGAN' && 
                j.kode_surat !== 'BA-UJIAN' && 
                j.template_path !== 'kartu_bimbingan' && 
                j.template_path !== 'berita_acara_ujian'
            );

            let suratList = await SuratModel.getByFilter({
                jenis_surat_id: jenis_surat_id ? parseInt(jenis_surat_id, 10) : null,
                statusList: null
            });

            // Filter out auto-approved letters (Kartu Bimbingan TA & BA Ujian) from Admin list view
            suratList = (suratList || []).filter(s => 
                s.kode_surat !== 'KARTU-BIMBINGAN' && 
                s.kode_surat !== 'BA-UJIAN' && 
                s.template_path !== 'kartu_bimbingan' && 
                s.template_path !== 'berita_acara_ujian'
            );

            const db = require('../../config/database');
            for (let s of suratList) {
                const votes = await db.query('SELECT id FROM persetujuan_jadwal_dosen WHERE pengajuan_surat_id = ?', [s.id]);
                s.respondedCount = votes ? votes.length : 0;
            }

            const fs = require('fs');
            const path = require('path');
            const sigDir = path.join(__dirname, '../../public/uploads/signatures');
            const hasTtdKaprodi = fs.existsSync(path.join(sigDir, 'ttd_kaprodi_default.png'));
            const hasTtdDekan = fs.existsSync(path.join(sigDir, 'ttd_dekan_default.png'));

            return res.render('tu/daftar_surat', {
                title: 'Daftar Menu Surat Administrasi - Staff TU',
                user,
                jenisList,
                suratList,
                selectedJenis: jenis_surat_id,
                hasTtdKaprodi,
                hasTtdDekan,
                error: req.query.error || null,
                success: req.query.success || null
            });
        } catch (err) {
            console.error('TU renderDaftarSurat error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async renderBuatSurat(req, res) {
        try {
            const user = req.session.user;
            const { from_id } = req.query;
            const mahasiswaList = await MahasiswaModel.getAll();
            const jenisList = await SuratModel.getJenisSuratList();
            const dosenList = await DosenModel.getAll();

            let prefilledData = null;
            if (from_id) {
                const pengajuanMhs = await SuratModel.getDetailById(from_id);
                if (pengajuanMhs) {
                    let dinamisObj = {};
                    try {
                        dinamisObj = typeof pengajuanMhs.data_dinamis === 'string' ? JSON.parse(pengajuanMhs.data_dinamis) : (pengajuanMhs.data_dinamis || {});
                    } catch (e) {}

                    prefilledData = {
                        from_id: pengajuanMhs.id,
                        mahasiswa_id: pengajuanMhs.mahasiswa_id,
                        jenis_surat_id: pengajuanMhs.jenis_surat_id,
                        perihal: pengajuanMhs.perihal,
                        pembimbing_1_id: dinamisObj.pembimbing_1_id || '',
                        pembimbing_2_id: dinamisObj.pembimbing_2_id || '',
                        instansi_tujuan: dinamisObj.instansi_tujuan || '',
                        durasi: dinamisObj.durasi || '',
                        catatan: dinamisObj.catatan || ''
                    };
                }
            }

            return res.render('tu/buat_surat', {
                title: 'Form Pembuatan Surat Permintaan (Staff TU)',
                user,
                mahasiswaList,
                jenisList,
                dosenList,
                prefilledData,
                error: req.query.error || null,
                success: req.query.success || null
            });
        } catch (err) {
            console.error('TU renderBuatSurat error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async processBuatSurat(req, res) {
        try {
            const user = req.session.user;
            const db = require('../../config/database');
            const { 
                from_id, mahasiswa_id, jenis_surat_id, perihal, 
                pembimbing_1_id, pembimbing_2_id, 
                instansi_tujuan, durasi, catatan,
                hari_tanggal, pukul, bertempat_di,
                tanggal_ujian, jam_mulai, jam_selesai, ruangan
            } = req.body;
            const crypto = require('crypto');
            const uuidv4 = () => crypto.randomUUID();
            const fs = require('fs');
            const path = require('path');

            if (!mahasiswa_id || !jenis_surat_id || !perihal) {
                return res.redirect('/tu/buat-surat?error=' + encodeURIComponent('Mahasiswa, Jenis Surat, dan Perihal wajib diisi!'));
            }

            const jenisSuratObj = await SuratModel.getJenisSuratById(jenis_surat_id);

            let ttdTuPath = null;
            if (req.file) {
                const uploadDir = getUploadsDir('signatures');
                const filename = `ttd_tu_${Date.now()}_${req.file.originalname}`;
                fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);
                ttdTuPath = `/uploads/signatures/${filename}`;
            }

            // Fetch Dosen Pembimbing Names if IDs provided
            let p1Dosen = null, p2Dosen = null;
            const p1Id = pembimbing_1_id ? parseInt(pembimbing_1_id, 10) : null;
            const p2Id = pembimbing_2_id ? parseInt(pembimbing_2_id, 10) : null;
            if (p1Id) p1Dosen = await DosenModel.findById(p1Id);
            if (p2Id) p2Dosen = await DosenModel.findById(p2Id);

            const mhs = await MahasiswaModel.findById(mahasiswa_id);
            const approvedProposal = await db.get("SELECT * FROM pengajuan_judul_ta WHERE mahasiswa_id = ? AND status = 'diterima' ORDER BY id DESC LIMIT 1", [mahasiswa_id]);
            const approvedTitle = (approvedProposal && approvedProposal.judul_ta) ? approvedProposal.judul_ta : (mhs ? mhs.judul_ta : '-');

            const isPersetujuanWaktu = jenisSuratObj && (jenisSuratObj.kode_surat === 'LMBR-PERSETUJUAN-WKT' || jenisSuratObj.template_path === 'lembar_persetujuan_waktu');

            const parsedDinamis = {
                pembimbing_1_id: p1Id,
                pembimbing_2_id: p2Id,
                pembimbing_1_nama: p1Dosen ? p1Dosen.nama_dosen : '',
                pembimbing_2_nama: p2Dosen ? p2Dosen.nama_dosen : '',
                instansi_tujuan: instansi_tujuan || '',
                durasi: durasi || '',
                catatan: catatan || '',
                hari_tanggal: hari_tanggal || '',
                pukul: pukul || '',
                bertempat_di: bertempat_di || ruangan || 'Ruang Ujian & Seminar TI',
                tanggal_ujian: tanggal_ujian || new Date().toISOString().split('T')[0],
                jam_mulai: jam_mulai || '09:00',
                jam_selesai: jam_selesai || '11:00',
                ruangan: ruangan || bertempat_di || 'Ruang Ujian & Seminar TI',
                judul_ta: approvedTitle
            };

            const nextStatus = 'pending_sekprodi';

            if (from_id) {
                // UPDATE SAME EXISTING LETTER (DO NOT CREATE NEW ROW)
                const pengajuanEksisting = await SuratModel.getDetailById(from_id);
                if (pengajuanEksisting) {
                    await SuratModel.forwardSuratByTu(from_id, {
                        mahasiswa_id: parseInt(mahasiswa_id, 10),
                        jenis_surat_id: parseInt(jenis_surat_id, 10),
                        perihal,
                        data_dinamis: parsedDinamis,
                        ttd_tu_path: ttdTuPath
                    });

                    await db.run('UPDATE pengajuan_surat SET status = ? WHERE id = ?', [nextStatus, from_id]);

                    await DisposisiModel.addLog({
                        pengajuan_surat_id: from_id,
                        actor_user_id: user.id,
                        actor_role: 'staff_tu',
                        status_sebelumnya: pengajuanEksisting.status,
                        status_sesudahnya: nextStatus,
                        catatan_revisi: isPersetujuanWaktu 
                            ? 'Lembar Persetujuan Waktu Ujian diajukan oleh Staff TU dengan saran jadwal dan diteruskan ke Dosen Pembimbing untuk penetapan jadwal resmi.'
                            : 'Permintaan Surat Mahasiswa berhasil diproses dan diteruskan oleh Staff TU ke Sekprodi.'
                    });

                    const msg = isPersetujuanWaktu 
                        ? 'Lembar Persetujuan Waktu Ujian berhasil diteruskan ke Dosen Pembimbing untuk penetapan jadwal resmi!' 
                        : 'Permintaan Surat Mahasiswa berhasil diteruskan ke Sekprodi.';
                    return res.redirect('/tu/daftar-surat?success=' + encodeURIComponent(msg));
                }
            }

            // Otherwise, create a brand new letter
            const uuidSurat = 'surat-tu-' + uuidv4().substring(0, 8);
            const pengajuan = await SuratModel.createPengajuanByTu({
                uuid_surat: uuidSurat,
                mahasiswa_id: parseInt(mahasiswa_id, 10),
                jenis_surat_id: parseInt(jenis_surat_id, 10),
                perihal,
                data_dinamis: parsedDinamis,
                ttd_tu_path: ttdTuPath
            });

            await db.run('UPDATE pengajuan_surat SET status = ? WHERE id = ?', [nextStatus, pengajuan.id]);

            await DisposisiModel.addLog({
                pengajuan_surat_id: pengajuan.id,
                actor_user_id: user.id,
                actor_role: 'staff_tu',
                status_sebelumnya: 'draft',
                status_sesudahnya: nextStatus,
                catatan_revisi: isPersetujuanWaktu 
                    ? 'Lembar Persetujuan Waktu Ujian diterbitkan oleh Staff TU dengan saran jadwal dan diteruskan ke Dosen Pembimbing untuk penetapan jadwal resmi.'
                    : 'Surat Permintaan diterbitkan oleh Staff TU dan diteruskan ke Sekprodi untuk verifikasi/validasi.'
            });

            const successMsg = isPersetujuanWaktu 
                ? 'Lembar Persetujuan Waktu Ujian berhasil diterbitkan dan diteruskan ke Dosen Pembimbing untuk penetapan jadwal resmi!' 
                : 'Surat Permintaan berhasil dibuat dan diteruskan ke Sekprodi.';

            return res.redirect('/tu/daftar-surat?success=' + encodeURIComponent(successMsg));
        } catch (err) {
            console.error('TU processBuatSurat error:', err);
            return res.redirect('/tu/buat-surat?error=' + encodeURIComponent(err.message));
        }
    }

    static async renderEditSurat(req, res) {
        try {
            const { id } = req.params;
            const pengajuan = await SuratModel.getDetailById(id);
            if (!pengajuan) {
                return res.status(404).send('Pengajuan surat tidak ditemukan.');
            }

            const mahasiswaList = await MahasiswaModel.getAll();
            const jenisList = await SuratModel.getJenisSuratList();
            const dosenList = await DosenModel.getAll();

            let dinamisObj = {};
            try {
                dinamisObj = typeof pengajuan.data_dinamis === 'string' ? JSON.parse(pengajuan.data_dinamis) : (pengajuan.data_dinamis || {});
            } catch (e) {}

            return res.render('tu/edit_surat', {
                title: 'Form Edit Surat Administrasi (Staff TU)',
                user: req.session.user,
                pengajuan,
                dinamisObj,
                mahasiswaList,
                jenisList,
                dosenList,
                error: req.query.error || null,
                success: req.query.success || null
            });
        } catch (err) {
            console.error('TU renderEditSurat error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async processEditSurat(req, res) {
        try {
            const { id } = req.params;
            const {
                mahasiswa_id, jenis_surat_id, perihal,
                pembimbing_1_id, pembimbing_2_id,
                instansi_tujuan, tujuan_instansi, alamat_instansi, durasi,
                tgl_mulai_penelitian, tgl_selesai_penelitian,
                jenis_seminar, hari_tanggal, tanggal_ujian, pukul, jam_mulai, jam_selesai, bertempat_di, ruangan,
                tahun_akademik, catatan
            } = req.body;
            const fs = require('fs');
            const path = require('path');

            const pengajuan = await SuratModel.getDetailById(id);
            if (!pengajuan) {
                return res.status(404).send('Pengajuan surat tidak ditemukan.');
            }

            let ttdTuPath = null;
            if (req.file) {
                const uploadDir = getUploadsDir('signatures');
                const filename = `ttd_tu_${Date.now()}_${req.file.originalname}`;
                fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);
                ttdTuPath = `/uploads/signatures/${filename}`;
            }

            let existingDinamis = {};
            try {
                existingDinamis = typeof pengajuan.data_dinamis === 'string' ? JSON.parse(pengajuan.data_dinamis) : (pengajuan.data_dinamis || {});
            } catch(e) {}

            let p1Dosen = null, p2Dosen = null;
            const p1Id = pembimbing_1_id ? parseInt(pembimbing_1_id, 10) : (existingDinamis.pembimbing_1_id || null);
            const p2Id = pembimbing_2_id ? parseInt(pembimbing_2_id, 10) : (existingDinamis.pembimbing_2_id || null);
            if (p1Id) p1Dosen = await DosenModel.findById(p1Id);
            if (p2Id) p2Dosen = await DosenModel.findById(p2Id);

            const finalTgl = tanggal_ujian || existingDinamis.tanggal_ujian || tgl_mulai_penelitian || existingDinamis.tgl_mulai_penelitian || new Date().toISOString().split('T')[0];
            const finalJMulai = jam_mulai || existingDinamis.jam_mulai || '09:00';
            const finalJSelesai = jam_selesai || existingDinamis.jam_selesai || '11:00';
            const finalRuangan = ruangan || bertempat_di || existingDinamis.ruangan || existingDinamis.bertempat_di || 'Ruang Ujian & Seminar TI';

            const updatedDinamis = {
                ...existingDinamis,
                pembimbing_1_id: p1Id,
                pembimbing_2_id: p2Id,
                pembimbing_1_nama: p1Dosen ? p1Dosen.nama_dosen : (existingDinamis.pembimbing_1_nama || ''),
                pembimbing_2_nama: p2Dosen ? p2Dosen.nama_dosen : (existingDinamis.pembimbing_2_nama || ''),
                instansi_tujuan: instansi_tujuan || tujuan_instansi || existingDinamis.instansi_tujuan || existingDinamis.tujuan_instansi || '',
                tujuan_instansi: tujuan_instansi || instansi_tujuan || existingDinamis.tujuan_instansi || existingDinamis.instansi_tujuan || '',
                alamat_instansi: alamat_instansi !== undefined ? alamat_instansi : (existingDinamis.alamat_instansi || ''),
                durasi: durasi !== undefined ? durasi : (existingDinamis.durasi || ''),
                tgl_mulai_penelitian: tgl_mulai_penelitian !== undefined ? tgl_mulai_penelitian : (existingDinamis.tgl_mulai_penelitian || ''),
                tgl_selesai_penelitian: tgl_selesai_penelitian !== undefined ? tgl_selesai_penelitian : (existingDinamis.tgl_selesai_penelitian || ''),
                jenis_seminar: jenis_seminar !== undefined ? jenis_seminar : (existingDinamis.jenis_seminar || ''),
                hari_tanggal: hari_tanggal || existingDinamis.hari_tanggal || '',
                tanggal_ujian: finalTgl,
                pukul: pukul || existingDinamis.pukul || '',
                jam_mulai: finalJMulai,
                jam_selesai: finalJSelesai,
                bertempat_di: finalRuangan,
                ruangan: finalRuangan,
                tahun_akademik: tahun_akademik !== undefined ? tahun_akademik : (existingDinamis.tahun_akademik || ''),
                catatan: catatan !== undefined ? catatan : (existingDinamis.catatan || '')
            };

            await SuratModel.updateSuratByTu(id, {
                mahasiswa_id: parseInt(mahasiswa_id, 10),
                jenis_surat_id: parseInt(jenis_surat_id, 10),
                perihal,
                data_dinamis: updatedDinamis,
                ttd_tu_path: ttdTuPath
            });

            // Sync updated schedule to JadwalUjianModel if UND- letter
            if (pengajuan.kode_surat && (pengajuan.kode_surat.startsWith('UND-') || pengajuan.kode_surat.includes('UNDANGAN') || pengajuan.kode_surat === 'LMBR-PERSETUJUAN-WKT')) {
                const JadwalUjianModel = require('../models/JadwalUjianModel');
                await JadwalUjianModel.createOrUpdateJadwal({
                    pengajuan_surat_id: id,
                    mahasiswa_id: parseInt(mahasiswa_id, 10),
                    jenis_ujian: pengajuan.nama_surat,
                    tanggal_ujian: finalTgl,
                    jam_mulai: finalJMulai,
                    jam_selesai: finalJSelesai,
                    ruangan: finalRuangan,
                    judul_ta: pengajuan.mhs_judul_ta || perihal,
                    pembimbing_1_id: p1Id,
                    pembimbing_2_id: p2Id
                });
            }

            await DisposisiModel.addLog({
                pengajuan_surat_id: id,
                actor_user_id: req.session.user.id,
                actor_role: 'staff_tu',
                status_sebelumnya: pengajuan.status,
                status_sesudahnya: pengajuan.status,
                catatan_revisi: 'Data Surat Administrasi & Detail Isian Spesifik berhasil diperbarui oleh Staff TU.'
            });

            return res.redirect('/tu/daftar-surat?success=' + encodeURIComponent('Data Surat berhasil diperbarui.'));
        } catch (err) {
            console.error('TU processEditSurat error:', err);
            return res.redirect(`/tu/edit-surat/${req.params.id}?error=` + encodeURIComponent(err.message));
        }
    }

    static async processDeleteSurat(req, res) {
        try {
            const { id } = req.params;
            const db = require('../../config/database');
            const exist = await db.get('SELECT id FROM pengajuan_surat WHERE id = ?', [id]);
            if (!exist) {
                return res.redirect('/tu/daftar-surat?error=' + encodeURIComponent('Pengajuan surat tidak ditemukan atau telah dihapus sebelumnya.'));
            }

            await SuratModel.deleteSurat(id);
            return res.redirect('/tu/daftar-surat?success=' + encodeURIComponent('Surat berhasil dihapus dari sistem.'));
        } catch (err) {
            console.error('TU processDeleteSurat error:', err);
            return res.redirect('/tu/daftar-surat?error=' + encodeURIComponent('Gagal menghapus surat: ' + err.message));
        }
    }

    // --- MANAJEMEN & VALIDASI AKUN (STAFF TU) ---
    static async renderKelolaAkun(req, res) {
        try {
            const user = req.session.user;
            const pendingList = await UserModel.getPendingMahasiswa();
            const allUsers = await UserModel.getAllUsersWithProfile();

            return res.render('tu/kelola_akun', {
                title: 'Manajemen & Validasi Akun Pengguna',
                user,
                pendingList,
                allUsers,
                error: req.query.error || null,
                success: req.query.success || null
            });
        } catch (err) {
            console.error('TU renderKelolaAkun error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async processApproveUser(req, res) {
        try {
            const { id } = req.params;
            await UserModel.approveUser(id);
            return res.redirect('/tu/kelola-akun?success=' + encodeURIComponent('Akun Mahasiswa berhasil divalidasi & diaktifkan.'));
        } catch (err) {
            console.error('TU processApproveUser error:', err);
            return res.redirect('/tu/kelola-akun?error=' + encodeURIComponent(err.message));
        }
    }

    static async processRejectUser(req, res) {
        try {
            const { id } = req.params;
            await UserModel.deleteUser(id);
            return res.redirect('/tu/kelola-akun?success=' + encodeURIComponent('Permohonan registrasi akun telah ditolak/dihapus.'));
        } catch (err) {
            console.error('TU processRejectUser error:', err);
            return res.redirect('/tu/kelola-akun?error=' + encodeURIComponent(err.message));
        }
    }

    static async processBuatAkunDosen(req, res) {
        try {
            const { username, email, password, nip_nidn, nama_dosen, jabatan, no_hp } = req.body;

            const existingUser = await UserModel.findByUsername(username);
            if (existingUser) {
                return res.redirect('/tu/kelola-akun?error=' + encodeURIComponent(`Username "${username}" sudah terdaftar.`));
            }
            const existingEmail = await UserModel.findByEmail(email);
            if (existingEmail) {
                return res.redirect('/tu/kelola-akun?error=' + encodeURIComponent(`Email "${email}" sudah terdaftar.`));
            }

            await UserModel.createDosenByTu({ username, email, password, nip_nidn, nama_dosen, jabatan, no_hp });
            return res.redirect('/tu/kelola-akun?success=' + encodeURIComponent(`Akun Dosen (${nama_dosen}) berhasil dibuat dan langsung aktif.`));
        } catch (err) {
            console.error('TU processBuatAkunDosen error:', err);
            return res.redirect('/tu/kelola-akun?error=' + encodeURIComponent(err.message));
        }
    }

    static async processBuatAkunMahasiswa(req, res) {
        try {
            const { username, email, password, nim, nama_lengkap, angkatan, no_hp } = req.body;

            const existingUser = await UserModel.findByUsername(username);
            if (existingUser) {
                return res.redirect('/tu/kelola-akun?error=' + encodeURIComponent(`Username "${username}" sudah terdaftar.`));
            }
            const existingEmail = await UserModel.findByEmail(email);
            if (existingEmail) {
                return res.redirect('/tu/kelola-akun?error=' + encodeURIComponent(`Email "${email}" sudah terdaftar.`));
            }

            await UserModel.createMahasiswaByTu({ username, email, password, nim, nama_lengkap, angkatan, no_hp });
            return res.redirect('/tu/kelola-akun?success=' + encodeURIComponent(`Akun Mahasiswa (${nama_lengkap}) berhasil dibuat dan langsung aktif.`));
        } catch (err) {
            console.error('TU processBuatAkunMahasiswa error:', err);
            return res.redirect('/tu/kelola-akun?error=' + encodeURIComponent(err.message));
        }
    }

    static async processHapusUser(req, res) {
        try {
            const { id } = req.params;
            await UserModel.deleteUser(id);
            return res.redirect('/tu/kelola-akun?success=' + encodeURIComponent('Akun pengguna berhasil dihapus dari sistem.'));
        } catch (err) {
            console.error('TU processHapusUser error:', err);
            return res.redirect('/tu/kelola-akun?error=' + encodeURIComponent(err.message));
        }
    }

    static async processEditUser(req, res) {
        try {
            const { id } = req.params;
            const { username, email, role, status, nama, nomor_identitas, no_hp, password } = req.body;

            await UserModel.updateUserByAdmin({
                userId: id,
                username,
                email,
                role,
                status,
                nama,
                nomorIdentitas: nomor_identitas,
                no_hp,
                password
            });

            return res.redirect('/tu/kelola-akun?success=' + encodeURIComponent(`Data pengguna (@${username}) berhasil diperbarui.`));
        } catch (err) {
            console.error('TU processEditUser error:', err);
            return res.redirect('/tu/kelola-akun?error=' + encodeURIComponent(err.message));
        }
    }

    static async processUploadTtdTu(req, res) {
        try {
            if (!req.file) {
                return res.redirect('/tu/daftar-surat?error=' + encodeURIComponent('Silakan pilih file spesimen TTD (PNG/JPG Transparan).'));
            }
            const uploadDir = getUploadsDir('signatures');
            const filename = `ttd_tu_staff_${Date.now()}_${req.file.originalname.replace(/\s+/g, '_')}`;
            const targetPath = path.join(uploadDir, filename);
            fs.writeFileSync(targetPath, req.file.buffer);

            // Copy to default ttd_tu_default.png
            fs.writeFileSync(path.join(uploadDir, 'ttd_tu_default.png'), req.file.buffer);

            const ttdPath = `/uploads/signatures/${filename}`;
            req.session.ttd_tu_path = ttdPath;

            return res.redirect('/tu/daftar-surat?success=' + encodeURIComponent('Spesimen Tanda Tangan Digital Staff TU berhasil diunggah dan disimpan!'));
        } catch (err) {
            console.error('Upload TTD Staff TU error:', err);
            return res.redirect('/tu/daftar-surat?error=' + encodeURIComponent('Gagal mengunggah TTD Staff TU: ' + err.message));
        }
    }

    static async processUploadTtdKaprodi(req, res) {
        try {
            if (!req.file) {
                return res.redirect('/tu/daftar-surat?error=' + encodeURIComponent('Silakan pilih file spesimen TTD Plt. Kaprodi (PNG/JPG Transparan).'));
            }
            const uploadDir = getUploadsDir('signatures');
            const filename = `ttd_kaprodi_${Date.now()}_${req.file.originalname.replace(/\s+/g, '_')}`;
            fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);
            fs.writeFileSync(path.join(uploadDir, 'ttd_kaprodi_default.png'), req.file.buffer);

            return res.redirect('/tu/daftar-surat?success=' + encodeURIComponent('Spesimen Tanda Tangan Digital Plt. Kaprodi berhasil disimpan!'));
        } catch (err) {
            console.error('Upload TTD Kaprodi error:', err);
            return res.redirect('/tu/daftar-surat?error=' + encodeURIComponent('Gagal mengunggah TTD Kaprodi: ' + err.message));
        }
    }

    static async processUploadTtdDekan(req, res) {
        try {
            if (!req.file) {
                return res.redirect('/tu/daftar-surat?error=' + encodeURIComponent('Silakan pilih file spesimen TTD Dekan (PNG/JPG Transparan).'));
            }
            const uploadDir = getUploadsDir('signatures');
            const filename = `ttd_dekan_${Date.now()}_${req.file.originalname.replace(/\s+/g, '_')}`;
            fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);
            fs.writeFileSync(path.join(uploadDir, 'ttd_dekan_default.png'), req.file.buffer);

            return res.redirect('/tu/daftar-surat?success=' + encodeURIComponent('Spesimen Tanda Tangan Digital Dekan berhasil disimpan!'));
        } catch (err) {
            console.error('Upload TTD Dekan error:', err);
            return res.redirect('/tu/daftar-surat?error=' + encodeURIComponent('Gagal mengunggah TTD Dekan: ' + err.message));
        }
    }

    static async processKirimWaManual(req, res) {
        try {
            const { id } = req.params;
            const bodyOrQuery = { ...(req.query || {}), ...(req.body || {}) };
            const { target_mode, custom_phone, redirect_url } = bodyOrQuery;
            const db = require('../../config/database');
            const WhatsAppService = require('../services/WhatsAppService');

            const pengajuan = await SuratModel.getDetailById(id);
            if (!pengajuan) {
                const backUrl = redirect_url || '/tu/daftar-surat';
                return res.redirect(`${backUrl}?error=${encodeURIComponent('Pengajuan surat tidak ditemukan.')}`);
            }

            const mhsInfo = await MahasiswaModel.findById(pengajuan.mahasiswa_id);
            let dinamisObj = {};
            try {
                dinamisObj = typeof pengajuan.data_dinamis === 'string' ? JSON.parse(pengajuan.data_dinamis) : (pengajuan.data_dinamis || {});
            } catch(e) {}

            const nomorSurat = pengajuan.nomor_surat || dinamisObj.nomor_surat || 'B/---/UN.1/TI/TA/2026';
            const tglUjian = dinamisObj.tanggal_ujian || dinamisObj.hari_tanggal || new Date().toISOString().split('T')[0];
            const waktuUjian = dinamisObj.jam_mulai ? `${dinamisObj.jam_mulai} - ${dinamisObj.jam_selesai || ''}` : (dinamisObj.pukul || dinamisObj.waktu_ujian || '09:00 - 11:00 WITA');
            const ruangan = dinamisObj.ruangan || dinamisObj.bertempat_di || 'Ruang Ujian & Seminar TI';

            const isUndangan = pengajuan.kode_surat && (pengajuan.kode_surat.startsWith('UND-') || pengajuan.kode_surat.includes('UNDANGAN') || pengajuan.kode_surat === 'LMBR-PERSETUJUAN-WKT');

            if (target_mode === 'custom' && custom_phone) {
                let sendResult;
                if (isUndangan) {
                    sendResult = await WhatsAppService.sendUndanganNotification({
                        dosenPhone: custom_phone,
                        dosenNama: 'Admin / Penguji (Nomor Tes)',
                        mhsNama: mhsInfo ? mhsInfo.nama_lengkap : pengajuan.mhs_nama,
                        mhsNim: mhsInfo ? mhsInfo.nim : pengajuan.mhs_nim,
                        jenisSurat: pengajuan.nama_surat,
                        perihal: pengajuan.perihal,
                        nomorSurat: nomorSurat,
                        tanggal: tglUjian,
                        waktu: waktuUjian,
                        ruangan: ruangan
                    });
                } else {
                    sendResult = await WhatsAppService.sendSkNotification({
                        dosenPhone: custom_phone,
                        dosenNama: 'Admin / Penguji (Nomor Tes)',
                        mhsNama: mhsInfo ? mhsInfo.nama_lengkap : pengajuan.mhs_nama,
                        mhsNim: mhsInfo ? mhsInfo.nim : pengajuan.mhs_nim,
                        nomorSk: nomorSurat,
                        judulTa: pengajuan.mhs_judul_ta || pengajuan.perihal,
                        peranDosen: 'Nomor Tes Custom Admin'
                    });
                }

                const backUrl = redirect_url || `/tu/penomoran/${id}`;
                if (sendResult && sendResult.success) {
                    return res.redirect(`${backUrl}?success=${encodeURIComponent('Pesan WA berhasil dikirim ke nomor tes: ' + custom_phone)}`);
                } else {
                    return res.redirect(`${backUrl}?error=${encodeURIComponent('Gagal mengirim WA ke nomor tes: ' + (sendResult.error || sendResult.reason || 'Error Fonnte'))}`);
                }
            }

            // Target Mode = 'dosen' (Send to all assigned Pembimbing & Penguji)
            const plot = await db.get('SELECT dosen_pembimbing_1_id, dosen_pembimbing_2_id, dosen_penguji_1_id, dosen_penguji_2_id, dosen_penguji_3_id FROM plotting_tugas_akhir WHERE mahasiswa_id = ?', [pengajuan.mahasiswa_id]);

            if (!plot) {
                const backUrl = redirect_url || `/tu/penomoran/${id}`;
                return res.redirect(`${backUrl}?error=${encodeURIComponent('Data Plotting Dosen untuk mahasiswa ini belum diatur.')}`);
            }

            let p1 = plot ? plot.dosen_pembimbing_1_id : null;
            let p2 = plot ? plot.dosen_pembimbing_2_id : null;
            let u1 = plot ? plot.dosen_penguji_1_id : null;
            let u2 = plot ? plot.dosen_penguji_2_id : null;
            let u3 = plot ? plot.dosen_penguji_3_id : null;

            // Fallback for missing Penguji IDs from official Dosen list
            const fallbackDosenList = await db.query('SELECT id FROM dosen WHERE id NOT IN (?, ?)', [p1 || 0, p2 || 0]);
            if (!u1 && fallbackDosenList.length > 0) u1 = fallbackDosenList[0].id;
            if (!u2 && fallbackDosenList.length > 1) u2 = fallbackDosenList[1].id;
            if (!u3 && fallbackDosenList.length > 2) u3 = fallbackDosenList[2].id;

            const targetDosen = [
                { id: p1, peran: 'Dosen Pembimbing Utama' },
                { id: p2, peran: 'Dosen Pembimbing Pendamping' },
                { id: u1, peran: 'Dosen Penguji 1' },
                { id: u2, peran: 'Dosen Penguji 2' },
                { id: u3, peran: 'Dosen Penguji 3' }
            ];

            let sentCount = 0;
            let failedCount = 0;
            let lastError = null;
            let dosenWithoutPhone = 0;

            for (const item of targetDosen) {
                if (item.id) {
                    const d = await DosenModel.findById(item.id);
                    if (d && d.no_hp) {
                        let resObj;
                        if (isUndangan) {
                            resObj = await WhatsAppService.sendUndanganNotification({
                                dosenPhone: d.no_hp,
                                dosenNama: d.nama_dosen,
                                mhsNama: mhsInfo ? mhsInfo.nama_lengkap : pengajuan.mhs_nama,
                                mhsNim: mhsInfo ? mhsInfo.nim : pengajuan.mhs_nim,
                                jenisSurat: pengajuan.nama_surat,
                                perihal: pengajuan.perihal,
                                nomorSurat: nomorSurat,
                                tanggal: tglUjian,
                                waktu: waktuUjian,
                                ruangan: ruangan
                            }).catch(e => ({ success: false, error: e.message }));
                        } else {
                            resObj = await WhatsAppService.sendSkNotification({
                                dosenPhone: d.no_hp,
                                dosenNama: d.nama_dosen,
                                mhsNama: mhsInfo ? mhsInfo.nama_lengkap : pengajuan.mhs_nama,
                                mhsNim: mhsInfo ? mhsInfo.nim : pengajuan.mhs_nim,
                                nomorSk: nomorSurat,
                                judulTa: pengajuan.mhs_judul_ta || pengajuan.perihal,
                                peranDosen: item.peran
                            }).catch(e => ({ success: false, error: e.message }));
                        }

                        if (resObj && resObj.success) {
                            sentCount++;
                        } else {
                            failedCount++;
                            if (resObj && resObj.error) lastError = resObj.error;
                        }
                    } else {
                        dosenWithoutPhone++;
                    }
                }
            }

            const backUrl = redirect_url || `/tu/penomoran/${id}`;
            if (sentCount > 0) {
                return res.redirect(`${backUrl}?success=${encodeURIComponent('Pesan WA berhasil terkirim via Gateway ke ' + sentCount + ' Dosen!')}`);
            } else if (failedCount > 0) {
                return res.redirect(`${backUrl}?error=${encodeURIComponent('Gagal mengirim WA via Fonnte Gateway: ' + (lastError || 'Token Fonnte tidak valid / perangkat terputus') + '. Gunakan opsi Kirim WA Web Direct.')}`);
            } else if (dosenWithoutPhone > 0) {
                return res.redirect(`${backUrl}?error=${encodeURIComponent('Dosen Pembimbing & Penguji belum diisi nomor HP-nya di database. Silakan isi nomor HP dosen terlebih dahulu.')}`);
            } else {
                return res.redirect(`${backUrl}?error=${encodeURIComponent('Tidak ada target dosen pengirim yang ditemukan.')}`);
            }
        } catch (err) {
            console.error('TU processKirimWaManual error:', err);
            const backUrl = req.body.redirect_url || `/tu/penomoran/${req.params.id}`;
            return res.redirect(`${backUrl}?error=${encodeURIComponent('Gagal kirim WA: ' + err.message)}`);
        }
    }
}

module.exports = TuController;
