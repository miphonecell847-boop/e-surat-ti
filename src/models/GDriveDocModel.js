const db = require('../../config/database');

class GDriveDocModel {
    static async saveMetadata({ pengajuan_surat_id, gdrive_file_id, gdrive_folder_id, nama_file_original, kategori_berkas, mime_type, file_size_bytes, web_view_link, web_content_link }) {
        const sql = `
            INSERT INTO google_drive_docs
            (pengajuan_surat_id, gdrive_file_id, gdrive_folder_id, nama_file_original, kategori_berkas, mime_type, file_size_bytes, web_view_link, web_content_link)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await db.run(sql, [
            pengajuan_surat_id, gdrive_file_id, gdrive_folder_id, nama_file_original,
            kategori_berkas, mime_type, file_size_bytes, web_view_link, web_content_link
        ]);
        return await db.get('SELECT * FROM google_drive_docs WHERE pengajuan_surat_id = ? ORDER BY id DESC LIMIT 1', [pengajuan_surat_id]);
    }

    static async getBySuratId(pengajuan_surat_id) {
        return await db.query('SELECT * FROM google_drive_docs WHERE pengajuan_surat_id = ? ORDER BY id ASC', [pengajuan_surat_id]);
    }
}

module.exports = GDriveDocModel;
