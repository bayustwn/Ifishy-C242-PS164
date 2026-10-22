const scanService = require('./scan.service');
const { saveScanSchema, scanUserIdSchema } = require('./scan.schema');
const { saveFileToDisk, scanHistoryFolder } = require('../../shared/storage');

const saveScanHistory = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Semua data harus diisi!' });
    }

    const parsed = saveScanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const fishImageUrl = await saveFileToDisk(req, req.file, scanHistoryFolder);
    const data = await scanService.saveScanHistory(Number(parsed.data.userId), {
      fishImage: fishImageUrl,
      disease: parsed.data.disease,
      confidence: parsed.data.confidence,
      description: parsed.data.description,
      treatment: parsed.data.treatment,
      validation: parsed.data.validation,
    });

    return res.status(201).json({
      message: 'Riwayat scan berhasil disimpan!',
      data,
    });
  } catch (error) {
    console.error('Error saat menyimpan scan history:', error.message);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
};

const getScanHistoryById = async (req, res) => {
  try {
    const parsed = scanUserIdSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ message: 'User ID diperlukan!' });
    }

    const histories = await scanService.getScanHistoriesByUserId(Number(parsed.data.userId));
    if (histories.length === 0) {
      return res.status(404).json({ message: 'Scan history tidak ditemukan untuk user ini.' });
    }

    return res.status(200).json({
      message: 'Scan history berhasil diambil!',
      data: histories,
    });
  } catch (error) {
    console.error('Error saat mengambil scan history:', error.message);
    return res.status(500).json({ message: 'Gagal mengambil scan history.' });
  }
};

module.exports = { saveScanHistory, getScanHistoryById };
