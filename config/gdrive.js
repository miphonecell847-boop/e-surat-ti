const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, '../service-account-gdrive.json');
const hasServiceAccountFile = fs.existsSync(serviceAccountPath);

const serviceAccountJson = process.env.GDRIVE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
const clientEmail = process.env.GDRIVE_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL || '';
const privateKey = process.env.GDRIVE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY || '';

const hasServiceAccountEnv = Boolean(serviceAccountJson || (clientEmail && privateKey));
const hasServiceAccount = hasServiceAccountFile || hasServiceAccountEnv;

const clientId = process.env.GDRIVE_CLIENT_ID || '';
const clientSecret = process.env.GDRIVE_CLIENT_SECRET || '';
const refreshToken = process.env.GDRIVE_REFRESH_TOKEN || '';

const hasOAuth2 = Boolean(clientId && clientSecret && refreshToken);
const isConfigured = hasServiceAccount || hasOAuth2;

module.exports = {
    serviceAccountPath,
    hasServiceAccountFile,
    hasServiceAccountEnv,
    hasServiceAccount,
    serviceAccountJson,
    clientEmail,
    privateKey,
    clientId,
    clientSecret,
    refreshToken,
    hasOAuth2,
    isConfigured,
    rootFolderId: process.env.GDRIVE_ROOT_FOLDER_ID || '1jjZFf0vgrWso96dfHe2IMzf2HTzybq_1',
    scopes: ['https://www.googleapis.com/auth/drive']
};
