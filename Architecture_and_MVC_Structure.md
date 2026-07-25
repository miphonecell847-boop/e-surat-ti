# Model Arsitektur & Struktur Aplikasi MVC
## Sistem E-Surat Administrasi Tugas Akhir (Teknik Informatika)

---

## 1. High-Level System Architecture

Sistem E-Surat Tugas Akhir dibangun menggunakan pola arsitektur **MVC (Model-View-Controller)** yang diperluas dengan **Service & Repository Layer**. Arsitektur ini memisahkan secara tegas antara antarmuka pengguna (View), logika navigasi/routing (Controller), bisnis logika & aturan sistem (Service), akses ke database relational (Repository/Model), serta integrasi cloud storage (Google Drive Integration Engine).

```mermaid
graph TD
    User([Pengguna: Mahasiswa / Dosen / Kaprodi / TU]) <-->|HTTP/HTTPS Request & Response| ViewLayer[VIEW LAYER: HTML5 / CSS3 / Vanilla JS / Bootstrap / Tailwind]
    
    subgraph BACKEND_SERVER [Backend Core Application Engine]
        ViewLayer <-->|Route Requests| Router[Router / Dispatcher]
        Router --> ControllerLayer[CONTROLLER LAYER: Handlers Request/Response]
        ControllerLayer --> Middleware[Auth & RBAC Middleware]
        
        subgraph LOGIC_DATA_ENGINE [Business & Data Layer]
            ControllerLayer --> ServiceLayer[SERVICE LAYER: E-Surat Logic, PDF Generator, QR Hash]
            ServiceLayer --> ModelLayer[MODEL / REPOSITORY LAYER: Data Abstraction & ORM SQL]
            ServiceLayer --> GDriveService[GOOGLE DRIVE SERVICE LAYER: GDrive API v3]
        end
    end
    
    ModelLayer <-->|Prepared Queries / SQL Connection Pool| Database[(DATABASE SQL: PostgreSQL / MySQL)]
    GDriveService <-->|Service Account Auth OAuth2 / HTTPS API| GoogleDrive Cloud[GOOGLE DRIVE CLOUD STORAGE]
```

---

## 2. Struktur Direktori Aplikasi (Modular MVC Pattern)

Struktur folder dirancang secara terstruktur dan modular. Setiap komponen utama dibatasi tanggung jawabnya (*Separation of Concerns*).

