// Unit test articles.service: mock prisma; jalankan via `npm test`.
const mockPrisma = {
  article: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  $disconnect: jest.fn(),
};

jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => mockPrisma) }));

const articlesService = require('../articles.service');

const ARTICLE_ID = '10000000-0000-4000-8000-000000000003';

beforeEach(() => {
  jest.resetAllMocks();
});

describe('getArticleById', () => {
  test('id UUID ditemukan → row snake_case (published_at/cover_image)', async () => {
    mockPrisma.article.findUnique.mockResolvedValue({
      id: ARTICLE_ID, title: 'T', content: 'C', author: 'A', publishedAt: new Date('2024-05-01T08:00:00Z'), coverImage: 'c.jpg',
    });

    const row = await articlesService.getArticleById(ARTICLE_ID);

    expect(mockPrisma.article.findUnique).toHaveBeenCalledWith({ where: { id: ARTICLE_ID } });
    expect(row).toEqual({ id: ARTICLE_ID, title: 'T', content: 'C', author: 'A', published_at: new Date('2024-05-01T08:00:00Z'), cover_image: 'c.jpg' });
  });

  test('id bukan UUID → tidak memquery, balik null', async () => {
    expect(await articlesService.getArticleById('abc')).toBeNull();
    expect(mockPrisma.article.findUnique).not.toHaveBeenCalled();
  });

  test('tidak ditemukan → null', async () => {
    mockPrisma.article.findUnique.mockResolvedValue(null);
    expect(await articlesService.getArticleById('10000000-0000-4000-8000-000000000999')).toBeNull();
  });
});

describe('getAllArticles', () => {
  test('urut publishedAt desc + shape snake_case + default limit 10', async () => {
    const d = new Date('2024-05-01T08:00:00Z');
    mockPrisma.article.findMany.mockResolvedValue([{ id: ARTICLE_ID, title: 'T', content: 'C', author: null, publishedAt: d, coverImage: null }]);

    const rows = await articlesService.getAllArticles();

    expect(mockPrisma.article.findMany).toHaveBeenCalledWith({ orderBy: { publishedAt: 'desc' }, take: 10 });
    expect(rows[0].published_at).toEqual(d);
    expect(rows[0].cover_image).toBeNull();
  });

  test('offset dikirim ke prisma', async () => {
    mockPrisma.article.findMany.mockResolvedValue([]);

    await articlesService.getAllArticles({ limit: 5, offset: 10 });

    expect(mockPrisma.article.findMany).toHaveBeenCalledWith({
      orderBy: { publishedAt: 'desc' },
      take: 5,
      skip: 10,
    });
  });
});
