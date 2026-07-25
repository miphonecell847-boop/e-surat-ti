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

// Synchronous / Promise-based init
async function getDbInstance() {
    if (db) return db;

    const SQL = await initSqlJs();
    let filebuffer = null;
    if (fs.existsSync(dbPath)) {
        filebuffer = fs.readFileSync(dbPath);
    }

    db = filebuffer ? new SQL.Database(filebuffer) : new SQL.Database();
    
    // Enable Foreign Keys
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

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
            tgl_pengajuan DATETIME DEFAULT CURRENT_TIMESTAMP,
            tgl_selesai DATETIME DEFAULT NULL
        );
    `);

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

    seedData(database);
    saveDb();
}

function seedData(database) {
    const checkJenis = database.exec("SELECT COUNT(*) as count FROM jenis_surat");
    const countJenis = checkJenis.length > 0 ? checkJenis[0].values[0][0] : 0;

    if (countJenis === 0) {
        database.run("INSERT INTO jenis_surat (kode_surat, nama_surat, template_path, butuh_approval_pembimbing) VALUES ('SRT-RISET', 'Surat Pengantar Riset / Penelitian Instansi', 'surat_pengantar_riset', 1);");
        database.run("INSERT INTO jenis_surat (kode_surat, nama_surat, template_path, butuh_approval_pembimbing) VALUES ('SK-PEMBIMBING', 'Surat Permohonan Penetapan Dosen Pembimbing Skripsi', 'sk_pembimbing_ta', 1);");
        database.run("INSERT INTO jenis_surat (kode_surat, nama_surat, template_path, butuh_approval_pembimbing) VALUES ('UND-SEMPRO', 'Surat Undangan Seminar Proposal (Sempro)', 'undangan_sempro', 1);");
        database.run("INSERT INTO jenis_surat (kode_surat, nama_surat, template_path, butuh_approval_pembimbing) VALUES ('UND-SIDANG', 'Surat Undangan Sidang Akhir / Munaqasyah', 'undangan_sidang', 1);");
        database.run("INSERT INTO jenis_surat (kode_surat, nama_surat, template_path, butuh_approval_pembimbing) VALUES ('SK-BEBAS-TA', 'Surat Keterangan Bebas Laboratorium & Revisi (Bebas Masalah TA)', 'sk_bebas_ta', 1);");
    }

    const checkUser = database.exec("SELECT COUNT(*) as count FROM users");
    const countUser = checkUser.length > 0 ? checkUser[0].values[0][0] : 0;

    if (countUser === 0) {
        const passHash = (plain) => bcrypt.hashSync(plain, 10);

        // 1. Admin
        database.run("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)", ['admin', 'admin@univ.ac.id', passHash('admin123'), 'admin']);

        // 2. Mahasiswa
        database.run("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)", ['mahasiswa', 'mahasiswa@univ.ac.id', passHash('mhs123'), 'mahasiswa']);
        const mhsUserRes = database.exec("SELECT id FROM users WHERE username = 'mahasiswa'");
        const mhsUserId = mhsUserRes[0].values[0][0];
        database.run("INSERT INTO mahasiswa (user_id, nim, nama_lengkap, angkatan, no_hp, judul_ta) VALUES (?, ?, ?, ?, ?, ?)", [mhsUserId, '21081010001', 'Ahmad Fauzi', 2021, '081234567890', 'Rancang Bangun Sistem E-Surat Berbasis Microservices']);

        // 3. Sekprodi
        database.run("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)", ['sekprodi', 'sekprodi@univ.ac.id', passHash('sekprodi123'), 'sekretaris_prodi']);

        // 4. Kaprodi
        database.run("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)", ['kaprodi', 'kaprodi@univ.ac.id', passHash('kaprodi123'), 'kaprodi']);
        const kaprodiUserRes = database.exec("SELECT id FROM users WHERE username = 'kaprodi'");
        const kaprodiUserId = kaprodiUserRes[0].values[0][0];
        database.run("INSERT INTO dosen (user_id, nip_nidn, nama_dosen, jabatan) VALUES (?, ?, ?, ?)", [kaprodiUserId, '198501012010121001', 'Dr. Eng. Nama Kaprodi, M.T.', 'Ketua Program Studi']);

        // 5. Staff TU
        database.run("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)", ['stafftu', 'stafftu@univ.ac.id', passHash('tu123'), 'staff_tu']);

        // 6. Dosen Pembimbing 1
        database.run("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)", ['pembimbing1', 'pembimbing1@univ.ac.id', passHash('dosen123'), 'dosen']);
        const p1UserRes = database.exec("SELECT id FROM users WHERE username = 'pembimbing1'");
        database.run("INSERT INTO dosen (user_id, nip_nidn, nama_dosen, jabatan) VALUES (?, ?, ?, ?)", [p1UserRes[0].values[0][0], '197805122005011002', 'Prof. Dr. Ir. Budi Santoso, M.Kom.', 'Guru Besar / Pembimbing Utama']);

        // 7. Dosen Pembimbing 2
        database.run("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)", ['pembimbing2', 'pembimbing2@univ.ac.id', passHash('dosen123'), 'dosen']);
        const p2UserRes = database.exec("SELECT id FROM users WHERE username = 'pembimbing2'");
        database.run("INSERT INTO dosen (user_id, nip_nidn, nama_dosen, jabatan) VALUES (?, ?, ?, ?)", [p2UserRes[0].values[0][0], '198203152008042003', 'Siti Rahmawati, S.T., M.T.', 'Lektor Kepala / Pembimbing Pendamping']);

        // 8. Dosen Penguji 1, 2, 3
        database.run("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)", ['penguji1', 'penguji1@univ.ac.id', passHash('dosen123'), 'dosen']);
        const u1UserRes = database.exec("SELECT id FROM users WHERE username = 'penguji1'");
        database.run("INSERT INTO dosen (user_id, nip_nidn, nama_dosen, jabatan) VALUES (?, ?, ?, ?)", [u1UserRes[0].values[0][0], '197509102003121004', 'Dr. Agus Setiawan, M.Sc.', 'Ketua Penguji']);

        database.run("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)", ['penguji2', 'penguji2@univ.ac.id', passHash('dosen123'), 'dosen']);
        const u2UserRes = database.exec("SELECT id FROM users WHERE username = 'penguji2'");
        database.run("INSERT INTO dosen (user_id, nip_nidn, nama_dosen, jabatan) VALUES (?, ?, ?, ?)", [u2UserRes[0].values[0][0], '198811202015041005', 'Dian Lestari, M.T.', 'Penguji Anggota 1']);

        database.run("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)", ['penguji3', 'penguji3@univ.ac.id', passHash('dosen123'), 'dosen']);
        const u3UserRes = database.exec("SELECT id FROM users WHERE username = 'penguji3'");
        database.run("INSERT INTO dosen (user_id, nip_nidn, nama_dosen, jabatan) VALUES (?, ?, ?, ?)", [u3UserRes[0].values[0][0], '199002142019032006', 'Eko Prasetyo, M.Comp.', 'Penguji Anggota 2']);

        // Plotting default for demo mhs
        const mhsId = database.exec("SELECT id FROM mahasiswa WHERE nim = '21081010001'")[0].values[0][0];
        const p1Id = database.exec("SELECT id FROM dosen WHERE nip_nidn = '197805122005011002'")[0].values[0][0];
        const p2Id = database.exec("SELECT id FROM dosen WHERE nip_nidn = '198203152008042003'")[0].values[0][0];
        const u1Id = database.exec("SELECT id FROM dosen WHERE nip_nidn = '197509102003121004'")[0].values[0][0];
        const u2Id = database.exec("SELECT id FROM dosen WHERE nip_nidn = '198811202015041005'")[0].values[0][0];
        const u3Id = database.exec("SELECT id FROM dosen WHERE nip_nidn = '199002142019032006'")[0].values[0][0];

        database.run("INSERT INTO plotting_tugas_akhir (mahasiswa_id, dosen_pembimbing_1_id, dosen_pembimbing_2_id, dosen_penguji_1_id, dosen_penguji_2_id, dosen_penguji_3_id, sk_dekan_nomor, status_ta) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [mhsId, p1Id, p2Id, u1Id, u2Id, u3Id, 'SK-DEKAN/2026/089', 'bimbingan']);
    }
}

// Database helper functions mirroring ORM interface
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
