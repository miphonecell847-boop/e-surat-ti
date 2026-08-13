const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const isVercel = process.env.VERCEL || process.env.NOW_BUILDER;
const originalDbPath = path.join(__dirname, '../e_surat.db');
const dbPath = isVercel ? path.join('/tmp', 'e_surat.db') : originalDbPath;

let db = null;

function saveDb() {
    if (db) {
        try {
            const data = db.export();
            const buffer = Buffer.from(data);
            fs.writeFileSync(dbPath, buffer);
        } catch (e) {
            console.error("saveDb error:", e.message);
        }
    }
}

async function getDbInstance() {
    if (db) return db;

    const SQL = await initSqlJs();
    let filebuffer = null;

    if (isVercel && !fs.existsSync(dbPath) && fs.existsSync(originalDbPath)) {
        try {
            fs.copyFileSync(originalDbPath, dbPath);
        } catch (e) {
            console.error("Failed to copy database to /tmp:", e);
        }
    }

    if (fs.existsSync(dbPath)) {
        filebuffer = fs.readFileSync(dbPath);
    } else if (fs.existsSync(originalDbPath)) {
        filebuffer = fs.readFileSync(originalDbPath);
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
            no_hp TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    try { database.run("ALTER TABLE dosen ADD COLUMN no_hp TEXT;"); } catch(e){}

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

    // 11. Table persetujuan_jadwal_dosen (Persetujuan & Usulan Waktu Ujian 5 Dosen)
    database.run(`
        CREATE TABLE IF NOT EXISTS persetujuan_jadwal_dosen (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pengajuan_surat_id INTEGER NOT NULL REFERENCES pengajuan_surat(id) ON DELETE CASCADE,
            dosen_id INTEGER NOT NULL REFERENCES dosen(id) ON DELETE CASCADE,
            peran_dosen TEXT NOT NULL,
            status_persetujuan TEXT DEFAULT 'setuju',
            tanggal_usulan DATE,
            jam_mulai_usulan TEXT,
            jam_selesai_usulan TEXT,
            ruangan_usulan TEXT,
            catatan TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(pengajuan_surat_id, dosen_id)
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
            dosen_pembimbing_1_id INTEGER REFERENCES dosen(id),
            dosen_pembimbing_2_id INTEGER REFERENCES dosen(id),
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

    // Migration: Ensure dosen_pembimbing_1_id in pengajuan_judul_ta allows NULL
    try {
        const schemaRes = database.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='pengajuan_judul_ta'");
        if (schemaRes && schemaRes.length > 0 && schemaRes[0].values.length > 0) {
            const tableSql = schemaRes[0].values[0][0];
            if (tableSql && tableSql.includes('dosen_pembimbing_1_id INTEGER NOT NULL')) {
                database.run("PRAGMA foreign_keys = OFF;");
                database.run("ALTER TABLE pengajuan_judul_ta RENAME TO pengajuan_judul_ta_old;");
                database.run(`
                    CREATE TABLE pengajuan_judul_ta (
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
                        dosen_pembimbing_1_id INTEGER REFERENCES dosen(id),
                        dosen_pembimbing_2_id INTEGER REFERENCES dosen(id),
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
                database.run(`
                    INSERT INTO pengajuan_judul_ta 
                    (id, uuid_pengajuan, mahasiswa_id, judul_1, abstraksi_1, tujuan_1, manfaat_1, judul_2, abstraksi_2, tujuan_2, manfaat_2, judul_3, abstraksi_3, tujuan_3, manfaat_3, judul_disetujui_nomor, judul_ta, abstrak_rumusan, dosen_pembimbing_1_id, dosen_pembimbing_2_id, file_proposal_gdrive_id, file_proposal_url, status, catatan_tu, catatan_sekprodi, catatan_kaprodi, pembimbing_1_status, pembimbing_2_status, catatan_pembimbing_1, catatan_pembimbing_2, created_at, updated_at)
                    SELECT id, uuid_pengajuan, mahasiswa_id, COALESCE(judul_1, judul_ta), COALESCE(abstraksi_1, abstrak_rumusan), COALESCE(tujuan_1, '-'), COALESCE(manfaat_1, '-'), COALESCE(judul_2, '-'), COALESCE(abstraksi_2, '-'), COALESCE(tujuan_2, '-'), COALESCE(manfaat_2, '-'), COALESCE(judul_3, '-'), COALESCE(abstraksi_3, '-'), COALESCE(tujuan_3, '-'), COALESCE(manfaat_3, '-'), COALESCE(judul_disetujui_nomor, 1), judul_ta, abstrak_rumusan, dosen_pembimbing_1_id, dosen_pembimbing_2_id, file_proposal_gdrive_id, file_proposal_url, status, catatan_tu, catatan_sekprodi, catatan_kaprodi, pembimbing_1_status, pembimbing_2_status, catatan_pembimbing_1, catatan_pembimbing_2, created_at, updated_at
                    FROM pengajuan_judul_ta_old;
                `);
                database.run("DROP TABLE pengajuan_judul_ta_old;");
                database.run("PRAGMA foreign_keys = ON;");
            }
        }
    } catch(e) {
        console.error("Migration pengajuan_judul_ta error:", e);
    }


    seedData(database);
    saveDb();
}

