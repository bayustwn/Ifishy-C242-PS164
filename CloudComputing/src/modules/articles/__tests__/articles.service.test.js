// Unit test articles.service: mock prisma & puppeteer; jalankan via `npm test`.
const mockPuppeteerState = { launch: jest.fn() };

jest.mock('puppeteer', () => ({ launch: (...args) => mockPuppeteerState.launch(...args) }));

const mockPrisma = {
  article: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  $disconnect: jest.fn(),
};

jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => mockPrisma) }));

const articlesService = require('../articles.service');

const fakeBrowserFor = (evaluateResult) => {
  const fakePage = {
    setRequestInterception: jest.fn().mockResolvedValue(),
    on: jest.fn(),
    goto: jest.fn(),
    evaluate: jest.fn().mockResolvedValue(evaluateResult),
  };
  const fakeBrowser = { newPage: jest.fn().mockResolvedValue(fakePage), close: jest.fn().mockResolvedValue() };
  mockPuppeteerState.launch.mockResolvedValue(fakeBrowser);
  return { fakePage, fakeBrowser };
};

beforeEach(() => {
  jest.resetAllMocks();
  mockPuppeteerState.launch.mockReset();
});

describe('getArticleById', () => {
  test('id numerik ditemukan → row snake_case (published_at/cover_image)', async () => {
    mockPrisma.article.findUnique.mockResolvedValue({
      id: 3, title: 'T', content: 'C', author: 'A', publishedAt: new Date('2024-05-01T08:00:00Z'), coverImage: 'c.jpg',
    });

    const row = await articlesService.getArticleById('3');

    expect(mockPrisma.article.findUnique).toHaveBeenCalledWith({ where: { id: 3 } });
    expect(row).toEqual({ id: 3, title: 'T', content: 'C', author: 'A', published_at: new Date('2024-05-01T08:00:00Z'), cover_image: 'c.jpg' });
  });

  test('id bukan angka → tidak memquery, balik null', async () => {
    expect(await articlesService.getArticleById('abc')).toBeNull();
    expect(mockPrisma.article.findUnique).not.toHaveBeenCalled();
  });

  test('tidak ditemukan → null', async () => {
    mockPrisma.article.findUnique.mockResolvedValue(null);
    expect(await articlesService.getArticleById('999')).toBeNull();
  });
});

describe('getAllArticles', () => {
  test('urut publishedAt desc + shape snake_case', async () => {
    const d = new Date('2024-05-01T08:00:00Z');
    mockPrisma.article.findMany.mockResolvedValue([{ id: 4, title: 'T', content: 'C', author: null, publishedAt: d, coverImage: null }]);

    const rows = await articlesService.getAllArticles();

    expect(mockPrisma.article.findMany).toHaveBeenCalledWith({ orderBy: { publishedAt: 'desc' } });
    expect(rows[0].published_at).toEqual(d);
    expect(rows[0].cover_image).toBeNull();
  });
});

describe('fetchAndSaveFromUrl', () => {
  test('scrape sukses → prisma.create + {articleId}; tanggal valid', async () => {
    const { fakePage, fakeBrowser } = fakeBrowserFor({
      title: 'T', content: 'C', author: 'A', coverImage: 'c.jpg', images: [], publicationTime: '2024-05-01T08:00:00Z',
    });
    mockPrisma.article.create.mockResolvedValue({ id: 77 });

    const out = await articlesService.fetchAndSaveFromUrl('https://contoh.com/isi');

    expect(mockPuppeteerState.launch).toHaveBeenCalled();
    expect(fakePage.setRequestInterception).toHaveBeenCalledWith(true);
    expect(fakePage.goto).toHaveBeenCalledWith('https://contoh.com/isi');
    expect(mockPrisma.article.create).toHaveBeenCalledWith({
      data: { title: 'T', content: 'C', author: 'A', coverImage: 'c.jpg', publishedAt: new Date('2024-05-01T08:00:00Z') },
    });
    expect(out).toEqual({ articleId: 77 });
    expect(fakeBrowser.close).toHaveBeenCalled();
  });

  test('format publicationTime invalid → throw (controller → 500 lama)', async () => {
    fakeBrowserFor({
      title: 'T', content: 'C', author: 'A', coverImage: 'c.jpg', images: [], publicationTime: 'Unknown publication date',
    });

    const rejected = await articlesService.fetchAndSaveFromUrl('https://contoh.com/x').then(
      () => null,
      (e) => e
    );
    // service melempar objek Date invalid (bukan Error) — assert perilakunya persis
    expect(rejected).toBeInstanceOf(Date);
    expect(Number.isNaN(rejected.getTime())).toBe(true);
    expect(mockPrisma.article.create).not.toHaveBeenCalled();
  });

  test('puppeteer gagal → {message:"Failed to scrape article"}', async () => {
    mockPuppeteerState.launch.mockRejectedValue(new Error('launch timeout'));

    const out = await articlesService.fetchAndSaveFromUrl('https://contoh.com/x');

    expect(out).toEqual({ message: 'Failed to scrape article' });
  });
});
