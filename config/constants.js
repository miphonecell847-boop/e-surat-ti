module.exports = {
    ROLES: {
        MAHASISWA: 'mahasiswa',
        STAFF_TU: 'staff_tu',
        DOSEN: 'dosen'
    },
    STATUS_DISPOSISI: {
        DRAFT: 'draft',
        PENDING_PEMBIMBING_1: 'pending_pembimbing_1',
        PENDING_PEMBIMBING_2: 'pending_pembimbing_2',
        PENDING_TU: 'pending_tu',
        SELESAI: 'selesai',
        DITOLAK: 'ditolak',
        REVISI: 'revisi'
    },
    JENIS_SURAT: {
        SRT_IZIN_PENELITIAN: {
            kode: 'SRT-IZIN-PENELITIAN',
            nama: 'Surat Izin Penelitian Instansi / Perusahaan',
            template: 'surat_izin_penelitian'
        },
        SK_PEMBIMBING_PENGUJI: {
            kode: 'SK-PEMBIMBING-PENGUJI',
            nama: 'Surat Keputusan (SK) Dosen Pembimbing & Penguji TA',
            template: 'sk_pembimbing_penguji'
        },
        KARTU_BIMBINGAN: {
            kode: 'KARTU-BIMBINGAN',
            nama: 'Kartu Bimbingan Tugas Akhir / Skripsi',
            template: 'kartu_bimbingan'
        },
        UND_SEMPRO: {
            kode: 'UND-SEMPRO',
            nama: 'Surat Undangan Seminar Proposal (Sempro)',
            template: 'undangan_sempro'
        },
        UND_SEMHAS: {
            kode: 'UND-SEMHAS',
            nama: 'Surat Undangan Seminar Hasil (Semhas)',
            template: 'undangan_semhas'
        },
        LMBR_PERSETUJUAN_WKT: {
            kode: 'LMBR-PERSETUJUAN-WKT',
            nama: 'Lembar Persetujuan Waktu Ujian / Seminar',
            template: 'lembar_persetujuan_waktu'
        },
        UND_SIDANG: {
            kode: 'UND-SIDANG',
            nama: 'Surat Undangan Sidang Akhir / Munaqasyah',
            template: 'undangan_sidang'
        },
        BA_UJIAN: {
            kode: 'BA-UJIAN',
            nama: 'Berita Acara Ujian / Seminar Tugas Akhir',
            template: 'berita_acara_ujian'
        }
    }
};
