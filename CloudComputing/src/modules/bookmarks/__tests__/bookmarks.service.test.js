// Unit test service: mock prisma; jalankan via `npm test` di container.
const mockPrisma = {
  bookmark: {
    findFirst: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
  },
  post: { findUnique: jest.fn(), findMany: jest.fn() },
  article: { findUnique: jest.fn(), findMany: jest.fn() },
  $disconnect: jest.fn(),
};

jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => mockPrisma) }));

const bookmarkService = require('../bookmarks.service');

beforeEach(() => jest.resetAllMocks());

describe('addBookmark (toggle)', () => {
  test('belum ada → insert → "added"', async () => {
    mockPrisma.bookmark.findFirst.mockResolvedValue(null);
    mockPrisma.bookmark.create.mockResolvedValue({});

    const outcome = await bookmarkService.addBookmark(1, { itemId: 9, type: 'article' });

    expect(outcome).toBe('added');
    expect(mockPrisma.bookmark.create).toHaveBeenCalledWith({ data: { userId: 1, type: 'article', itemId: 9 } });
    expect(mockPrisma.bookmark.delete).not.toHaveBeenCalled();
  });

  test('sudah ada → delete → "removed"', async () => {
    mockPrisma.bookmark.findFirst.mockResolvedValue({ id: 7 });
    mockPrisma.bookmark.delete.mockResolvedValue({});

    const outcome = await bookmarkService.addBookmark(1, { itemId: 9, type: 'article' });

    expect(outcome).toBe('removed');
    expect(mockPrisma.bookmark.delete).toHaveBeenCalledWith({ where: { id: 7 } });
    expect(mockPrisma.bookmark.create).not.toHaveBeenCalled();
  });
});

describe('removeBookmark', () => {
  test('idempotent — deleteMany, row hilang pun tetap ok', async () => {
    mockPrisma.bookmark.deleteMany.mockResolvedValue({ count: 0 });

    await bookmarkService.removeBookmark(1, { itemId: 987654, type: 'post' });

    expect(mockPrisma.bookmark.deleteMany).toHaveBeenCalledWith({ where: { userId: 1, itemId: 987654, type: 'post' } });
  });
});

describe('getBookmarks', () => {
  test('urut terbaru, judul pas per tipe, shape {id,type,item_id,title,created_at}', async () => {
    const t2 = new Date('2024-01-02T00:00:00Z');
    const t1 = new Date('2024-01-01T00:00:00Z');
    mockPrisma.bookmark.findMany.mockResolvedValue([
      { id: 2, type: 'post', itemId: 11, createdAt: t2 },
      { id: 1, type: 'article', itemId: 22, createdAt: t1 },
    ]);
    mockPrisma.post.findMany.mockResolvedValue([{ id: 11, title: 'BMUD post' }]);
    mockPrisma.article.findMany.mockResolvedValue([{ id: 22, title: 'BMUD article' }]);

    const list = await bookmarkService.getBookmarks(1);

    expect(mockPrisma.bookmark.findMany).toHaveBeenCalledWith({ where: { userId: 1 }, orderBy: { createdAt: 'desc' } });
    expect(mockPrisma.post.findMany).toHaveBeenCalledWith({ where: { id: { in: [11] } }, select: { id: true, title: true } });
    expect(mockPrisma.article.findMany).toHaveBeenCalledWith({ where: { id: { in: [22] } }, select: { id: true, title: true } });
    expect(mockPrisma.post.findUnique).not.toHaveBeenCalled();
    expect(list[0]).toStrictEqual({ id: 2, type: 'post', item_id: 11, title: 'BMUD post', created_at: t2 });
    expect(list[1]).toStrictEqual({ id: 1, type: 'article', item_id: 22, title: 'BMUD article', created_at: t1 });
  });
});

describe('getBookmarkById', () => {
  test('tidak ketemu → null', async () => {
    mockPrisma.bookmark.findFirst.mockResolvedValue(null);
    expect(await bookmarkService.getBookmarkById(1, 9876541)).toBeNull();
  });

  test('ketemu → shape berjudul', async () => {
    const t = new Date('2024-01-02T00:00:00Z');
    mockPrisma.bookmark.findFirst.mockResolvedValue({ id: 5, type: 'post', itemId: 11, createdAt: t });
    mockPrisma.post.findUnique.mockResolvedValue({ title: 'BMUD post' });

    const found = await bookmarkService.getBookmarkById(1, 5);
    expect(found).toStrictEqual({ id: 5, type: 'post', item_id: 11, title: 'BMUD post', created_at: t });
  });
});
