const express = require('express');
const router = express.Router();
const SuratModel = require('../models/SuratModel');

// Sample RESTful API Endpoint to fetch Surat Status JSON
router.get('/surat/status/:uuid', async (req, res) => {
    try {
        const surat = await SuratModel.getDetailByUuid(req.params.uuid);
        if (!surat) {
            return res.status(404).json({ success: false, message: 'Dokumen tidak ditemukan.' });
        }
        return res.json({ success: true, data: surat });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
