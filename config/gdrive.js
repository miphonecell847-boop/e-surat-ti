const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, '../service-account-gdrive.json');
const isConfigured = fs.existsSync(serviceAccountPath);

module.exports = {
    serviceAccountPath,
    isConfigured,
    scopes: ['https://www.googleapis.com/auth/drive']
};
