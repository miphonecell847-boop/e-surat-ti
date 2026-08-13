const appConfig = require('../../config/app');

class WhatsAppService {
    /**
     * Format Indonesian phone numbers to standard 628xxx format.
     */
    static formatPhoneNumber(phone) {
        if (!phone || typeof phone !== 'string') return null;
        let cleaned = phone.replace(/[^0-9]/g, '');
        if (cleaned.startsWith('0')) {
            cleaned = '62' + cleaned.substring(1);
        } else if (cleaned.startsWith('8')) {
            cleaned = '62' + cleaned;
        }
        return cleaned.length >= 10 ? cleaned : null;
    }

    /**
     * Send generic WhatsApp message.
     * Integrates with WA HTTP Gateway (Fonnte / Generic) if WA_API_TOKEN is set in .env,
     * otherwise logs clearly in console terminal.
     */
    static async sendNotification(toPhone, message, recipientName = 'Dosen') {
        const formattedPhone = this.formatPhoneNumber(toPhone);

        console.log(`\n=======================================================`);
        console.log(`📱 [WHATSAPP NOTIFICATION DISPATCH]`);
        console.log(`Penerima : ${recipientName} (${toPhone || 'Nomor HP tidak diisi'} -> ${formattedPhone || 'Invalid'})`);
        console.log(`Pesan    :\n${message}`);
        console.log(`=======================================================\n`);

        if (!formattedPhone) {
            console.warn(`⚠️ [WA DISPATCH CANCELLED]: Nomor telepon (${toPhone}) tidak valid atau belum diisi.`);
            return { success: false, reason: 'Invalid phone number' };
        }

        const apiToken = process.env.FONNTE_TOKEN || process.env.WA_API_TOKEN || appConfig.fonnteToken || 'phKdYALrqXFnHL73UJ8b';
        const apiUrl = process.env.WA_API_URL || appConfig.waApiUrl || 'https://api.fonnte.com/send';

        if (!apiToken) {
            console.log(`💡 [WA GATEWAY INFO]: FONNTE_TOKEN belum diatur di .env. Menggunakan console output fallback.`);
            return { success: true, mode: 'console_fallback' };
        }

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': apiToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    target: formattedPhone,
                    message: message,
                    countryCode: '62'
                })
            });

            const resData = await response.json();
            console.log(`📱 [FONNTE WA API RESPONSE]:`, resData);

            if (resData && (resData.status === false || resData.status === 'false')) {
                const errorReason = resData.reason || resData.detail || 'Perangkat Fonnte terputus atau Token tidak valid.';
                console.warn(`❌ [FONNTE WA GATEWAY FAILED]:`, errorReason);
                return {
                    success: false,
                    error: errorReason,
                    waWebUrl: `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`
                };
            }

            return {
                success: true,
                data: resData,
                waWebUrl: `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`
            };
        } catch (err) {
            console.error(`❌ [FONNTE WA GATEWAY ERROR]:`, err.message);
            return {
                success: false,
                error: err.message,
                waWebUrl: `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`
            };
        }
    }

    /**
     * Send WA notification for Surat Undangan (Sempro, Semhas, Sidang).
     */
    static async sendUndanganNotification({
        dosenPhone,
        dosenNama,
        mhsNama,
        mhsNim,
        jenisSurat,
        perihal,
        nomorSurat,
        tanggal,
        waktu,
        ruangan,
        detailUrl
    }) {
        const url = detailUrl || appConfig.baseUrl;
        const message = 
`Yth. Bapak/Ibu ${dosenNama || 'Dosen Pembimbing'},

📌 *NOTIFIKASI E-SURAT TERBIT / PENETAPAN JADWAL*

Telah diterbitkan *${jenisSurat || 'Surat Undangan Ujian'}* untuk mahasiswa bimbingan Anda:

👤 *Mahasiswa*: ${mhsNama} (${mhsNim})
📝 *Perihal*: ${perihal || '-'}
🔢 *No. Surat*: ${nomorSurat || '-'}
📅 *Tanggal*: ${tanggal || '-'}
⏰ *Waktu*: ${waktu || '-'} WITA
🏛️ *Ruangan*: ${ruangan || '-'}

Silakan buka aplikasi E-Surat Administrasi TA untuk melihat rincian lebih lanjut:
🔗 ${url}

Terima kasih.
_Sistem E-Surat Administrasi TA Teknik Informatika_`;

        return await this.sendNotification(dosenPhone, message, dosenNama);
    }

    /**
     * Send WA notification for SK Dosen Pembimbing & Penguji TA.
     */
    static async sendSkNotification({
        dosenPhone,
        dosenNama,
        mhsNama,
        mhsNim,
        nomorSk,
        judulTa,
        peranDosen,
        detailUrl
    }) {
        const url = detailUrl || appConfig.baseUrl;
        const message = 
`Yth. Bapak/Ibu ${dosenNama || 'Dosen'},

📜 *NOTIFIKASI SURAT KEPUTUSAN (SK) DEKAN TERBIT*

Bapak/Ibu telah secara resmi ditetapkan sebagai *${peranDosen || 'Dosen Pembimbing / Penguji'}* untuk mahasiswa berikut:

👤 *Mahasiswa*: ${mhsNama} (${mhsNim})
📖 *Judul TA*: ${judulTa || '-'}
📜 *Nomor SK*: ${nomorSk || '-'}

Silakan login ke portal E-Surat Administrasi TA untuk memantau progress bimbingan/ujian mahasiswa:
🔗 ${url}

Terima kasih.
_Sistem E-Surat Administrasi TA Teknik Informatika_`;

        return await this.sendNotification(dosenPhone, message, dosenNama);
    }

    /**
     * Send WA notification to Dosen Pembimbing when Mahasiswa submits a new request (Surat Undangan, SK, etc.).
     */
    static async sendPengajuanNotification({
        dosenPhone,
        dosenNama,
        mhsNama,
        mhsNim,
        jenisSurat,
        perihal,
        tglPengajuan,
        detailUrl
    }) {
        const url = detailUrl || appConfig.baseUrl;
        const message = 
`Yth. Bapak/Ibu ${dosenNama || 'Dosen Pembimbing'},

📩 *NOTIFIKASI PENGAJUAN SURAT / SK BARU*

Mahasiswa bimbingan Anda baru saja mengajukan permohonan *${jenisSurat || 'Surat Administrasi TA'}*:

👤 *Mahasiswa*: ${mhsNama} (${mhsNim})
📝 *Perihal*: ${perihal || '-'}
📅 *Tanggal Pengajuan*: ${tglPengajuan || new Date().toISOString().split('T')[0]}

Silakan login ke portal E-Surat Administrasi TA untuk meninjau dan memberikan persetujuan (ACC):
🔗 ${url}

Terima kasih.
_Sistem E-Surat Administrasi TA Teknik Informatika_`;

        return await this.sendNotification(dosenPhone, message, dosenNama);
    }
}

module.exports = WhatsAppService;