```text
e-surat-ta/
├── config/                         # Konfigurasi Sistem
│   ├── database.js                 # Database Connection (Pool / Sequelizer / Prisma)
│   ├── gdrive.js                   # Google Drive Auth Credentials (Service Account Key)
│   ├── app.js                      # Environment Variables & App Config
│   └── constants.js                # Enum Status, Role, Tipe Surat
│
├── public/                         # Public Assets (Static Files)
│   ├── css/                        # Style Sheets
│   ├── js/                         # Client-Side Script
│   ├── images/                     # Logos, Watermarks, Icons
│   └── uploads/                    # Temporary Local Cache Uploads (dikirim ke GDrive lalu disapu)
│
├── src/                            # Core Source Code (MVC Architecture)
│   ├── controllers/                # Handling HTTP Request & Response Output
│   │   ├── AuthController.js       # Authentication (Login, Logout, Session)
│   │   ├── MahasiswaController.js  # Pengajuan Surat & Tracking Status
│   │   ├── DosenController.js      # Review Bimbingan & Acc Surat
│   │   ├── KaprodiController.js    # Approval SK & Digital Signature
│   │   ├── TuController.js         # Penomoran Surat, PDF Generate & Archiving
│   │   └── PublicVerifyController.js# Public QR Code Document Verification
│   │
│   ├── models/                     # Data Abstraction & SQL Query Handlers
│   │   ├── UserModel.js            # User Authentication & Profiles
│   │   ├── MahasiswaModel.js       # Data Mahasiswa & Status TA
│   │   ├── DosenModel.js           # Data Dosen & NIP/NIDN
│   │   ├── SuratModel.js           # Data Master & Pengajuan Surat
│   │   ├── GDriveDocModel.js       # Metadata File Google Drive
│   │   └── DisposisiModel.js       # History Approval & E-Signature
│   │
│   ├── services/                   # Business Logic & External Integrations
│   │   ├── GDriveStorageService.js # Google Drive API Upload/Download Engine
│   │   ├── PdfGeneratorService.js  # HTML to PDF Converter Engine
│   │   ├── ESignatureService.js    # QR Code Generator & Cryptographic Hash
│   │   └── NotificationService.js  # Email / Realtime Event Notification
│   │
│   ├── middlewares/                # Custom Middleware Filters
│   │   ├── authMiddleware.js       # Check Authenticated Session
│   │   ├── rbacMiddleware.js       # Role-Based Access Control Filter
│   │   └── uploadMiddleware.js     # Multer File Stream & MIME Type Validator
│   │
│   ├── views/                      # Template Rendering (View Layer)
│   │   ├── layouts/                # Base Master Layout (Header, Sidebar, Footer)
│   │   │   ├── main.hbs / .ejs
│   │   │   └── auth.hbs
│   │   ├── auth/                   # Halaman Login & Profil
│   │   ├── mahasiswa/              # Form Pengajuan & Progress Timeline Tracker
│   │   ├── dosen/                  # Inbox Verifikasi & Approval
│   │   ├── kaprodi/                # TTD Digital SK & Dashboard Persetujuan
│   │   ├── tu/                     # Form Penomoran & Preview PDF Master
│   │   ├── templates_surat/        # Template HTML Master E-Surat (Dynamic Merge)
│   │   │   ├── surat_pengantar_riset.hbs
│   │   │   ├── sk_pembimbing_ta.hbs
│   │   │   ├── undangan_sempro.hbs
│   │   │   └── undangan_sidang.hbs
│   │   └── verify.hbs              # Halaman Hasil Verifikasi QR Code Publik
│   │
│   └── routes/                     # Application Route Endpoints
│       ├── web.js                  # Frontend Web Views Routes
│       ├── api.js                  # AJAX / RESTful API Endpoints
│       └── auth.js                 # Authentication Routes
│
├── .env.example                    # Template Environtment Variable
├── service-account-gdrive.json     # GDrive API Key (Do not commit!)
├── package.json                    # Project Dependencies
└── server.js                       # Main Entry Point Application
```

---

## 3. Perancangan Database SQL (Relational Schema & DDL)

Database dirancang dengan relasi kardinalitas murni untuk menjamin konsistensi data (*ACID Compliance*).

### 3.1. Entity Relationship Diagram (ERD Logic Overview)

```mermaid
erdiagram
    USERS ||--o{ MAHASISWA : "belongs_to"
    USERS ||--o{ DOSEN : "belongs_to"
    MAHASISWA ||--o{ PENGAJUAN_SURAT : "submits"
    JENIS_SURAT ||--o{ PENGAJUAN_SURAT : "defines"
    PENGAJUAN_SURAT ||--o{ GOOGLE_DRIVE_DOCS : "attaches"
    PENGAJUAN_SURAT ||--o{ RIWAYAT_DISPOSISI : "tracks"
    USERS ||--o{ RIWAYAT_DISPOSISI : "processes"
```

### 3.2. Script DDL SQL (PostgreSQL / MySQL Compatible)

