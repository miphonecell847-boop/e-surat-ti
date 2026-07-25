const crypto = require('crypto');
const QRCode = require('qrcode');
const appConfig = require('../../config/app');

class ESignatureService {
    /**
     * Generate SHA-256 cryptographic hash for e-signature verification
     */
    static generateSignatureHash({ uuid_surat, nim, nama_kaprodi, nip_kaprodi, timestamp }) {
        const rawString = `${uuid_surat}|${nim}|${nama_kaprodi}|${nip_kaprodi}|${timestamp || Date.now()}`;
        return crypto.createHash('sha256').update(rawString).digest('hex');
    }

    /**
     * Generate QR Code as Data URL (base64 image)
     */
    static async generateQRCodeDataUrl(uuid_surat) {
        const verifyUrl = `${appConfig.baseUrl}/verify-doc/${uuid_surat}`;
        try {
            const dataUrl = await QRCode.toDataURL(verifyUrl, {
                errorCorrectionLevel: 'H',
                margin: 1,
                width: 200,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            });
            return { dataUrl, verifyUrl };
        } catch (err) {
            console.error('Error generating QR Code:', err);
            throw err;
        }
    }
}

module.exports = ESignatureService;
