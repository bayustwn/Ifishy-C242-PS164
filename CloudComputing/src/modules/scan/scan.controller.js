const guard = require('../../shared/guard');
const firstIssueMessage = require('../../shared/validation');
const { parsePagination } = require('../../shared/pagination');
const { ok, fail } = require('../../shared/response');
const scanService = require('./scan.service');
const { saveScanSchema, scanUserIdSchema } = require('./scan.schema');
const { saveFileToDisk, scanHistoryFolder } = require('../../shared/storage');

const saveScanHistory = guard('Error saat menyimpan scan history', 'Terjadi kesalahan pada server.', async (req, res) => {
  if (!req.file) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Semua data harus diisi!');
  }

  const parsed = saveScanSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, 'VALIDATION_ERROR', firstIssueMessage(parsed));
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

  return ok(res, data, 'Riwayat scan berhasil disimpan!', 201);
});

const getScanHistoryById = guard('Error saat mengambil scan history', 'Gagal mengambil scan history.', async (req, res) => {
  const parsed = scanUserIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return fail(res, 400, 'VALIDATION_ERROR', 'User ID diperlukan!');
  }

  const histories = await scanService.getScanHistoriesByUserId(
    Number(parsed.data.userId),
    parsePagination(req.query),
  );
  if (histories.length === 0) {
    return fail(res, 404, 'NOT_FOUND', 'Scan history tidak ditemukan untuk user ini.');
  }

  return ok(res, histories, 'Scan history berhasil diambil!');
});

module.exports = { saveScanHistory, getScanHistoryById };
