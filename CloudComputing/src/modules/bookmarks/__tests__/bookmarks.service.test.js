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
  $transaction: jest.fn(),
  $disconnect: jest.fn(),
};

jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => mockPrisma) }));

const bookmarkService = require('../bookmarks.service');

const USER_ID = '20000000-0000-4000-8000-000000000001';
const ITEM_ID = '20000000-0000-4000-8000-000000000009';
const BOOKMARK_ID = '20000000-0000-4000-8000-000000000005';
const BOOKMARK_ID_2 = '20000000-0000-4000-8000-000000000002';
const BOOKMARK_ID_3 = '20000000-0000-4000-8000-000000000001';
const POST_ID = '20000000-0000-4000-8000-000000000011';
const ARTICLE_ID = '20000000-0000-4000-8000-000000000022';

beforeEach(() => {
  jest.resetAllMocks();
  mockPrisma.$transaction.mockImplementation((fn) => fn(mockPrisma));
});

describe('addBookmark (toggle)', () => {
  test('belum ada → insert → "added"', async () => {
    mockPrisma.bookmark.findFirst.mockResolvedValue(null);
    mockPrisma.bookmark.create.mockResolvedValue({});

    const outcome = await bookmarkService.addBookmark(USER_ID, { itemId: ITEM_ID, type: 'article' });

    expect(outcome).toBe('added');
    expect(mockPrisma.bookmark.create).toHaveBeenCalledWith({ data: { userId: USER_ID, type: 'article', itemId: ITEM_ID } });
    expect(mockPrisma.bookmark.delete).not.toHaveBeenCalled();
  });

  test('sudah ada → delete → "removed"', async () => {
    mockPrisma.bookmark.findFirst.mockResolvedValue({ id: 7 });
    mockPrisma.bookmark.delete.mockResolvedValue({});

    const outcome = await bookmarkService.addBookmark(USER_ID, { itemId: ITEM_ID, type: 'article' });

    expect(outcome).toBe('removed');
    expect(mockPrisma.bookmark.deleteMany).toHaveBeenCalledWith({ where: { id: 7 } });
    expect(mockPrisma.bookmark.create).not.toHaveBeenCalled();
  });
});

describe('removeBookmark', () => {
  test('idempotent — deleteMany, row hilang pun tetap ok', async () => {
    mockPrisma.bookmark.deleteMany.mockResolvedValue({ count: 0 });

    await bookmarkService.removeBookmark(USER_ID, { itemId: ITEM_ID, type: 'post' });

    expect(mockPrisma.bookmark.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID, itemId: ITEM_ID, type: 'post' } });
  });
});

describe('getBookmarks', () => {
  test('urut terbaru, judul pas per tipe, shape {id,type,item_id,title,created_at}', async () => {
    const t2 = new Date('2024-01-02T00:00:00Z');
    const t1 = new Date('2024-01-01T00:00:00Z');
    mockPrisma.bookmark.findMany.mockResolvedValue([
      { id: BOOKMARK_ID_2, type: 'post', itemId: POST_ID, createdAt: t2 },
      { id: BOOKMARK_ID_3, type: 'article', itemId: ARTICLE_ID, createdAt: t1 },
    ]);
    mockPrisma.post.findMany.mockResolvedValue([{ id: POST_ID, title: 'BMUD post' }]);
    mockPrisma.article.findMany.mockResolvedValue([{ id: ARTICLE_ID, title: 'BMUD article' }]);

    const list = await bookmarkService.getBookmarks(USER_ID);

    expect(mockPrisma.bookmark.findMany).toHaveBeenCalledWith({ where: { userId: USER_ID }, orderBy: { createdAt: 'desc' }, take: 10 });
    expect(mockPrisma.post.findMany).toHaveBeenCalledWith({ where: { id: { in: [POST_ID] } }, select: { id: true, title: true } });
    expect(mockPrisma.article.findMany).toHaveBeenCalledWith({ where: { id: { in: [ARTICLE_ID] } }, select: { id: true, title: true } });
    expect(mockPrisma.post.findUnique).not.toHaveBeenCalled();
    expect(list[0]).toStrictEqual({ id: BOOKMARK_ID_2, type: 'post', item_id: POST_ID, title: 'BMUD post', created_at: t2 });
    expect(list[1]).toStrictEqual({ id: BOOKMARK_ID_3, type: 'article', item_id: ARTICLE_ID, title: 'BMUD article', created_at: t1 });
  });
});

describe('getBookmarkById', () => {
  test('tidak ketemu → null', async () => {
    mockPrisma.bookmark.findFirst.mockResolvedValue(null);
    expect(await bookmarkService.getBookmarkById(USER_ID, ITEM_ID)).toBeNull();
  });

  test('ketemu → shape berjudul', async () => {
    const t = new Date('2024-01-02T00:00:00Z');
    mockPrisma.bookmark.findFirst.mockResolvedValue({ id: BOOKMARK_ID, type: 'post', itemId: POST_ID, createdAt: t });
    mockPrisma.post.findUnique.mockResolvedValue({ title: 'BMUD post' });

    const found = await bookmarkService.getBookmarkById(USER_ID, BOOKMARK_ID);
    expect(found).toStrictEqual({ id: BOOKMARK_ID, type: 'post', item_id: POST_ID, title: 'BMUD post', created_at: t });
  });
});