```sql
-- 1. Table Master User & RBAC (Updated Roles)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('mahasiswa', 'sekretaris_prodi', 'kaprodi', 'staff_tu', 'dosen', 'admin')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table Data Mahasiswa
CREATE TABLE mahasiswa (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    nim VARCHAR(20) UNIQUE NOT NULL,
    nama_lengkap VARCHAR(150) NOT NULL,
    angkatan INT NOT NULL,
    no_hp VARCHAR(20),
    judul_ta TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table Data Dosen
CREATE TABLE dosen (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    nip_nidn VARCHAR(30) UNIQUE NOT NULL,
    nama_dosen VARCHAR(150) NOT NULL,
    jabatan VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Table Ploting Tugas Akhir (2 Pembimbing & 3 Penguji)
CREATE TABLE plotting_tugas_akhir (
    id SERIAL PRIMARY KEY,
    mahasiswa_id INT UNIQUE NOT NULL REFERENCES mahasiswa(id) ON DELETE CASCADE,
    dosen_pembimbing_1_id INT NOT NULL REFERENCES dosen(id),
    dosen_pembimbing_2_id INT NOT NULL REFERENCES dosen(id),
    dosen_penguji_1_id INT REFERENCES dosen(id), -- Ketua Penguji
    dosen_penguji_2_id INT REFERENCES dosen(id), -- Penguji Anggota 1
    dosen_penguji_3_id INT REFERENCES dosen(id), -- Penguji Anggota 2
    sk_dekan_nomor VARCHAR(100),
    status_ta VARCHAR(30) DEFAULT 'bimbingan' CHECK (status_ta IN ('bimbingan', 'sempro', 'sidang', 'lulus')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Table Master Jenis Surat
CREATE TABLE jenis_surat (
    id SERIAL PRIMARY KEY,
    kode_surat VARCHAR(20) UNIQUE NOT NULL, -- e.g., 'SRT-RISET', 'SK-PEMBIMBING', 'UND-SIDANG'
    nama_surat VARCHAR(100) NOT NULL,
    template_path VARCHAR(255) NOT NULL,
    butuh_approval_pembimbing BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Table Transaksi Pengajuan Surat
CREATE TABLE pengajuan_surat (
    id SERIAL PRIMARY KEY,
    uuid_surat VARCHAR(36) UNIQUE NOT NULL, -- Digunakan untuk verifikasi QR Code Publik
    mahasiswa_id INT NOT NULL REFERENCES mahasiswa(id),
    jenis_surat_id INT NOT NULL REFERENCES jenis_surat(id),
    nomor_surat VARCHAR(100) DEFAULT NULL, -- Diisi oleh Staff TU
    perihal TEXT NOT NULL,
    data_dinamis JSONB NOT NULL, -- Tempat menyimpan input form dinamis (Nama Instansi, Tgl Sidang, Ruangan, dll)
    status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (
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
    approval_pembimbing_1 BOOLEAN DEFAULT FALSE,
    approval_pembimbing_2 BOOLEAN DEFAULT FALSE,
    qr_signature_hash TEXT DEFAULT NULL,
    tgl_pengajuan TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tgl_selesai TIMESTAMP DEFAULT NULL
);

-- 7. Table Storage File Google Drive (Integrasi GDrive API)
CREATE TABLE google_drive_docs (
    id SERIAL PRIMARY KEY,
    pengajuan_surat_id INT NOT NULL REFERENCES pengajuan_surat(id) ON DELETE CASCADE,
    gdrive_file_id VARCHAR(150) NOT NULL,
    gdrive_folder_id VARCHAR(150) NOT NULL,
    nama_file_original VARCHAR(255) NOT NULL,
    kategori_berkas VARCHAR(50) NOT NULL, -- e.g., 'syarat_lampiran', 'draft_skripsi', 'surat_final_pdf'
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    web_view_link TEXT NOT NULL,
    web_content_link TEXT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Table Riwayat Disposisi & Approval Multi-User
CREATE TABLE riwayat_disposisi (
    id SERIAL PRIMARY KEY,
    pengajuan_surat_id INT NOT NULL REFERENCES pengajuan_surat(id) ON DELETE CASCADE,
    actor_user_id INT NOT NULL REFERENCES users(id),
    actor_role VARCHAR(30) NOT NULL, -- 'pembimbing_1', 'pembimbing_2', 'sekprodi', 'kaprodi', 'staff_tu'
    status_sebelumnya VARCHAR(30) NOT NULL,
    status_sesudahnya VARCHAR(30) NOT NULL,
    catatan_revisi TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexing untuk Kecepatan Query
CREATE INDEX idx_pengajuan_mahasiswa ON pengajuan_surat(mahasiswa_id);
CREATE INDEX idx_pengajuan_status ON pengajuan_surat(status);
CREATE INDEX idx_gdrive_pengajuan ON google_drive_docs(pengajuan_surat_id);
```

---

## 4. Mekanisme Integrasi Google Drive API Storage Engine

Sistem tidak menyimpan berkas dokumen di server lokal untuk menghemat disk storage dan mencegah kehabisan kapasitas. Berkas dikirim langsung ke Google Drive institusi via **Google Drive API v3 (Service Account)**.

### Strategi Hirarki Folder Otomatis di Google Drive:
Sistem akan memeriksa atau membuat struktur folder secara otomatis sebelum mengunggah file:

