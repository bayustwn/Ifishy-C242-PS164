const pool = require('../../config/database');
const { saveFileToDisk, profileFolder, postFolder, scanHistoryFolder } = require('../../shared/storage');

const saveScanHistory = async (req, res) => {
  const { userId, disease, confidence, description, treatment, validation } = req.body;

  if (!userId || !disease || !confidence || !description || !treatment || !req.file) {
    return res.status(400).json({ message: "Semua data harus diisi!" });
  }

  const confidenceValue = parseFloat(confidence);
  if (isNaN(confidenceValue)) {
    return res.status(400).json({ message: "Confidence harus berupa angka desimal!" });
  }

  if (description.length > 1000) {
    return res.status(400).json({ message: "Deskripsi terlalu panjang (maksimal 1000 karakter)." });
  }
  if (treatment.length > 1000) {
    return res.status(400).json({ message: "Langkah penanganan terlalu panjang (maksimal 1000 karakter)." });
  }
  if (validation && validation.length > 1000) {
    return res.status(400).json({ message: "Validasi terlalu panjang (maksimal 1000 karakter)." });
  }

  try {
    const fishImageUrl = await saveFileToDisk(req, req.file, scanHistoryFolder);
    const query = `
      INSERT INTO scan_history (user_id, fish_image, disease, confidence, description, treatment, validation, scan_timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    await pool.query(query, [userId, fishImageUrl, disease, confidenceValue, description, treatment, validation || null]);

    res.status(201).json({
      message: "Riwayat scan berhasil disimpan!",
      data: { imageUrl: fishImageUrl, fishName: disease, accuracy: confidenceValue },
    });
  } catch (error) {
    console.error('Error saat menyimpan scan history:', error.message);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

const getScanHistoryById = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ message: "User ID diperlukan!" });
  }

  try {
    const query = `
      SELECT id, user_id, fish_image, disease, confidence, description, treatment, validation, scan_timestamp 
      FROM scan_history 
      WHERE user_id = ? 
      ORDER BY scan_timestamp DESC
    `;

    const [results] = await pool.query(query, [userId]);

    if (results.length === 0) {
      return res.status(404).json({ message: "Scan history tidak ditemukan untuk user ini." });
    }

    res.status(200).json({
      message: "Scan history berhasil diambil!",
      data: results.map((history) => ({
        id: history.id,
        userId: history.user_id,
        fishImage: history.fish_image,
        disease: history.disease,
        confidence: parseFloat(history.confidence),
        description: history.description,
        treatment: history.treatment,
        validation: history.validation,
        scanTimestamp: history.scan_timestamp,
      })),
    });
  } catch (error) {
    console.error("Error saat mengambil scan history:", error.message);
    res.status(500).json({ message: "Gagal mengambil scan history." });
  }
};

module.exports = { saveScanHistory, getScanHistoryById };
