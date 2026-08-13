const path = require('path');
const fs = require('fs');

const isVercel = Boolean(process.env.VERCEL || process.env.NOW_BUILDER);

function getUploadsDir(subFolder = '') {
    const baseUploads = isVercel
        ? path.join('/tmp', 'uploads')
        : path.join(__dirname, '../../public/uploads');
    
    const targetDir = subFolder ? path.join(baseUploads, subFolder) : baseUploads;
    if (!fs.existsSync(targetDir)) {
        try {
            fs.mkdirSync(targetDir, { recursive: true });
        } catch (err) {
            console.error("Failed to create uploads directory:", targetDir, err.message);
        }
    }
    return targetDir;
}

function resolveUploadPath(relativePath) {
    if (!relativePath) return null;
    const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
    
    // 1. Check in /tmp if running on Vercel
    if (isVercel) {
        const tmpPath = path.join('/tmp', cleanPath);
        if (fs.existsSync(tmpPath)) return tmpPath;
    }

    // 2. Check in public/
    const publicPath = path.join(__dirname, '../../public', cleanPath);
    if (fs.existsSync(publicPath)) return publicPath;

    return null;
}

module.exports = {
    isVercel,
    getUploadsDir,
    resolveUploadPath
};
