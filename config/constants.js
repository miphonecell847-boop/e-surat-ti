module.exports = {
    ROLES: {
        MAHASISWA: 'mahasiswa',
        SEKRETARIS_PRODI: 'sekretaris_prodi',
        KAPRODI: 'kaprodi',
        STAFF_TU: 'staff_tu',
        DOSEN: 'dosen',
        ADMIN: 'admin'
    },
    STATUS_DISPOSISI: {
        DRAFT: 'draft',
        PENDING_PEMBIMBING_1: 'pending_pembimbing_1',
        PENDING_PEMBIMBING_2: 'pending_pembimbing_2',
        PENDING_SEKPRODI: 'pending_sekprodi',
        PENDING_KAPRODI: 'pending_kaprodi',
        PENDING_TU: 'pending_tu',
        SELESAI: 'selesai',
        DITOLAK: 'ditolak',
        REVISI: 'revisi'
    },
    JENIS_SURAT: {
        SRT_RISET: {
            kode: 'SRT-RISET',
            nama: 'Surat Pengantar Riset / Penelitian Instansi',
            template: 'surat_pengantar_riset'
        },
        SK_PEMBIMBING: {
            kode: 'SK-PEMBIMBING',
            nama: 'Surat Permohonan Penetapan Dosen Pembimbing Skripsi',
            template: 'sk_pembimbing_ta'
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
        UND_SIDANG: {
            kode: 'UND-SIDANG',
            nama: 'Surat Undangan Sidang Akhir / Munaqasyah',
            template: 'undangan_sidang'
        },
        SK_BEBAS_TA: {
            kode: 'SK-BEBAS-TA',
            nama: 'Surat Keterangan Bebas Laboratorium & Revisi (Bebas Masalah TA)',
            template: 'sk_bebas_ta'
        },
        BA_UJIAN: {
            kode: 'BA-UJIAN',
            nama: 'Berita Acara Ujian / Seminar Tugas Akhir',
            template: 'berita_acara_ujian'
        }
    }
};
