require('dotenv').config();

const isVercel = Boolean(process.env.VERCEL || process.env.NOW_BUILDER);

module.exports = {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    sessionSecret: process.env.SESSION_SECRET || 'esurat_teknik_informatika_secret_key_2026',
    baseUrl: process.env.BASE_URL || (isVercel ? 'https://e-surat-alpha.vercel.app' : 'http://localhost:3000'),
    gdriveRootFolderId: process.env.GDRIVE_ROOT_FOLDER_ID || '1jjZFf0vgrWso96dfHe2IMzf2HTzybq_1',
    gdriveClientId: process.env.GDRIVE_CLIENT_ID || '926267491104-d157mcusn5f29cghlauvndle868mr27c.apps.googleusercontent.com',
    gdriveClientSecret: process.env.GDRIVE_CLIENT_SECRET || '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',
    gdriveRefreshToken: process.env.GDRIVE_REFRESH_TOKEN || '1//04qO27SVFIKX-CgYIARAAGAQSNwF-L9Irc4_a11yLHShKoP96XnOF-oFpo4TPNYAtmcXvQHUinH3Xbz1CBQ_9IuHBNtUlHku_adc',
    gdriveApiKey: process.env.GDRIVE_API_KEY || 'AIzaSyCrWjJ9ASpCwnVd2CSlPBfxyOQ0yYBsYdQ',
    fonnteToken: process.env.FONNTE_TOKEN || process.env.WA_API_TOKEN || 'phKdYALrqXFnHL73UJ8b',
    waApiUrl: process.env.WA_API_URL || 'https://api.fonnte.com/send'
};
