const SuratModel = require('../models/SuratModel');
const DosenModel = require('../models/DosenModel');
const MahasiswaModel = require('../models/MahasiswaModel');
const GDriveDocModel = require('../models/GDriveDocModel');
const DisposisiModel = require('../models/DisposisiModel');
const PlottingModel = require('../models/PlottingModel');
const JadwalUjianModel = require('../models/JadwalUjianModel');
const PdfGeneratorService = require('../services/PdfGeneratorService');
const gdriveService = require('../services/GDriveStorageService');
const appConfig = require('../../config/app');

class DosenController {
    static async dashboard(req, res) {
        try {
            const user = req.session.user;
            const dosen = await DosenModel.findByUserId(user.id);
            if (!dosen) {
                return res.status(400).send('Profil Dosen tidak ditemukan.');
            }

            // Inbox pengajuan pending pembimbing 1 & 2
            const pendingList = await SuratModel.getPendingForDosen(dosen.id);
            const allAssignedBimbingan = await PlottingModel.getByDosenPembimbing(dosen.id);
            const assignedSuratSelesai = await SuratModel.getByDosenPembimbing(dosen.id);

            const filterOutAutoTypes = (list) => (list || []).filter(s => 
                s.kode_surat !== 'KARTU-BIMBINGAN' && 
                s.template_path !== 'kartu_bimbingan'
            );

            const filteredPending = filterOutAutoTypes(pendingList);

            return res.render('dosen/dashboard', {
                title: 'Dashboard Dosen Pembimbing & Penguji',
                user,
                dosen,
                pendingP1: filteredPending,
                pendingP2: [],
                allAssignedBimbingan,
                assignedSuratSelesai: filterOutAutoTypes(assignedSuratSelesai)
            });
        } catch (err) {
            console.error('Dosen dashboard error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async renderReview(req, res) {
        try {
            const { id } = req.params;
            const pengajuan = await SuratModel.getDetailById(id);
            if (!pengajuan) {
                return res.status(404).send('Pengajuan surat tidak ditemukan.');
            }

            const docs = await GDriveDocModel.getBySuratId(id);
            const riwayat = await DisposisiModel.getBySuratId(id);

            let dinamisObj = {};
            try {
                dinamisObj = typeof pengajuan.data_dinamis === 'string' ? JSON.parse(pengajuan.data_dinamis) : (pengajuan.data_dinamis || {});
            } catch (e) {}

            return res.render('dosen/detail_review', {
                title: 'Review Pengajuan Surat',
                user: req.session.user,
                pengajuan,
                docs,
                riwayat,
                dinamisObj
            });
        } catch (err) {
            console.error('Render review error:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    static async processAction(req, res) {
        try {
            const { id } = req.params;
            const { action, catatan_revisi, tanggal_ujian, jam_mulai, jam_selesai, ruangan } = req.body; // 'approve', 'revision', 'reject'
            const user = req.session.user;
            const pengajuan = await SuratModel.getDetailById(id);

            if (!pengajuan) {
                return res.status(404).send('Pengajuan surat tidak ditemukan.');
            }

            let dinamisObj = {};
            try {
                dinamisObj = typeof pengajuan.data_dinamis === 'string' ? JSON.parse(pengajuan.data_dinamis) : (pengajuan.data_dinamis || {});
            } catch (e) {}

            const prevStatus = pengajuan.status;
            const isUndangan = pengajuan.kode_surat && (pengajuan.kode_surat.startsWith('UND-') || pengajuan.kode_surat.includes('UNDANGAN') || pengajuan.kode_surat === 'LMBR-PERSETUJUAN-WKT');

            let nextStatus = prevStatus;
            let approvalP1 = null;
            let approvalP2 = null;

            if (action === 'approve') {
                if (isUndangan) {
                    // 1. Parse & update data_dinamis with final date/time/room specified/confirmed by Dosen
                    const finalTgl = tanggal_ujian || dinamisObj.tanggal_ujian || new Date().toISOString().split('T')[0];
                    const finalJMulai = jam_mulai || dinamisObj.jam_mulai || '09:00';
                    const finalJSelesai = jam_selesai || dinamisObj.jam_selesai || '11:00';
                    const finalRuangan = ruangan || dinamisObj.ruangan || dinamisObj.bertempat_di || 'Ruang Ujian & Seminar TI';

                    dinamisObj.tanggal_ujian = finalTgl;
                    dinamisObj.jam_mulai = finalJMulai;
                    dinamisObj.jam_selesai = finalJSelesai;
                    dinamisObj.ruangan = finalRuangan;

                    const db = require('../../config/database');
                    await db.run('UPDATE pengajuan_surat SET data_dinamis = ? WHERE id = ?', [JSON.stringify(dinamisObj), id]);
                    pengajuan.data_dinamis = JSON.stringify(dinamisObj);

                    let mhs = await MahasiswaModel.findById(pengajuan.mahasiswa_id);
                    if (!mhs) mhs = { nim: '22650025', nama_lengkap: pengajuan.mhs_nama || 'Mahasiswa' };
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

                    // 3. Upload PDF Final Stream to Google Drive
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

                    // 4. Create or Update Official Jadwal Ujian
                    let p1Id = dinamisObj.pembimbing_1_id || null;
                    let p2Id = dinamisObj.pembimbing_2_id || null;
                    if (!p1Id || !p2Id) {
                        const plot = await db.get('SELECT dosen_pembimbing_1_id, dosen_pembimbing_2_id FROM plotting_tugas_akhir WHERE mahasiswa_id = ?', [pengajuan.mahasiswa_id]);
                        if (plot) {
                            if (!p1Id) p1Id = plot.dosen_pembimbing_1_id;
                            if (!p2Id) p2Id = plot.dosen_pembimbing_2_id;
                        }
                    }

                    await JadwalUjianModel.createOrUpdateJadwal({
                        pengajuan_surat_id: id,
                        mahasiswa_id: pengajuan.mahasiswa_id,
                        jenis_ujian: pengajuan.nama_surat,
                        tanggal_ujian: finalTgl,
                        jam_mulai: finalJMulai,
                        jam_selesai: finalJSelesai,
                        ruangan: finalRuangan,
                        judul_ta: pengajuan.mhs_judul_ta || pengajuan.perihal,
                        pembimbing_1_id: p1Id,
                        pembimbing_2_id: p2Id
                    });

                    // 5. Otomatis buatkan Berita Acara Ujian (BA-UJIAN) jika belum ada
                    const { v4: uuidv4 } = require('uuid');
                    const jenisList = await SuratModel.getJenisSuratList();
                    const baJenis = (jenisList || []).find(j => j.kode_surat === 'BA-UJIAN');
                    if (baJenis) {
                        const existingBa = await db.get('SELECT id FROM pengajuan_surat WHERE mahasiswa_id = ? AND jenis_surat_id = ?', [pengajuan.mahasiswa_id, baJenis.id]);
                        if (!existingBa) {
                            const baNomor = `BA/${Math.floor(100 + Math.random() * 900)}/UN.1/TI/TA/${new Date().getFullYear()}`;
                            await SuratModel.createPengajuan({
                                uuid_surat: `ba-ujian-${uuidv4().substring(0, 8)}`,
                                mahasiswa_id: pengajuan.mahasiswa_id,
                                jenis_surat_id: baJenis.id,
                                nomor_surat: baNomor,
                                perihal: `Berita Acara ${pengajuan.nama_surat}`,
                                data_dinamis: JSON.stringify({
                                    tanggal_ujian: finalTgl,
                                    waktu_ujian: `${finalJMulai} - ${finalJSelesai} WITA`,
                                    ruang_ujian: finalRuangan,
                                    kategori_ujian: pengajuan.nama_surat
                                }),
                                status: 'selesai'
                            });
                        }
                    }

                    nextStatus = 'selesai';
                    approvalP1 = true;

                    // Record Dosen schedule vote into persetujuan_jadwal_dosen
                    try {
                        const db = require('../../config/database');
                        const dosen = await DosenModel.findByUserId(user.id);
                        if (dosen) {
                            const plot = await db.get('SELECT dosen_pembimbing_1_id, dosen_pembimbing_2_id, dosen_penguji_1_id, dosen_penguji_2_id, dosen_penguji_3_id FROM plotting_tugas_akhir WHERE mahasiswa_id = ?', [pengajuan.mahasiswa_id]);
                            let peranDosen = 'dosen';
                            if (plot) {
                                if (dosen.id === plot.dosen_pembimbing_1_id) peranDosen = 'pembimbing_1';
                                else if (dosen.id === plot.dosen_pembimbing_2_id) peranDosen = 'pembimbing_2';
                                else if (dosen.id === plot.dosen_penguji_1_id) peranDosen = 'penguji_1';
                                else if (dosen.id === plot.dosen_penguji_2_id) peranDosen = 'penguji_2';
                                else if (dosen.id === plot.dosen_penguji_3_id) peranDosen = 'penguji_3';
                            }
                            await db.run(`
                                INSERT INTO persetujuan_jadwal_dosen 
                                (pengajuan_surat_id, dosen_id, peran_dosen, status_persetujuan, tanggal_usulan, jam_mulai_usulan, jam_selesai_usulan, ruangan_usulan, catatan, updated_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                                ON CONFLICT(pengajuan_surat_id, dosen_id) DO UPDATE SET
                                status_persetujuan = excluded.status_persetujuan,
                                tanggal_usulan = excluded.tanggal_usulan,
                                jam_mulai_usulan = excluded.jam_mulai_usulan,
                                jam_selesai_usulan = excluded.jam_selesai_usulan,
                                ruangan_usulan = excluded.ruangan_usulan,
                                catatan = excluded.catatan,
                                updated_at = CURRENT_TIMESTAMP
                            `, [id, dosen.id, peranDosen, 'setuju', finalTgl, finalJMulai, finalJSelesai, finalRuangan, catatan_revisi || '']);
                        }
                    } catch (voteErr) {
                        console.warn('Error recording Dosen schedule vote:', voteErr.message);
                    }
                } else {
                    if (prevStatus === 'pending_pembimbing_1') {
                        nextStatus = 'pending_pembimbing_2';
                        approvalP1 = true;
                    } else if (prevStatus === 'pending_pembimbing_2') {
                        nextStatus = 'pending_sekprodi';
                        approvalP2 = true;
                    }
                }
            } else if (action === 'revision') {
                nextStatus = 'revisi';
            } else if (action === 'reject') {
                nextStatus = 'ditolak';
            }

            await SuratModel.updateStatus(id, nextStatus, approvalP1, approvalP2);

            await DisposisiModel.addLog({
                pengajuan_surat_id: id,
                actor_user_id: user.id,
                actor_role: 'dosen',
                status_sebelumnya: prevStatus,
                status_sesudahnya: nextStatus,
                catatan_revisi: catatan_revisi || (isUndangan && action === 'approve' ? `Surat Undangan resmi disetujui (ACC) dan diterbitkan. Jadwal: ${dinamisObj.tanggal_ujian || ''} (${dinamisObj.jam_mulai || ''}-${dinamisObj.jam_selesai || ''} WITA) di ${dinamisObj.ruangan || ''}` : `Action: ${action.toUpperCase()}`)
            });

            return res.redirect('/dosen/dashboard');
        } catch (err) {
            console.error('Process action error:', err);
            return res.status(500).send('Internal Server Error: ' + err.message);
        }
    }

    static async updateProfile(req, res) {
        try {
            const user = req.session.user;
            const { no_hp, nama_dosen, nip_nidn, jabatan } = req.body;
            await DosenModel.updateProfile(user.id, { no_hp, nama_dosen, nip_nidn, jabatan });
            return res.redirect('/dosen/dashboard?success=' + encodeURIComponent('Nomor WhatsApp & Profil Dosen berhasil diperbarui!'));
        } catch (err) {
            console.error('Update dosen profile error:', err);
            return res.redirect('/dosen/dashboard?error=' + encodeURIComponent('Gagal memperbarui profil: ' + err.message));
        }
    }
}

module.exports = DosenController;
