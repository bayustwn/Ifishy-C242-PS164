// Unit test scan.controller: mock service; jalankan via `npm test` di container.
jest.mock('../scan.service', () => ({
  saveScanHistory: jest.fn(),
  getScanHistoriesByUserId: jest.fn(),
}));

jest.mock('../../../shared/r2', () => {
  const actual = jest.requireActual('../../../shared/r2');
  return { ...actual, verifyUpload: jest.fn() };
});

const r2 = require('../../../shared/r2');
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
  imageKey: 'scans/3/a.jpg', disease: 'Argulus', confidence: '0.92',
  description: 'd', treatment: 't', validation: 'v',
};

beforeEach(() => {
  jest.resetAllMocks();
  r2.verifyUpload.mockResolvedValue({});
});

describe('saveScanHistory', () => {
  test('imageKey tidak ada → 400 "Semua data harus diisi!"', async () => {
    const res = await call(controller.saveScanHistory, { user: { id: 3 }, body: { ...goodBody, imageKey: undefined } });
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toBe('Semua data harus diisi!');
    expect(scanService.saveScanHistory).not.toHaveBeenCalled();
  });

  test('confidence bukan angka → 400 pesan desimal', async () => {
    const res = await call(controller.saveScanHistory, {
      user: { id: 3 },
      body: { ...goodBody, confidence: 'abc' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toBe('Confidence harus berupa angka desimal!');
  });

  test('deskripsi >1000 → 400 pesan deskripsi (prioritas di bawah confidence)', async () => {
    const res = await call(controller.saveScanHistory, {
      user: { id: 3 },
      body: { ...goodBody, description: 'x'.repeat(1001) },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toBe('Deskripsi terlalu panjang (maksimal 1000 karakter).');
  });

  test('imageKey milik user lain → 400', async () => {
    const res = await call(controller.saveScanHistory, {
      user: { id: 3 },
      body: { ...goodBody, imageKey: 'scans/4/a.jpg' },
    });
    expect(res.statusCode).toBe(400);
    expect(scanService.saveScanHistory).not.toHaveBeenCalled();
  });

  test('upload tidak ada/tidak valid → 400 tanpa simpan', async () => {
    r2.verifyUpload.mockRejectedValue(new Error('not found'));

    const res = await call(controller.saveScanHistory, {
      user: { id: 3 },
      body: goodBody,
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toBe('Upload not found or invalid');
    expect(scanService.saveScanHistory).not.toHaveBeenCalled();
  });

  test('valid → panggil service → 201 dengan payload image', async () => {
    scanService.saveScanHistory.mockResolvedValue({ imageUrl: 'u', fishName: 'd', accuracy: 0.92 });

    const res = await call(controller.saveScanHistory, {
      user: { id: 3 },
      body: goodBody,
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe('Riwayat scan berhasil disimpan!');
    expect(scanService.saveScanHistory).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ disease: 'Argulus', confidence: 0.92, fishImage: 'scans/3/a.jpg' })
    );
  });
});

describe('getScanHistoryById', () => {
  test('userId kosong → 400 "User ID diperlukan!"', async () => {
    const res = await call(controller.getScanHistoryById, { user: { id: 3 }, params: {} });
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toBe('User ID diperlukan!');
    expect(scanService.getScanHistoriesByUserId).not.toHaveBeenCalled();
  });

  test('userId user lain → 403 tanpa query', async () => {
    const res = await call(controller.getScanHistoryById, { user: { id: 3 }, params: { userId: '4' } });

    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(scanService.getScanHistoriesByUserId).not.toHaveBeenCalled();
  });

  test('riwayat kosong → 200 data []', async () => {
    scanService.getScanHistoriesByUserId.mockResolvedValue([]);

    const res = await call(controller.getScanHistoryById, { user: { id: 999 }, params: { userId: '999' } });

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.message).toBe('Scan history berhasil diambil!');
  });

  test('ada riwayat → 200 dengan data camelCase', async () => {
    scanService.getScanHistoriesByUserId.mockResolvedValue([{ id: 2, confidence: 0.88 }]);

    const res = await call(controller.getScanHistoryById, { user: { id: 3 }, params: { userId: '3' } });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Scan history berhasil diambil!');
    expect(scanService.getScanHistoriesByUserId).toHaveBeenCalledWith(3, {});
    expect(res.body.data).toEqual([{ id: 2, confidence: 0.88 }]);
  });
});
