const { google } = require('googleapis');
const stream = require('stream');
const path = require('path');
const fs = require('fs');
const gdriveConfig = require('../../config/gdrive');

class GDriveStorageService {
    constructor() {
        this.drive = null;
        this.isMock = !gdriveConfig.isConfigured;

        if (!this.isMock) {
            try {
                const auth = new google.auth.GoogleAuth({
                    keyFile: gdriveConfig.serviceAccountPath,
                    scopes: gdriveConfig.scopes,
                });
                this.drive = google.drive({ version: 'v3', auth });
            } catch (err) {
                console.warn('Google Drive Service Auth warning, fallback ke mock storage:', err.message);
                this.isMock = true;
            }
        }
    }

    async getOrCreateFolder(folderName, parentFolderId = null) {
        if (this.isMock) {
            const mockFolderId = `mock_folder_${folderName.replace(/[^a-zA-Z0-9]/g, '_')}`;
            return mockFolderId;
        }

        try {
            let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
            if (parentFolderId && !parentFolderId.startsWith('mock_')) {
                query += ` and '${parentFolderId}' in parents`;
            }

            const res = await this.drive.files.list({ q: query, fields: 'files(id, name)' });
            if (res.data.files && res.data.files.length > 0) {
                return res.data.files[0].id;
            }

            const folderMetadata = {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: (parentFolderId && !parentFolderId.startsWith('mock_')) ? [parentFolderId] : []
            };

            const folder = await this.drive.files.create({
                requestBody: folderMetadata,
                fields: 'id'
            });
            return folder.data.id;
        } catch (error) {
            console.error('GDrive getOrCreateFolder error:', error.message);
            return `fallback_folder_${Date.now()}`;
        }
    }

    async uploadFileStream(fileBuffer, fileName, mimeType, parentFolderId) {
        if (this.isMock) {
            // Save to public/uploads local directory as fallback
            const uploadsDir = path.join(__dirname, '../../public/uploads');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }
            const localFileName = `${Date.now()}_${fileName}`;
            const localFilePath = path.join(uploadsDir, localFileName);
            fs.writeFileSync(localFilePath, fileBuffer);

            const fileId = `local_file_${Date.now()}`;
            const fileUrl = `/uploads/${localFileName}`;

            return {
                id: fileId,
                name: fileName,
                webViewLink: fileUrl,
                webContentLink: fileUrl,
                size: fileBuffer.length
            };
        }

        try {
            const bufferStream = new stream.PassThrough();
            bufferStream.end(fileBuffer);

            const fileMetadata = {
                name: `${Date.now()}_${fileName}`,
                parents: (parentFolderId && !parentFolderId.startsWith('mock_')) ? [parentFolderId] : []
            };

            const media = {
                mimeType: mimeType,
                body: bufferStream
            };

            const response = await this.drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id, name, webViewLink, webContentLink, size'
            });

            await this.drive.permissions.create({
                fileId: response.data.id,
                requestBody: { role: 'reader', type: 'anyone' }
            });

            return response.data;
        } catch (error) {
            console.error('GDrive uploadFileStream error:', error.message);
            // Fallback to local file
            const uploadsDir = path.join(__dirname, '../../public/uploads');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }
            const localFileName = `${Date.now()}_${fileName}`;
            fs.writeFileSync(path.join(uploadsDir, localFileName), fileBuffer);

            return {
                id: `fallback_${Date.now()}`,
                name: fileName,
                webViewLink: `/uploads/${localFileName}`,
                webContentLink: `/uploads/${localFileName}`,
                size: fileBuffer.length
            };
        }
    }
}

module.exports = new GDriveStorageService();
