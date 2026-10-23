jest.mock('../../../shared/prisma', () => ({
  user: { findFirst: jest.fn() },
  post: { findFirst: jest.fn() },
  scanHistory: { findFirst: jest.fn() },
}));

const prisma = require('../../../shared/prisma');
const service = require('../uploads.service');

beforeEach(() => {
  jest.resetAllMocks();
  prisma.user.findFirst.mockResolvedValue(null);
  prisma.post.findFirst.mockResolvedValue(null);
  prisma.scanHistory.findFirst.mockResolvedValue(null);
});

describe('findUsage', () => {
  test('tidak dipakai → null', async () => {
    expect(await service.findUsage('avatars/1/a.png')).toBeNull();
  });

  test('dipakai avatar → "avatar"', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 1 });
    expect(await service.findUsage('avatars/1/a.png')).toBe('avatar');
  });

  test('dipakai post → "post"', async () => {
    prisma.post.findFirst.mockResolvedValue({ id: 2 });
    expect(await service.findUsage('posts/1/a.png')).toBe('post');
  });

  test('dipakai scan → "scan"', async () => {
    prisma.scanHistory.findFirst.mockResolvedValue({ id: 3 });
    expect(await service.findUsage('scans/1/a.png')).toBe('scan');
  });
});
