// Unit test controller: mock service; jalankan via `npm test` di container.
jest.mock('../bookmarks.service', () => ({
  addBookmark: jest.fn(),
  removeBookmark: jest.fn(),
  getBookmarks: jest.fn(),
  getBookmarkById: jest.fn(),
}));

const bookmarkService = require('../bookmarks.service');
const controller = require('../bookmarks.controller');

const USER_ID = '20000000-0000-4000-8000-000000000001';
const ITEM_ID = '20000000-0000-4000-8000-000000000009';
const BOOKMARK_ID = '20000000-0000-4000-8000-000000000005';
const ITEM_ID_2 = '20000000-0000-4000-8000-000000000002';


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

beforeEach(() => jest.resetAllMocks());

describe('addBookmark', () => {
  test('body tidak valid → 400 "Invalid input data", tanpa memanggil service', async () => {
    const res = await call(controller.addBookmark, { user: { id: USER_ID }, body: { type: 'asal' } });
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toBe('Invalid input data');
    expect(bookmarkService.addBookmark).not.toHaveBeenCalled();
  });

  test('service "added" → 201', async () => {
    bookmarkService.addBookmark.mockResolvedValue('added');

    const res = await call(controller.addBookmark, { user: { id: USER_ID }, body: { itemId: ITEM_ID, type: 'article' } });

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe('Bookmark added successfully');
    expect(bookmarkService.addBookmark).toHaveBeenCalledWith(USER_ID, { itemId: ITEM_ID, type: 'article' });
  });

  test('service "removed" → 200 (toggle off)', async () => {
    bookmarkService.addBookmark.mockResolvedValue('removed');

    const res = await call(controller.addBookmark, { user: { id: USER_ID }, body: { itemId: ITEM_ID, type: 'article' } });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Bookmark removed successfully');
  });
});

describe('removeBookmark', () => {
  test('body tidak valid → 400', async () => {
    const res = await call(controller.removeBookmark, { user: { id: USER_ID }, body: {} });
    expect(res.statusCode).toBe(400);
    expect(bookmarkService.removeBookmark).not.toHaveBeenCalled();
  });

  test('idempotent → selalu 200', async () => {
    const res = await call(controller.removeBookmark, { user: { id: USER_ID }, body: { itemId: ITEM_ID_2, type: 'post' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('getBookmarks', () => {
  test('200, service menerima userId, respons pakai kunci bookmarks', async () => {
    bookmarkService.getBookmarks.mockResolvedValue([]);

    const res = await call(controller.getBookmarks, { user: { id: USER_ID } });

    expect(res.statusCode).toBe(200);
    expect(bookmarkService.getBookmarks).toHaveBeenCalledWith(USER_ID, { limit: 10, offset: 0 });
    expect(res.body.data).toEqual([]);
  });
});

describe('getBookmarkById', () => {
  test('param id kosong → 400 "Bookmark ID is required", tanpa memanggil service', async () => {
    const res = await call(controller.getBookmarkById, { user: { id: USER_ID }, params: {} });
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toBe('Bookmark ID is required');
    expect(bookmarkService.getBookmarkById).not.toHaveBeenCalled();
  });

  test('service null → 404', async () => {
    bookmarkService.getBookmarkById.mockResolvedValue(null);

    const res = await call(controller.getBookmarkById, { user: { id: USER_ID }, params: { id: '20000000-0000-4000-8000-000000000002' } });

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(bookmarkService.getBookmarkById).toHaveBeenCalledWith(USER_ID, '20000000-0000-4000-8000-000000000002');
  });

  test('ditemukan → 200 berisi {bookmark}', async () => {
    bookmarkService.getBookmarkById.mockResolvedValue({ id: BOOKMARK_ID, type: 'post', item_id: ITEM_ID_2, title: 'BMUD post', created_at: '2024-01-02T00:00:00.000Z' });

    const res = await call(controller.getBookmarkById, { user: { id: USER_ID }, params: { id: BOOKMARK_ID } });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ id: BOOKMARK_ID, type: 'post', item_id: ITEM_ID_2, title: 'BMUD post' });
  });
});
