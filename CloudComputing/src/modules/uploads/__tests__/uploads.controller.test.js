jest.mock('../uploads.service', () => ({ findUsage: jest.fn() }));

jest.mock('../../../shared/r2', () => {
  const actual = jest.requireActual('../../../shared/r2');
  return {
    ...actual,
    isConfigured: jest.fn(),
    presignUpload: jest.fn(),
    verifyUpload: jest.fn(),
    deleteObject: jest.fn(),
    resolveMediaUrl: jest.fn(),
  };
});

const r2 = require('../../../shared/r2');
const uploadsService = require('../uploads.service');
const controller = require('../uploads.controller');

const USER_ID = '50000000-0000-4000-8000-000000000009';
const OTHER_USER_ID = '50000000-0000-4000-8000-000000000008';
const THIRD_USER_ID = '50000000-0000-4000-8000-000000000010';
const POST_KEY = `posts/${USER_ID}/abc.jpg`;
const SCAN_KEY = `scans/${USER_ID}/x.jpg`;

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
  r2.isConfigured.mockReturnValue(true);
  uploadsService.findUsage.mockResolvedValue(null);
});

describe('presignUpload', () => {
  test('R2 belum dikonfigurasi → 503', async () => {
    r2.isConfigured.mockReturnValue(false);

    const res = await call(controller.presignUpload, {
      user: { id: USER_ID },
      body: { purpose: 'post', contentType: 'image/png', size: 1024 },
    });

    expect(res.statusCode).toBe(503);
    expect(res.body.error.code).toBe('STORAGE_UNAVAILABLE');
    expect(r2.presignUpload).not.toHaveBeenCalled();
  });

  test('valid → 200 dengan key dan uploadUrl', async () => {
    r2.presignUpload.mockResolvedValue({
      key: POST_KEY,
      uploadUrl: `https://r2.example/${POST_KEY}?X-Amz-Signature=x`,
      expiresIn: 300,
      headers: { 'Content-Type': 'image/jpeg' },
    });

    const res = await call(controller.presignUpload, {
      user: { id: USER_ID },
      body: { purpose: 'post', contentType: 'image/jpeg', size: 1024 },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.key).toBe(POST_KEY);
    expect(r2.presignUpload).toHaveBeenCalledWith({
      purpose: 'post', contentType: 'image/jpeg', size: 1024, userId: USER_ID,
    });
  });

  test('purpose tidak dikenal → 400', async () => {
    const res = await call(controller.presignUpload, {
      user: { id: USER_ID },
      body: { purpose: 'lain', contentType: 'image/jpeg', size: 1024 },
    });
    expect(res.statusCode).toBe(400);
    expect(r2.presignUpload).not.toHaveBeenCalled();
  });

  test('contentType tidak diizinkan → 400', async () => {
    const res = await call(controller.presignUpload, {
      user: { id: USER_ID },
      body: { purpose: 'avatar', contentType: 'application/pdf', size: 1024 },
    });
    expect(res.statusCode).toBe(400);
    expect(r2.presignUpload).not.toHaveBeenCalled();
  });

  test('ukuran melebihi batas → 400', async () => {
    const res = await call(controller.presignUpload, {
      user: { id: USER_ID },
      body: { purpose: 'avatar', contentType: 'image/png', size: 6 * 1024 * 1024 },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('completeUpload', () => {
  test('valid → 200 setelah HEAD lolos', async () => {
    r2.verifyUpload.mockResolvedValue({
      purpose: 'scan', userId: USER_ID, size: 2048, contentType: 'image/jpeg',
    });
    r2.resolveMediaUrl.mockResolvedValue(`https://cdn.example/${SCAN_KEY}`);

    const res = await call(controller.completeUpload, {
      user: { id: USER_ID },
      body: { key: SCAN_KEY },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual({
      key: SCAN_KEY,
      url: `https://cdn.example/${SCAN_KEY}`,
      contentType: 'image/jpeg',
      size: 2048,
    });
    expect(r2.verifyUpload).toHaveBeenCalledWith(SCAN_KEY);
  });

  test('key milik user lain → 403 tanpa HEAD', async () => {
    const res = await call(controller.completeUpload, {
      user: { id: USER_ID },
      body: { key: `scans/${OTHER_USER_ID}/x.jpg` },
    });
    expect(res.statusCode).toBe(403);
    expect(r2.verifyUpload).not.toHaveBeenCalled();
  });

  test('key tidak valid → 400', async () => {
    const res = await call(controller.completeUpload, {
      user: { id: USER_ID },
      body: { key: 'bukan-key' },
    });
    expect(res.statusCode).toBe(400);
  });

  test('object tidak ada → 404', async () => {
    r2.verifyUpload.mockRejectedValue(Object.assign(new Error('not found'), {
      name: 'NotFound', $metadata: { httpStatusCode: 404 },
    }));

    const res = await call(controller.completeUpload, {
      user: { id: USER_ID },
      body: { key: `posts/${USER_ID}/x.jpg` },
    });

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('file di luar aturan → 400', async () => {
    r2.verifyUpload.mockRejectedValue(Object.assign(new Error('bad file'), { code: 'INVALID_UPLOAD' }));

    const res = await call(controller.completeUpload, {
      user: { id: USER_ID },
      body: { key: `posts/${USER_ID}/x.jpg` },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toBe('bad file');
  });
});

describe('deleteUpload', () => {
  test('valid → 200 dan delete dipanggil', async () => {
    const res = await call(controller.deleteUpload, {
      user: { id: USER_ID },
      body: { key: `avatars/${USER_ID}/x.jpg` },
    });

    expect(res.statusCode).toBe(200);
    expect(r2.deleteObject).toHaveBeenCalledWith(`avatars/${USER_ID}/x.jpg`);
  });

  test('key milik user lain → 403 tanpa delete', async () => {
    const res = await call(controller.deleteUpload, {
      user: { id: USER_ID },
      body: { key: `avatars/${THIRD_USER_ID}/x.jpg` },
    });

    expect(res.statusCode).toBe(403);
    expect(r2.deleteObject).not.toHaveBeenCalled();
  });

  test('key masih dipakai → 409 tanpa delete', async () => {
    uploadsService.findUsage.mockResolvedValue('post');

    const res = await call(controller.deleteUpload, {
      user: { id: USER_ID },
      body: { key: `posts/${USER_ID}/x.jpg` },
    });

    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(r2.deleteObject).not.toHaveBeenCalled();
  });
});
