// Unit test scan.controller: mock service; jalankan via `npm test` di container.
jest.mock('../scan.service', () => ({
  saveScanHistory: jest.fn(),
  getScanHistoriesByUserId: jest.fn(),
}));

const scanService = require('../scan.service');
const controller = require('../scan.controller');

const fakeRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (b) => {
    res.body = b;
    return res;
  };
  return res;
};

const call = (handler, req) => {
  const res = fakeRes();
  return Promise.resolve(handler(req, res)).then(() => res);
};

const goodBody = {
  userId: '3', disease: 'Argulus', confidence: '0.92',
  description: 'd', treatment: 't', validation: 'v',
};

beforeEach(() => jest.resetAllMocks());

describe('saveScanHistory', () => {
  test('file tidak ada → 400 "Semua data harus diisi!"', async () => {
    const res = await call(controller.saveScanHistory, { body: goodBody });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Semua data harus diisi!');
    expect(scanService.saveScanHistory).not.toHaveBeenCalled();
  });

  test('confidence bukan angka → 400 pesan desimal', async () => {
    const res = await call(controller.saveScanHistory, {
      file: { originalname: 'a.jpg', buffer: Buffer.from('x') },
      body: { ...goodBody, confidence: 'abc' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Confidence harus berupa angka desimal!');
  });

  test('deskripsi >1000 → 400 pesan deskripsi (prioritas di bawah confidence)', async () => {
    const res = await call(controller.saveScanHistory, {
      file: { originalname: 'a.jpg', buffer: Buffer.from('x') },
      body: { ...goodBody, description: 'x'.repeat(1001) },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Deskripsi terlalu panjang (maksimal 1000 karakter).');
  });

  test('valid → walik service → 201 dengan payload image', async () => {
    scanService.saveScanHistory.mockResolvedValue({ imageUrl: 'u', fishName: 'd', accuracy: 0.92 });

    const res = await call(controller.saveScanHistory, {
      file: { originalname: 'a.jpg', buffer: Buffer.from('x') },
      protocol: 'http', get: () => 'h', // untuk saveFileToDisk
      body: goodBody,
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe('Riwayat scan berhasil disimpan!');
    expect(scanService.saveScanHistory).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ disease: 'Argulus', confidence: 0.92 })
    );
  });
});

describe('getScanHistoryById', () => {
  test('userId kosong → 400 "User ID diperlukan!"', async () => {
    const res = await call(controller.getScanHistoryById, { params: {} });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('User ID diperlukan!');
    expect(scanService.getScanHistoriesByUserId).not.toHaveBeenCalled();
  });

  test('riwayat kosong → 404 "Scan history tidak ditemukan untuk user ini."', async () => {
    scanService.getScanHistoriesByUserId.mockResolvedValue([]);

    const res = await call(controller.getScanHistoryById, { params: { userId: '999' } });

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe('Scan history tidak ditemukan untuk user ini.');
  });

  test('ada riwayat → 200 dengan data camelCase', async () => {
    scanService.getScanHistoriesByUserId.mockResolvedValue([{ id: 2, confidence: 0.88 }]);

    const res = await call(controller.getScanHistoryById, { params: { userId: '3' } });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Scan history berhasil diambil!');
    expect(scanService.getScanHistoriesByUserId).toHaveBeenCalledWith(3, {});
    expect(res.body.data).toEqual([{ id: 2, confidence: 0.88 }]);
  });
});