```text
[Google Drive Root Prodi Informatika]
   └── [Folder: 2026]
        └── [Folder: 21081010001_Ahmad_Fauzi]
             ├── [Folder: Syarat_Lampiran]  --> File Upload Mahasiswa (PDF Draft, Transkrip)
             └── [Folder: Surat_Resmi_PDF] --> File Surat Final TTD Digital & Berstempel
```

### Flow Integrasi Google Drive:
1. **Upload Request:** Client mengirim file via form upload (`multipart/form-data`).
2. **Stream Processing:** Middleware Multer memproses berkas sebagai *Memory Stream Buffer* (tidak ditulis ke disk lokal).
3. **GDrive Service Call:** Service Account membuat/mengecek Folder ID mahasiswa di Google Drive API.
4. **Drive Upload Execution:** Stream dikirim ke `drive.files.create()` Google Drive API v3.
5. **Set Permissions:** File di-set agar dapat diakses oleh pihak yang berhak via link (`role: reader`).
6. **DB SQL Metadata Save:** `file_id`, `web_view_link`, dan `web_content_link` disimpan di tabel `google_drive_docs`.

---

## 5. Cetak Biru Kode (Code Blueprints)

Berikut adalah contoh implementasi modular pada setiap lapisan MVC & Service Layer.

### 5.1. Google Drive Service Layer (`src/services/GDriveStorageService.js`)

```javascript
const { google } = require('googleapis');
const stream = require('stream');
const path = require('path');

class GDriveStorageService {
    constructor() {
        const KEY_PATH = path.join(__dirname, '../../service-account-gdrive.json');
        const SCOPES = ['https://www.googleapis.com/auth/drive'];

        const auth = new google.auth.GoogleAuth({
            keyFile: KEY_PATH,
            scopes: SCOPES,
        });

        this.drive = google.drive({ version: 'v3', auth });
    }

    // Mendapatkan atau Membuat Folder Otomatis
    async getOrCreateFolder(folderName, parentFolderId = null) {
        let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        if (parentFolderId) {
            query += ` and '${parentFolderId}' in parents`;
        }

        const res = await this.drive.files.list({ q: query, fields: 'files(id, name)' });
        if (res.data.files.length > 0) {
            return res.data.files[0].id;
        }

        // Buat folder baru jika belum ada
        const folderMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: parentFolderId ? [parentFolderId] : []
        };

        const folder = await this.drive.files.create({
            resource: folderMetadata,
            fields: 'id'
        });
        return folder.data.id;
    }

    // Stream Direct Upload File ke Google Drive
    async uploadFileStream(fileBuffer, fileName, mimeType, parentFolderId) {
        const bufferStream = new stream.PassThrough();
        bufferStream.end(fileBuffer);

        const fileMetadata = {
            name: `${Date.now()}_${fileName}`,
            parents: [parentFolderId]
        };

        const media = {
            mimeType: mimeType,
            body: bufferStream
        };

        const response = await this.drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, name, webViewLink, webContentLink, size'
        });

        // Set Permission: Anyone with link can view (Atau disesuaikan)
        await this.drive.permissions.create({
            fileId: response.data.id,
            requestBody: { role: 'reader', type: 'anyone' }
        });

        return response.data;
    }
}

module.exports = new GDriveStorageService();
```

---

### 5.2. Model Layer (`src/models/SuratModel.js`)

```javascript
const db = require('../../config/database');

class SuratModel {
    // Menyiapkan Pengajuan Surat Baru
    static async createPengajuan(data) {
        const query = `
            INSERT INTO pengajuan_surat 
            (uuid_surat, mahasiswa_id, jenis_surat_id, perihal, data_dinamis, status)
            VALUES ($1, $2, $3, $4, $5, 'pending_koordinator')
            RETURNING *;
        `;
        const values = [
            data.uuid_surat, 
            data.mahasiswa_id, 
            data.jenis_surat_id, 
            data.perihal, 
            JSON.stringify(data.data_dinamis)
        ];
        const { rows } = await db.query(query, values);
        return rows[0];
    }

    // Simpan Metadata Google Drive
    static async saveGDriveMetadata(metadata) {
        const query = `
            INSERT INTO google_drive_docs
            (pengajuan_surat_id, gdrive_file_id, gdrive_folder_id, nama_file_original, kategori_berkas, mime_type, file_size_bytes, web_view_link, web_content_link)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *;
        `;
        const values = [
            metadata.pengajuan_surat_id, metadata.gdrive_file_id, metadata.gdrive_folder_id,
            metadata.nama_file_original, metadata.kategori_berkas, metadata.mime_type,
            metadata.file_size_bytes, metadata.web_view_link, metadata.web_content_link
        ];
        const { rows } = await db.query(query, values);
        return rows[0];
    }

    // Get Data Pengajuan & File Lampiran Drive
    static async getDetailPengajuan(suratId) {
        const query = `
            SELECT s.*, m.nama_lengkap, m.nim, j.nama_surat,
                   json_agg(g.*) AS drive_files
            FROM pengajuan_surat s
            JOIN mahasiswa m ON s.mahasiswa_id = m.id
            JOIN jenis_surat j ON s.jenis_surat_id = j.id
            LEFT JOIN google_drive_docs g ON g.pengajuan_surat_id = s.id
            WHERE s.id = $1
            GROUP BY s.id, m.nama_lengkap, m.nim, j.nama_surat;
        `;
        const { rows } = await db.query(query, [suratId]);
        return rows[0];
    }
}

module.exports = SuratModel;
```

