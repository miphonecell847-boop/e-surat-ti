require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    sessionSecret: process.env.SESSION_SECRET || 'esurat_teknik_informatika_secret_key_2026',
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    gdriveRootFolderId: process.env.GDRIVE_ROOT_FOLDER_ID || 'root_ta_folder_id',
    fonnteToken: process.env.FONNTE_TOKEN || process.env.WA_API_TOKEN || 'QCZUyrpRPXAR6c6QP1F8',
    waApiUrl: process.env.WA_API_URL || 'https://api.fonnte.com/send'
};
