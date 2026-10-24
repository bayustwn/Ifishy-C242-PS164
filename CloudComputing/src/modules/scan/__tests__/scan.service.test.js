// Unit test scan.service: mock prisma; jalankan via `npm test` di container.
const mockPrisma = {
  scanHistory: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  $disconnect: jest.fn(),
};

jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => mockPrisma) }));

const scanService = require('../scan.service');

beforeEach(() => jest.resetAllMocks());

describe('saveScanHistory', () => {
  test('buat via prisma, balik {imageUrl, fishName, accuracy}', async () => {
    const t = new Date('2024-01-02T00:00:00Z');
    mockPrisma.scanHistory.create.mockResolvedValue({
      id: 1, userId: 3, fishImage: '/uploads/scan-history/x.jpg', disease: 'Argulus',
      confidence: 0.92, description: 'd', treatment: 't', validation: null, scanTimestamp: t,
    });

    const data = await scanService.saveScanHistory(3, {
      fishImage: '/uploads/scan-history/x.jpg', disease: 'Argulus', confidence: 0.92,
      description: 'd', treatment: 't', validation: undefined,
    });

    expect(mockPrisma.scanHistory.create).toHaveBeenCalledWith({
      data: {
        userId: 3, fishImage: '/uploads/scan-history/x.jpg', disease: 'Argulus', confidence: 0.92,
        description: 'd', treatment: 't', validation: null,
        scanTimestamp: expect.any(Date),
      },
    });
    expect(data).toEqual({ imageUrl: '/uploads/scan-history/x.jpg', fishName: 'Argulus', accuracy: 0.92 });
  });
});

describe('getScanHistoriesByUserId', () => {
  test('urut scan_timestamp desc + bentuk camelCase per history', async () => {
    const t = new Date('2024-01-02T00:00:00Z');
    mockPrisma.scanHistory.findMany.mockResolvedValue([
      { id: 2, userId: 3, fishImage: 'img-2', disease: 'Ichthyophthirius', confidence: 0.88,
        description: 'desc', treatment: 'cure', validation: 'ok', scanTimestamp: t },
    ]);

    const list = await scanService.getScanHistoriesByUserId(3);

    expect(mockPrisma.scanHistory.findMany).toHaveBeenCalledWith({ where: { userId: 3 }, orderBy: { scanTimestamp: 'desc' }, take: 10 });
    expect(list[0]).toStrictEqual({
      id: 2, userId: 3, fishImage: 'img-2', disease: 'Ichthyophthirius', confidence: 0.88,
      description: 'desc', treatment: 'cure', validation: 'ok', scanTimestamp: t,
    });
  });

  test('belum ada riwayat → array kosong', async () => {
    mockPrisma.scanHistory.findMany.mockResolvedValue([]);
    expect(await scanService.getScanHistoriesByUserId(999)).toEqual([]);
  });
});
