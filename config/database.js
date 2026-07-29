const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '../e_surat.db');

let db = null;

function saveDb() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
    }
}

async function getDbInstance() {
    if (db) return db;

    const SQL = await initSqlJs();
    let filebuffer = null;
    if (fs.existsSync(dbPath)) {
        filebuffer = fs.readFileSync(dbPath);
    }

    db = filebuffer ? new SQL.Database(filebuffer) : new SQL.Database();
    db.run("PRAGMA foreign_keys = ON;");

    initTables(db);
    return db;
}

function initTables(database) {
    // 1. Table users
    database.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('mahasiswa', 'sekretaris_prodi', 'kaprodi', 'staff_tu', 'dosen', 'admin')),
            is_active INTEGER DEFAULT 1,
            is_email_verified INTEGER DEFAULT 0,
            email_verification_token TEXT,
            password_reset_token TEXT,
            password_reset_expires DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    try { database.run("ALTER TABLE users ADD COLUMN is_email_verified INTEGER DEFAULT 0;"); } catch(e){}
    try { database.run("ALTER TABLE users ADD COLUMN email_verification_token TEXT;"); } catch(e){}
    try { database.run("ALTER TABLE users ADD COLUMN password_reset_token TEXT;"); } catch(e){}
    try { database.run("ALTER TABLE users ADD COLUMN password_reset_expires DATETIME;"); } catch(e){}
    try { database.run("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';"); } catch(e){}

    // 2. Table mahasiswa
    database.run(`
        CREATE TABLE IF NOT EXISTS mahasiswa (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            nim TEXT UNIQUE NOT NULL,
            nama_lengkap TEXT NOT NULL,
            angkatan INTEGER NOT NULL,
            no_hp TEXT,
            judul_ta TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 3. Table dosen
    database.run(`
        CREATE TABLE IF NOT EXISTS dosen (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            nip_nidn TEXT UNIQUE NOT NULL,
            nama_dosen TEXT NOT NULL,
            jabatan TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 4. Table plotting_tugas_akhir
    database.run(`
        CREATE TABLE IF NOT EXISTS plotting_tugas_akhir (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mahasiswa_id INTEGER UNIQUE NOT NULL REFERENCES mahasiswa(id) ON DELETE CASCADE,
            dosen_pembimbing_1_id INTEGER NOT NULL REFERENCES dosen(id),
            dosen_pembimbing_2_id INTEGER NOT NULL REFERENCES dosen(id),
            dosen_penguji_1_id INTEGER REFERENCES dosen(id),
            dosen_penguji_2_id INTEGER REFERENCES dosen(id),
            dosen_penguji_3_id INTEGER REFERENCES dosen(id),
            sk_dekan_nomor TEXT,
            status_ta TEXT DEFAULT 'bimbingan' CHECK (status_ta IN ('bimbingan', 'sempro', 'sidang', 'lulus')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 5. Table jenis_surat
    database.run(`
        CREATE TABLE IF NOT EXISTS jenis_surat (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kode_surat TEXT UNIQUE NOT NULL,
            nama_surat TEXT NOT NULL,
            template_path TEXT NOT NULL,
            butuh_approval_pembimbing INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 6. Table pengajuan_surat
    database.run(`
        CREATE TABLE IF NOT EXISTS pengajuan_surat (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid_surat TEXT UNIQUE NOT NULL,
            mahasiswa_id INTEGER NOT NULL REFERENCES mahasiswa(id),
            jenis_surat_id INTEGER NOT NULL REFERENCES jenis_surat(id),
            nomor_surat TEXT DEFAULT NULL,
            perihal TEXT NOT NULL,
            data_dinamis TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'draft' CHECK (
                status IN (
                    'draft', 
                    'pending_pembimbing_1', 
                    'pending_pembimbing_2', 
                    'pending_sekprodi', 
                    'pending_kaprodi', 
                    'pending_tu', 
                    'selesai', 
                    'ditolak', 
                    'revisi'
                )
            ),
            approval_pembimbing_1 INTEGER DEFAULT 0,
            approval_pembimbing_2 INTEGER DEFAULT 0,
            qr_signature_hash TEXT DEFAULT NULL,
            ttd_tu_path TEXT DEFAULT NULL,
            ttd_sekprodi_path TEXT DEFAULT NULL,
            ttd_kaprodi_path TEXT DEFAULT NULL,
            created_by_role TEXT DEFAULT 'mahasiswa',
            tgl_pengajuan DATETIME DEFAULT CURRENT_TIMESTAMP,
            tgl_selesai DATETIME DEFAULT NULL
        );
    `);

    try { database.run("ALTER TABLE pengajuan_surat ADD COLUMN ttd_tu_path TEXT;"); } catch(e){}
    try { database.run("ALTER TABLE pengajuan_surat ADD COLUMN ttd_sekprodi_path TEXT;"); } catch(e){}
    try { database.run("ALTER TABLE pengajuan_surat ADD COLUMN ttd_kaprodi_path TEXT;"); } catch(e){}
    try { database.run("ALTER TABLE pengajuan_surat ADD COLUMN created_by_role TEXT DEFAULT 'mahasiswa';"); } catch(e){}


    // 7. Table google_drive_docs
    database.run(`
        CREATE TABLE IF NOT EXISTS google_drive_docs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pengajuan_surat_id INTEGER NOT NULL REFERENCES pengajuan_surat(id) ON DELETE CASCADE,
            gdrive_file_id TEXT NOT NULL,
            gdrive_folder_id TEXT NOT NULL,
            nama_file_original TEXT NOT NULL,
            kategori_berkas TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            file_size_bytes INTEGER NOT NULL,
            web_view_link TEXT NOT NULL,
            web_content_link TEXT NOT NULL,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 8. Table riwayat_disposisi
    database.run(`
        CREATE TABLE IF NOT EXISTS riwayat_disposisi (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pengajuan_surat_id INTEGER NOT NULL REFERENCES pengajuan_surat(id) ON DELETE CASCADE,
            actor_user_id INTEGER NOT NULL REFERENCES users(id),
            actor_role TEXT NOT NULL,
            status_sebelumnya TEXT NOT NULL,
            status_sesudahnya TEXT NOT NULL,
            catatan_revisi TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 10. Table jadwal_ujian
    database.run(`
        CREATE TABLE IF NOT EXISTS jadwal_ujian (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pengajuan_surat_id INTEGER REFERENCES pengajuan_surat(id) ON DELETE CASCADE,
            mahasiswa_id INTEGER NOT NULL REFERENCES mahasiswa(id) ON DELETE CASCADE,
            jenis_ujian TEXT NOT NULL,
            tanggal_ujian DATE NOT NULL,
            jam_mulai TEXT NOT NULL,
            jam_selesai TEXT NOT NULL,
            ruangan TEXT NOT NULL,
            judul_ta TEXT,
            pembimbing_1_id INTEGER REFERENCES dosen(id),
            pembimbing_2_id INTEGER REFERENCES dosen(id),
            status_ujian TEXT DEFAULT 'terjadwal',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 9. Table pengajuan_judul_ta [BARU]
    database.run(`
        CREATE TABLE IF NOT EXISTS pengajuan_judul_ta (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid_pengajuan TEXT UNIQUE NOT NULL,
            mahasiswa_id INTEGER NOT NULL REFERENCES mahasiswa(id) ON DELETE CASCADE,
            judul_1 TEXT NOT NULL,
            abstraksi_1 TEXT NOT NULL,
            tujuan_1 TEXT NOT NULL,
            manfaat_1 TEXT NOT NULL,
            judul_2 TEXT NOT NULL,
            abstraksi_2 TEXT NOT NULL,
            tujuan_2 TEXT NOT NULL,
            manfaat_2 TEXT NOT NULL,
            judul_3 TEXT NOT NULL,
            abstraksi_3 TEXT NOT NULL,
            tujuan_3 TEXT NOT NULL,
            manfaat_3 TEXT NOT NULL,
            judul_disetujui_nomor INTEGER DEFAULT 1,
            judul_ta TEXT,
            abstrak_rumusan TEXT,
            dosen_pembimbing_1_id INTEGER NOT NULL REFERENCES dosen(id),
            dosen_pembimbing_2_id INTEGER NOT NULL REFERENCES dosen(id),
            file_proposal_gdrive_id TEXT,
            file_proposal_url TEXT,
            status TEXT DEFAULT 'pending_tu' CHECK (
                status IN (
                    'pending_tu', 
                    'pending_sekprodi', 
                    'pending_kaprodi', 
                    'diterima', 
                    'ditolak', 
                    'revisi'
                )
            ),
            catatan_tu TEXT,
            catatan_sekprodi TEXT,
            catatan_kaprodi TEXT,
            pembimbing_1_status TEXT DEFAULT 'pending' CHECK (pembimbing_1_status IN ('pending', 'bersedia', 'menolak')),
            pembimbing_2_status TEXT DEFAULT 'pending' CHECK (pembimbing_2_status IN ('pending', 'bersedia', 'menolak')),
            catatan_pembimbing_1 TEXT,
            catatan_pembimbing_2 TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    try { database.run("ALTER TABLE pengajuan_judul_ta ADD COLUMN judul_1 TEXT;"); } catch(e){}
    try { database.run("ALTER TABLE pengajuan_judul_ta ADD COLUMN abstraksi_1 TEXT;"); } catch(e){}
    try { database.run("ALTER TABLE pengajuan_judul_ta ADD COLUMN tujuan_1 TEXT;"); } catch(e){}
    try { database.run("ALTER TABLE pengajuan_judul_ta ADD COLUMN manfaat_1 TEXT;"); } catch(e){}
    try { database.run("ALTER TABLE pengajuan_judul_ta ADD COLUMN judul_2 TEXT;"); } catch(e){}
    try { database.run("ALTER TABLE pengajuan_judul_ta ADD COLUMN abstraksi_2 TEXT;"); } catch(e){}
    try { database.run("ALTER TABLE pengajuan_judul_ta ADD COLUMN tujuan_2 TEXT;"); } catch(e){}
    try { database.run("ALTER TABLE pengajuan_judul_ta ADD COLUMN manfaat_2 TEXT;"); } catch(e){}
    try { database.run("ALTER TABLE pengajuan_judul_ta ADD COLUMN judul_3 TEXT;"); } catch(e){}
    try { database.run("ALTER TABLE pengajuan_judul_ta ADD COLUMN abstraksi_3 TEXT;"); } catch(e){}
    try { database.run("ALTER TABLE pengajuan_judul_ta ADD COLUMN tujuan_3 TEXT;"); } catch(e){}
    try { database.run("ALTER TABLE pengajuan_judul_ta ADD COLUMN manfaat_3 TEXT;"); } catch(e){}
    try { database.run("ALTER TABLE pengajuan_judul_ta ADD COLUMN judul_disetujui_nomor INTEGER DEFAULT 1;"); } catch(e){}


    seedData(database);
    saveDb();
}

function seedData(database) {
    const checkJenis = database.exec("SELECT COUNT(*) as count FROM jenis_surat");
    const countJenis = checkJenis.length > 0 ? checkJenis[0].values[0][0] : 0;

    // Cleanup removed jenis_surat records if existing
    database.run("DELETE FROM jenis_surat WHERE kode_surat IN ('SRT-RISET', 'SK-PEMBIMBING', 'SK-BEBAS-TA', 'SRT-SELESAI-PENELITIAN');");

    if (countJenis === 0) {
        database.run("INSERT INTO jenis_surat (kode_surat, nama_surat, template_path, butuh_approval_pembimbing) VALUES ('SRT-IZIN-PENELITIAN', 'Surat Izin Penelitian Instansi / Perusahaan', 'surat_izin_penelitian', 1);");
        database.run("INSERT INTO jenis_surat (kode_surat, nama_surat, template_path, butuh_approval_pembimbing) VALUES ('SK-PEMBIMBING-PENGUJI', 'Surat Keputusan (SK) Dosen Pembimbing & Penguji TA', 'sk_pembimbing_penguji', 1);");
        database.run("INSERT INTO jenis_surat (kode_surat, nama_surat, template_path, butuh_approval_pembimbing) VALUES ('KARTU-BIMBINGAN', 'Kartu Bimbingan Tugas Akhir / Skripsi', 'kartu_bimbingan', 1);");
        database.run("INSERT INTO jenis_surat (kode_surat, nama_surat, template_path, butuh_approval_pembimbing) VALUES ('UND-SEMPRO', 'Surat Undangan Seminar Proposal (Sempro)', 'undangan_sempro', 1);");
        database.run("INSERT INTO jenis_surat (kode_surat, nama_surat, template_path, butuh_approval_pembimbing) VALUES ('UND-SEMHAS', 'Surat Undangan Seminar Hasil (Semhas)', 'undangan_semhas', 1);");
        database.run("INSERT INTO jenis_surat (kode_surat, nama_surat, template_path, butuh_approval_pembimbing) VALUES ('LMBR-PERSETUJUAN-WKT', 'Lembar Persetujuan Waktu Ujian / Seminar', 'lembar_persetujuan_waktu', 1);");
        database.run("INSERT INTO jenis_surat (kode_surat, nama_surat, template_path, butuh_approval_pembimbing) VALUES ('UND-SIDANG', 'Surat Undangan Sidang Akhir / Munaqasyah', 'undangan_sidang', 1);");
        database.run("INSERT INTO jenis_surat (kode_surat, nama_surat, template_path, butuh_approval_pembimbing) VALUES ('LMBR-PENGESAHAN', 'Lembar Pengesahan Skripsi / Tugas Akhir', 'lembar_pengesahan', 1);");
        database.run("INSERT INTO jenis_surat (kode_surat, nama_surat, template_path, butuh_approval_pembimbing) VALUES ('BA-UJIAN', 'Berita Acara Ujian / Seminar Tugas Akhir', 'berita_acara_ujian', 1);");
    } else {
        const checkAndInsert = (kode, nama, tmpl) => {
            const res = database.exec(`SELECT COUNT(*) as count FROM jenis_surat WHERE kode_surat = '${kode}'`);
            if (!res || res.length === 0 || res[0].values[0][0] === 0) {
                database.run(`INSERT INTO jenis_surat (kode_surat, nama_surat, template_path, butuh_approval_pembimbing) VALUES ('${kode}', '${nama}', '${tmpl}', 1);`);
            }
        };
        checkAndInsert('SRT-IZIN-PENELITIAN', 'Surat Izin Penelitian Instansi / Perusahaan', 'surat_izin_penelitian');
        checkAndInsert('SRT-SELESAI-PENELITIAN', 'Surat Keterangan Telah Melakukan Penelitian', 'surat_selesai_penelitian');
        checkAndInsert('UND-SEMHAS', 'Surat Undangan Seminar Hasil (Semhas)', 'undangan_semhas');
        checkAndInsert('BA-UJIAN', 'Berita Acara Ujian / Seminar Tugas Akhir', 'berita_acara_ujian');
        checkAndInsert('SK-PEMBIMBING-PENGUJI', 'Surat Keputusan (SK) Dosen Pembimbing & Penguji TA', 'sk_pembimbing_penguji');
        checkAndInsert('KARTU-BIMBINGAN', 'Kartu Bimbingan Tugas Akhir / Skripsi', 'kartu_bimbingan');
        checkAndInsert('LMBR-PERSETUJUAN-WKT', 'Lembar Persetujuan Waktu Ujian / Seminar', 'lembar_persetujuan_waktu');
        checkAndInsert('LMBR-PENGESAHAN', 'Lembar Pengesahan Skripsi / Tugas Akhir', 'lembar_pengesahan');
    }

    // Migration: Remove admin role and migrate any existing admin users to staff_tu
    database.run("UPDATE users SET role = 'staff_tu' WHERE role = 'admin'");
    database.run("DELETE FROM users WHERE username = 'admin'");

    const checkUser = database.exec("SELECT COUNT(*) as count FROM users");
    const countUser = checkUser.length > 0 ? checkUser[0].values[0][0] : 0;

    if (countUser === 0) {
        const passHash = (plain) => bcrypt.hashSync(plain, 10);

        database.run("INSERT INTO users (username, email, password_hash, role, is_email_verified) VALUES (?, ?, ?, ?, 1)", ['mahasiswa', 'mahasiswa@univ.ac.id', passHash('mhs123'), 'mahasiswa']);
        const mhsUserRes = database.exec("SELECT id FROM users WHERE username = 'mahasiswa'");
        const mhsUserId = mhsUserRes[0].values[0][0];
        database.run("INSERT INTO mahasiswa (user_id, nim, nama_lengkap, angkatan, no_hp, judul_ta) VALUES (?, ?, ?, ?, ?, ?)", [mhsUserId, '21081010001', 'Ahmad Fauzi', 2021, '081234567890', 'Rancang Bangun Sistem E-Surat Berbasis Microservices']);

        database.run("INSERT INTO users (username, email, password_hash, role, is_email_verified) VALUES (?, ?, ?, ?, 1)", ['sekprodi', 'sekprodi@univ.ac.id', passHash('sekprodi123'), 'sekretaris_prodi']);

        database.run("INSERT INTO users (username, email, password_hash, role, is_email_verified) VALUES (?, ?, ?, ?, 1)", ['kaprodi', 'kaprodi@univ.ac.id', passHash('kaprodi123'), 'kaprodi']);
        const kaprodiUserRes = database.exec("SELECT id FROM users WHERE username = 'kaprodi'");
        const kaprodiUserId = kaprodiUserRes[0].values[0][0];
        database.run("INSERT INTO dosen (user_id, nip_nidn, nama_dosen, jabatan) VALUES (?, ?, ?, ?)", [kaprodiUserId, '198501012010121001', 'Dr. Eng. Nama Kaprodi, M.T.', 'Ketua Program Studi']);

        database.run("INSERT INTO users (username, email, password_hash, role, is_email_verified) VALUES (?, ?, ?, ?, 1)", ['stafftu', 'stafftu@univ.ac.id', passHash('tu123'), 'staff_tu']);

        database.run("INSERT INTO users (username, email, password_hash, role, is_email_verified) VALUES (?, ?, ?, ?, 1)", ['pembimbing1', 'pembimbing1@univ.ac.id', passHash('dosen123'), 'dosen']);
        const p1UserRes = database.exec("SELECT id FROM users WHERE username = 'pembimbing1'");
        database.run("INSERT INTO dosen (user_id, nip_nidn, nama_dosen, jabatan) VALUES (?, ?, ?, ?)", [p1UserRes[0].values[0][0], '197805122005011002', 'Prof. Dr. Ir. Budi Santoso, M.Kom.', 'Guru Besar / Pembimbing Utama']);

        database.run("INSERT INTO users (username, email, password_hash, role, is_email_verified) VALUES (?, ?, ?, ?, 1)", ['pembimbing2', 'pembimbing2@univ.ac.id', passHash('dosen123'), 'dosen']);
        const p2UserRes = database.exec("SELECT id FROM users WHERE username = 'pembimbing2'");
        database.run("INSERT INTO dosen (user_id, nip_nidn, nama_dosen, jabatan) VALUES (?, ?, ?, ?)", [p2UserRes[0].values[0][0], '198203152008042003', 'Siti Rahmawati, S.T., M.T.', 'Lektor Kepala / Pembimbing Pendamping']);

        database.run("INSERT INTO users (username, email, password_hash, role, is_email_verified) VALUES (?, ?, ?, ?, 1)", ['penguji1', 'penguji1@univ.ac.id', passHash('dosen123'), 'dosen']);
        const u1UserRes = database.exec("SELECT id FROM users WHERE username = 'penguji1'");
        database.run("INSERT INTO dosen (user_id, nip_nidn, nama_dosen, jabatan) VALUES (?, ?, ?, ?)", [u1UserRes[0].values[0][0], '197509102003121004', 'Dr. Agus Setiawan, M.Sc.', 'Ketua Penguji']);

        database.run("INSERT INTO users (username, email, password_hash, role, is_email_verified) VALUES (?, ?, ?, ?, 1)", ['penguji2', 'penguji2@univ.ac.id', passHash('dosen123'), 'dosen']);
        const u2UserRes = database.exec("SELECT id FROM users WHERE username = 'penguji2'");
        database.run("INSERT INTO dosen (user_id, nip_nidn, nama_dosen, jabatan) VALUES (?, ?, ?, ?)", [u2UserRes[0].values[0][0], '198811202015041005', 'Dian Lestari, M.T.', 'Penguji Anggota 1']);

        database.run("INSERT INTO users (username, email, password_hash, role, is_email_verified) VALUES (?, ?, ?, ?, 1)", ['penguji3', 'penguji3@univ.ac.id', passHash('dosen123'), 'dosen']);
        const u3UserRes = database.exec("SELECT id FROM users WHERE username = 'penguji3'");
        database.run("INSERT INTO dosen (user_id, nip_nidn, nama_dosen, jabatan) VALUES (?, ?, ?, ?)", [u3UserRes[0].values[0][0], '199002142019032006', 'Eko Prasetyo, M.Comp.', 'Penguji Anggota 2']);

        const mhsId = database.exec("SELECT id FROM mahasiswa WHERE nim = '21081010001'")[0].values[0][0];
        const p1Id = database.exec("SELECT id FROM dosen WHERE nip_nidn = '197805122005011002'")[0].values[0][0];
        const p2Id = database.exec("SELECT id FROM dosen WHERE nip_nidn = '198203152008042003'")[0].values[0][0];
        const u1Id = database.exec("SELECT id FROM dosen WHERE nip_nidn = '197509102003121004'")[0].values[0][0];
        const u2Id = database.exec("SELECT id FROM dosen WHERE nip_nidn = '198811202015041005'")[0].values[0][0];
        const u3Id = database.exec("SELECT id FROM dosen WHERE nip_nidn = '199002142019032006'")[0].values[0][0];

        database.run("INSERT INTO plotting_tugas_akhir (mahasiswa_id, dosen_pembimbing_1_id, dosen_pembimbing_2_id, dosen_penguji_1_id, dosen_penguji_2_id, dosen_penguji_3_id, sk_dekan_nomor, status_ta) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [mhsId, p1Id, p2Id, u1Id, u2Id, u3Id, 'SK-DEKAN/2026/089', 'bimbingan']);
    }
}

class DatabaseWrapper {
    static async query(sql, params = []) {
        const instance = await getDbInstance();
        const res = instance.exec(sql, params);
        saveDb();
        if (!res || res.length === 0) return [];
        const columns = res[0].columns;
        return res[0].values.map(row => {
            const obj = {};
            columns.forEach((col, idx) => {
                obj[col] = row[idx];
            });
            return obj;
        });
    }

    static async get(sql, params = []) {
        const rows = await this.query(sql, params);
        return rows.length > 0 ? rows[0] : null;
    }

    static async run(sql, params = []) {
        const instance = await getDbInstance();
        instance.run(sql, params);
        saveDb();
        return true;
    }
}

module.exports = DatabaseWrapper;
