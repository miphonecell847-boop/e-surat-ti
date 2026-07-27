const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, '../service-account-gdrive.json');
const hasServiceAccount = fs.existsSync(serviceAccountPath);

const clientId = process.env.GDRIVE_CLIENT_ID || '926267491104-d157mcusn5f29cghlauvndle868mr27c.apps.googleusercontent.com';
const apiKey = process.env.GDRIVE_API_KEY || 'AIzaSyCrWjJ9ASpCwnVd2CSlPBfxyOQ0yYBsYdQ';
const clientSecret = process.env.GDRIVE_CLIENT_SECRET || '';
const refreshToken = process.env.GDRIVE_REFRESH_TOKEN || '';

const hasOAuth2 = Boolean(clientId && clientSecret && refreshToken);
const hasApiKey = Boolean(apiKey);
const isConfigured = hasServiceAccount || hasOAuth2 || hasApiKey;

module.exports = {
    serviceAccountPath,
    hasServiceAccount,
    clientId,
    apiKey,
    clientSecret,
    refreshToken,
    hasOAuth2,
    hasApiKey,
    isConfigured,
    scopes: ['https://www.googleapis.com/auth/drive']
};
