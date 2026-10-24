// Unit test articles.controller: mock service; jalankan via `npm test`.
jest.mock('../articles.service', () => ({
  getArticleById: jest.fn(),
  getAllArticles: jest.fn(),
}));

const articlesService = require('../articles.service');
const controller = require('../articles.controller');

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

beforeEach(() => {
  jest.resetAllMocks();
});

describe('getArticleById', () => {
  test('service null → 404 "Article not found"', async () => {
    articlesService.getArticleById.mockResolvedValue(null);

    const res = await call(controller.getArticleById, { params: { id: '999' } });

    expect(res.statusCode).toBe(404);
    expect(res.body.error.message).toBe('Article not found');
  });

  test('ditemukan → 200 data snake_case', async () => {
    articlesService.getArticleById.mockResolvedValue({ id: 3, title: 'T', published_at: 'x', cover_image: 'c' });

    const res = await call(controller.getArticleById, { params: { id: '3' } });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Article fetched successfully');
    expect(res.body.data.cover_image).toBe('c');
  });
});

describe('getAllArticles', () => {
  test('200 data list + default pagination', async () => {
    articlesService.getAllArticles.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const res = await call(controller.getAllArticles, {});

    expect(articlesService.getAllArticles).toHaveBeenCalledWith({ limit: 10, offset: 0 });
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.message).toBe('Articles fetched successfully');
  });
});