---

### 5.3. Controller Layer (`src/controllers/MahasiswaController.js`)

```javascript
const { v4: uuidv4 } = require('uuid');
const SuratModel = require('../models/SuratModel');
const gdriveService = require('../services/GDriveStorageService');

class MahasiswaController {
    // Handle Form Pengajuan Surat & Direct Upload GDrive
    static async submitPengajuanSurat(req, res) {
        try {
            const mahasiswaId = req.user.mahasiswa_id;
            const { jenis_surat_id, perihal, ...dataDinamis } = req.body;
            const fileUpload = req.file; // Berkas dari Multer Memory Storage

            const uuidSurat = uuidv4();

            // 1. Simpan Transaksi Pengajuan Surat di DB SQL
            const pengajuanBaru = await SuratModel.createPengajuan({
                uuid_surat: uuidSurat,
                mahasiswa_id: mahasiswaId,
                jenis_surat_id,
                perihal,
                data_dinamis: dataDinamis
            });

            // 2. Upload Berkas Lampiran ke Google Drive jika ada file
            if (fileUpload) {
                const ROOT_TA_FOLDER = process.env.GDRIVE_ROOT_FOLDER_ID;
                const tahunFolderId = await gdriveService.getOrCreateFolder('2026', ROOT_TA_FOLDER);
                const mhsFolderId = await gdriveService.getOrCreateFolder(`${req.user.nim}_${req.user.nama}`, tahunFolderId);
                const lampiranFolderId = await gdriveService.getOrCreateFolder('Syarat_Lampiran', mhsFolderId);

                // Upload Stream ke Drive
                const driveResult = await gdriveService.uploadFileStream(
                    fileUpload.buffer,
                    fileUpload.originalname,
                    fileUpload.mimetype,
                    lampiranFolderId
                );

                // 3. Simpan Referensi Google Drive ke SQL DB
                await SuratModel.saveGDriveMetadata({
                    pengajuan_surat_id: pengajuanBaru.id,
                    gdrive_file_id: driveResult.id,
                    gdrive_folder_id: lampiranFolderId,
                    nama_file_original: fileUpload.originalname,
                    kategori_berkas: 'syarat_lampiran',
                    mime_type: fileUpload.mimetype,
                    file_size_bytes: driveResult.size || fileUpload.size,
                    web_view_link: driveResult.webViewLink,
                    web_content_link: driveResult.webContentLink
                });
            }

            return res.status(201).json({
                success: true,
                message: 'Pengajuan surat berhasil dikirim dan berkas tersimpan aman di Google Drive.',
                data: pengajuanBaru
            });

        } catch (error) {
            console.error('Error Submit Surat:', error);
            return res.status(500).json({ success: false, message: 'Gagal mengajukan surat.', error: error.message });
        }
    }
}

module.exports = MahasiswaController;
```

---

### 5.4. View Layer Template HTML/PDF (`src/views/templates_surat/sk_pembimbing_ta.hbs`)