function seedData(database) {
    const checkJenis = database.exec("SELECT COUNT(*) as count FROM jenis_surat");
    const countJenis = checkJenis.length > 0 ? checkJenis[0].values[0][0] : 0;

    // Cleanup removed jenis_surat records if existing
    database.run("DELETE FROM jenis_surat WHERE kode_surat IN ('SRT-RISET', 'SK-PEMBIMBING', 'SK-BEBAS-TA', 'SRT-SELESAI-PENELITIAN', 'LMBR-PENGESAHAN');");

    if (countJenis === 0) {
        database.run("INSERT INTO jenis_surat (kode_surat, nama_surat, template_path, butuh_approval_pembimbing) VALUES ('SRT-IZIN-PENELITIAN', 'Surat Izin Penelitian Instansi / Perusahaan', 'surat_izin_penelitian', 1);");
        database.run("INSERT INTO jenis_surat (kode_surat, nama_surat, template_path, butuh_approval_pembimbing) VALUES ('SK-PEMBIMBING-PENGUJI', 'Surat Keputusan (SK) Dosen Pembimbing & Penguji TA', 'sk_pembimbing_penguji', 1);");
        database.run("INSERT INTO jenis_surat (kode_surat, nama_surat, template_path, butuh_approval_pembimbing) VALUES ('KARTU-BIMBINGAN', 'Kartu Bimbingan Tugas Akhir / Skripsi', 'kartu_bimbingan', 1);");
        database.run("INSERT INTO jenis_surat (kode_surat, nama_surat, template_path, butuh_approval_pembimbing) VALUES ('UND-SEMPRO', 'Surat Undangan Seminar Proposal (Sempro)', 'undangan_sempro', 1);");
        database.run("INSERT INTO jenis_surat (kode_surat, nama_surat, template_path, butuh_approval_pembimbing) VALUES ('UND-SEMHAS', 'Surat Undangan Seminar Hasil (Semhas)', 'undangan_semhas', 1);");
        database.run("INSERT INTO jenis_surat (kode_surat, nama_surat, template_path, butuh_approval_pembimbing) VALUES ('LMBR-PERSETUJUAN-WKT', 'Lembar Persetujuan Waktu Ujian / Seminar', 'lembar_persetujuan_waktu', 1);");
        database.run("INSERT INTO jenis_surat (kode_surat, nama_surat, template_path, butuh_approval_pembimbing) VALUES ('UND-SIDANG', 'Surat Undangan Sidang Akhir / Munaqasyah', 'undangan_sidang', 1);");
        database.run("INSERT INTO jenis_surat (kode_surat, nama_surat, template_path, butuh_approval_pembimbing) VALUES ('BA-UJIAN', 'Berita Acara Ujian / Seminar Tugas Akhir', 'berita_acara_ujian', 1);");
    } else {
        const checkAndInsert = (kode, nama, tmpl) => {
            const res = database.exec(`SELECT COUNT(*) as count FROM jenis_surat WHERE kode_surat = '${kode}'`);
            if (!res || res.length === 0 || res[0].values[0][0] === 0) {
                database.run(`INSERT INTO jenis_surat (kode_surat, nama_surat, template_path, butuh_approval_pembimbing) VALUES ('${kode}', '${nama}', '${tmpl}', 1);`);
            }
        };
        checkAndInsert('SRT-IZIN-PENELITIAN', 'Surat Izin Penelitian Instansi / Perusahaan', 'surat_izin_penelitian');
        checkAndInsert('UND-SEMHAS', 'Surat Undangan Seminar Hasil (Semhas)', 'undangan_semhas');
        checkAndInsert('BA-UJIAN', 'Berita Acara Ujian / Seminar Tugas Akhir', 'berita_acara_ujian');
        checkAndInsert('SK-PEMBIMBING-PENGUJI', 'Surat Keputusan (SK) Dosen Pembimbing & Penguji TA', 'sk_pembimbing_penguji');
        checkAndInsert('KARTU-BIMBINGAN', 'Kartu Bimbingan Tugas Akhir / Skripsi', 'kartu_bimbingan');
        checkAndInsert('LMBR-PERSETUJUAN-WKT', 'Lembar Persetujuan Waktu Ujian / Seminar', 'lembar_persetujuan_waktu');
    }

    // Migration & Auto-seed: Guarantee single Administrator account (admin) & 123456 password hash
    const defaultPassHash = bcrypt.hashSync('123456', 10);
    database.run("UPDATE users SET role = 'admin' WHERE role IN ('staff_tu', 'stafftu', 'sekretaris_prodi', 'sekprodi', 'kaprodi', 'tu')");

    const checkAdmin = database.exec("SELECT id FROM users WHERE username = 'admin'");
    if (!checkAdmin || checkAdmin.length === 0 || checkAdmin[0].values.length === 0) {
        database.run("INSERT INTO users (username, email, password_hash, role, is_active, is_email_verified, status) VALUES ('admin', 'admin@unidayan.ac.id', ?, 'admin', 1, 1, 'active')", [defaultPassHash]);
    } else {
        database.run("UPDATE users SET password_hash = ?, role = 'admin', is_active = 1, status = 'active' WHERE username = 'admin'", [defaultPassHash]);
    }
    
    // Sync default password hash 123456 for all active accounts
    database.run("UPDATE users SET password_hash = ?", [defaultPassHash]);

    seedOfficialDosenList(database, defaultPassHash);

    // Clean up legacy dummy dosen accounts permanently
    try { database.run("PRAGMA foreign_keys = OFF;"); } catch(e){}
    try { database.run("DELETE FROM disposisi_surat WHERE penerima_user_id IN (SELECT id FROM users WHERE username IN ('pembimbing1', 'pembimbing2', 'penguji1', 'penguji2', 'penguji3')) OR pengirim_user_id IN (SELECT id FROM users WHERE username IN ('pembimbing1', 'pembimbing2', 'penguji1', 'penguji2', 'penguji3'))"); } catch(e){}
    try { database.run("DELETE FROM log_surat WHERE user_id IN (SELECT id FROM users WHERE username IN ('pembimbing1', 'pembimbing2', 'penguji1', 'penguji2', 'penguji3'))"); } catch(e){}
    try { database.run("DELETE FROM plotting_tugas_akhir WHERE dosen_pembimbing_1_id IN (SELECT id FROM dosen WHERE user_id IN (SELECT id FROM users WHERE username IN ('pembimbing1', 'pembimbing2', 'penguji1', 'penguji2', 'penguji3'))) OR dosen_pembimbing_2_id IN (SELECT id FROM dosen WHERE user_id IN (SELECT id FROM users WHERE username IN ('pembimbing1', 'pembimbing2', 'penguji1', 'penguji2', 'penguji3')))"); } catch(e){}
    try { database.run("DELETE FROM dosen WHERE user_id IN (SELECT id FROM users WHERE username IN ('pembimbing1', 'pembimbing2', 'penguji1', 'penguji2', 'penguji3'))"); } catch(e){}
    try { database.run("DELETE FROM users WHERE username IN ('pembimbing1', 'pembimbing2', 'penguji1', 'penguji2', 'penguji3')"); } catch(e){}
    try { database.run("UPDATE mahasiswa SET judul_ta = NULL WHERE id NOT IN (SELECT mahasiswa_id FROM pengajuan_judul_ta WHERE status = 'approved' OR status = 'acc') AND id NOT IN (SELECT mahasiswa_id FROM plotting_tugas_akhir)"); } catch(e){}
    saveDb();

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

        const mhsRes = database.exec("SELECT id FROM mahasiswa WHERE nim = '21081010001'");
        const p1Res = database.exec("SELECT id FROM dosen WHERE nip_nidn = '0724027801'");
        const p2Res = database.exec("SELECT id FROM dosen WHERE nip_nidn = '0915058201'");

        if (mhsRes && mhsRes.length > 0 && p1Res && p1Res.length > 0 && p2Res && p2Res.length > 0) {
            const mhsId = mhsRes[0].values[0][0];
            const p1Id = p1Res[0].values[0][0];
            const p2Id = p2Res[0].values[0][0];
            database.run("INSERT INTO plotting_tugas_akhir (mahasiswa_id, dosen_pembimbing_1_id, dosen_pembimbing_2_id, sk_dekan_nomor, status_ta) VALUES (?, ?, ?, ?, ?)", [mhsId, p1Id, p2Id, 'SK-DEKAN/2026/089', 'bimbingan']);
        }
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

const officialDosenList = [
    { username: 'arifsuryawan', email: 'arwan97@unidayan.ac.id', name: 'Ir. MOH. ARIF SURYAWAN, S.Kom., M.T.', nidn: '0724027801', jabatan: 'LEKTOR' },
    { username: 'naldy', email: 'naldy@ylab.akyutech.ac.jp', name: 'Ir. NALDY NIRMANTO TJONDRONEGORO. S.Kom., M.T.', nidn: '0915058201', jabatan: 'ASISTEN AHLI' },
    { username: 'erymuchyar', email: 'erymuchyarhasiri@unidayan.ac.id', name: 'Ir. ERY MUCHYAR HASIRI, S.Kom., M.T.', nidn: '0913098203', jabatan: 'LEKTOR' },
    { username: 'laraufun', email: 'el.raufun@gmail.com', name: 'LA RAUFUN, S.T., M.T.', nidn: '0922058101', jabatan: 'LEKTOR' },
    { username: 'azlin', email: 'azlin.unidayan01@gmail.com', name: 'AZLIN, S.Kom., M.T.', nidn: '0906118502', jabatan: 'LEKTOR' },
    { username: 'fajarisrawan', email: 'fajarisrawan@unidayan.ac.id', name: 'Ir. LM. FAJAR ISRAWAN, S.Kom., M.Kom., M.M.', nidn: '0505078501', jabatan: 'LEKTOR' },
    { username: 'asniati', email: 'asniatiangi@unidayan.ac.id', name: 'Ir. ASNIATI, S.T., M.T.', nidn: '0910096701', jabatan: 'LEKTOR' },
    { username: 'muhiradat', email: 'muhamadiradatachmad@unidayan.ac.id', name: 'Dr. Ir. MUH IRADAT ACHMAD, S.T., M.T.', nidn: '0911047304', jabatan: 'LEKTOR' },
    { username: 'muhammadmukmin', email: 'muhammadmukmin@unidayan.ac.id', name: 'MUHAMMAD MUKMIN, S.Kom., M.T.', nidn: '0920118301', jabatan: 'LEKTOR' },
    { username: 'hennyhamsinar', email: 'hennyhamsinar@unidayan.ac.id', name: 'Ir. HENNY HAMSINAR, S.Kom., M.T., M.M.', nidn: '0917018602', jabatan: 'LEKTOR' },
    { username: 'jabalnur', email: 'jabalnur@unidayan.ac.id', name: 'Ir. JABAL NUR, S.Kom., M.T.', nidn: '0919058001', jabatan: 'LEKTOR' },
    { username: 'fithriah', email: 'fith.musadat@gmail.com', name: 'FITHRIAH MUSADAT, S.Si., M.T.', nidn: '0930058705', jabatan: 'LEKTOR' },
    { username: 'arifsyam', email: 'arifsyam@unidayan.ac.id', name: 'ARIF SYAM, S.Kom., M.Kom.', nidn: '0909028703', jabatan: 'LEKTOR' },
    { username: 'laatina', email: 'laatina@unidayan.ac.id', name: 'LA ATINA, S.T., M.T.', nidn: '0910038203', jabatan: 'LEKTOR' },
    { username: 'christopol', email: 'christopoleddy@unidayan.ac.id', name: 'Ir. CHRISTOPOL EDDY, M.Eng.', nidn: '0912126101', jabatan: 'LEKTOR' },
    { username: 'sultanhady', email: 'sultanhady@unidayan.ac.id', name: 'Ir. SULTAN HADY, S.T., M.T.', nidn: '0910068901', jabatan: 'LEKTOR' },
    { username: 'nalis', email: 'nhaliez@gmail.com', name: 'NALIS HENDRAWAN, S.T., M.T.', nidn: '0921128902', jabatan: 'LEKTOR' },
    { username: 'helson', email: 'helson24@gmail.com', name: 'HELSON HAMID, S.T., M.T.', nidn: '0918088903', jabatan: 'LEKTOR' },
    { username: 'ahmadmaulid', email: 'ahmadmaulid22@gmail.com', name: 'AHMAD MAULID ASMIDDIN, S.T., M.T.', nidn: '0925099004', jabatan: 'LEKTOR' },
    { username: 'rahmaudaya', email: 'rahmamanarfa@unidayan.ac.id', name: 'WA ODE RAHMA AGUS UDAYA MANARFA, S.T., M.Kom.', nidn: '0913049103', jabatan: 'ASISTEN AHLI' },
    { username: 'nurulhidayah', email: 'nurul.hyh@gmail.com', name: 'NURUL HIDAYAH, S.Kom., M.Kom.', nidn: '0906029603', jabatan: 'ASISTEN AHLI' },
    { username: 'dodiman', email: 'dodimantakimpoo@gmail.com', name: 'DODIMAN, S.Kom., M.Kom.', nidn: '0928079403', jabatan: 'ASISTEN AHLI' },
    { username: 'rasmuin', email: 'rasmuin@unidayan.ac.id', name: 'Prof. Dr. RASMUIN, S.Pd., M.Pd.', nidn: '196812311994031012', jabatan: 'GURU BESAR' },
    { username: 'rasyidsabirin', email: 'rasyidsabirin.saw@gmail.com', name: 'KH. ABDUL RASYID SABIRIN, Lc., MA.', nidn: '0914047306', jabatan: 'LEKTOR' }
];

function seedOfficialDosenList(database, defaultPassHash) {
    officialDosenList.forEach(d => {
        const checkU = database.exec(`SELECT id FROM users WHERE username = '${d.username}'`);
        let userId;
        if (!checkU || checkU.length === 0 || checkU[0].values.length === 0) {
            database.run(`INSERT INTO users (username, email, password_hash, role, is_active, is_email_verified, status) VALUES ('${d.username}', '${d.email}', ?, 'dosen', 1, 1, 'active')`, [defaultPassHash]);
            const getU = database.exec(`SELECT id FROM users WHERE username = '${d.username}'`);
            userId = getU[0].values[0][0];
        } else {
            userId = checkU[0].values[0][0];
        }

        const checkD = database.exec(`SELECT id FROM dosen WHERE user_id = ${userId}`);
        if (!checkD || checkD.length === 0 || checkD[0].values.length === 0) {
            try {
                database.run(`INSERT INTO dosen (user_id, nip_nidn, nama_dosen, jabatan) VALUES (${userId}, '${d.nidn}', '${d.name.replace(/'/g, "''")}', '${d.jabatan}')`);
            } catch(e){}
        } else {
            try {
                database.run(`UPDATE dosen SET nip_nidn = '${d.nidn}', nama_dosen = '${d.name.replace(/'/g, "''")}', jabatan = '${d.jabatan}' WHERE user_id = ${userId}`);
            } catch(e){}
        }
    });
}

module.exports = DatabaseWrapper;