```html
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Surat Keputusan Pembimbing TA</title>
    <style>
        body { font-family: 'Times New Roman', serif; margin: 30px; line-height: 1.6; }
        .kop-surat { text-align: center; border-bottom: 3px double #000; padding-bottom: 10px; margin-bottom: 20px; }
        .kop-surat h3 { margin: 0; font-size: 16pt; text-transform: uppercase; }
        .kop-surat h4 { margin: 0; font-size: 14pt; text-transform: uppercase; }
        .kop-surat p { margin: 0; font-size: 10pt; italic; }
        .judul-surat { text-align: center; margin-bottom: 20px; font-weight: bold; text-decoration: underline; }
        .content { font-size: 12pt; text-align: justify; }
        .ttd-container { width: 100%; margin-top: 40px; display: table; }
        .ttd-box { display: table-cell; width: 50%; text-align: center; vertical-align: top; }
        .qr-code { width: 90px; height: 90px; margin: 10px auto; }
    </style>
</head>
<body>
    <div class="kop-surat">
        <h3>KEMENTERIAN PENDIDIKAN, KEBUDAYAAN, RISET, DAN TEKNOLOGI</h3>
        <h4>PROGRAM STUDI TEKNIK INFORMATIKA</h4>
        <p>Jl. Prof. Dr. Sumantri Brojonegoro No.1, Kampus Universitas | Web: ti.ac.id</p>
    </div>

    <div class="judul-surat">
        SURAT TUGAS / SK DOSEN PEMBIMBING TUGAS AKHIR<br>
        Nomor: {{nomor_surat}}
    </div>

    <div class="content">
        <p>Ketua Program Studi Teknik Informatika menerangkan bahwa mahasiswa berikut:</p>
        <table>
            <tr><td width="160">Nama Mahasiswa</td><td>: <strong>{{nama_lengkap}}</strong></td></tr>
            <tr><td>NIM</td><td>: {{nim}}</td></tr>
            <tr><td>Judul Skripsi/TA</td><td>: <em>{{judul_ta}}</em></td></tr>
        </table>
        <br>
        <p><strong>A. Dosen Pembimbing Tugas Akhir:</strong></p>
        <ol>
            <li>Dosen Pembimbing I (Utama) : {{dosen_pembimbing_1}} (NIP: {{nip_pembimbing_1}})</li>
            <li>Dosen Pembimbing II (Pendamping) : {{dosen_pembimbing_2}} (NIP: {{nip_pembimbing_2}})</li>
        </ol>

        <p><strong>B. Tim Dosen Penguji Sidang:</strong></p>
        <ol>
            <li>Dosen Penguji I (Ketua Penguji) : {{dosen_penguji_1}} (NIP: {{nip_penguji_1}})</li>
            <li>Dosen Penguji II (Penguji Anggota 1) : {{dosen_penguji_2}} (NIP: {{nip_penguji_2}})</li>
            <li>Dosen Penguji III (Penguji Anggota 2) : {{dosen_penguji_3}} (NIP: {{nip_penguji_3}})</li>
        </ol>
    </div>

    <div class="ttd-container">
        <div class="ttd-box"></div>
        <div class="ttd-box">
            <p>Disetujui oleh,<br>Ketua Program Studi Teknik Informatika</p>
            <!-- Embed QR Code E-Signature Validation -->
            <img src="{{qr_code_base64}}" class="qr-code" alt="QR E-Signature">
            <p><strong><u>{{nama_kaprodi}}</u></strong><br>NIP. {{nip_kaprodi}}</p>
            <small style="font-size: 8pt; color: #555;">Validasi Surat: {{verification_url}}</small>
        </div>
    </div>
</body>
</html>
```

---

## 6. Rencana Pengujian & Verifikasi (Verification Plan)

| Item Pengujian | Metode Pengujian | Expektasi Hasil |
| :--- | :--- | :--- |
| **Auth & Access Matrix** | Unit & Integration Test | Mahasiswa tidak dapat mengakses route `/kaprodi/approve` (Return 403 Forbidden). |
| **Direct Stream GDrive** | Mock & Live API Test | Berkas PDF berhasil ter-upload di folder target Google Drive dan menghasilkan `web_view_link` valid. |
| **SQL Relational Integrity** | DB Constraints Test | Penghapusan data pengajuan secara cascades membersihkan data metadata di `google_drive_docs`. |
| **PDF Generation & QR Code** | Visual & QR Scanner Test | Scanning QR Code pada lembar PDF mengarah ke halaman verifikasi publik yang memunculkan rincian status asli dokumen. |
