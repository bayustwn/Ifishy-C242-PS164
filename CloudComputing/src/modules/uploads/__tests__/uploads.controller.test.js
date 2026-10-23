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
const controller = require('../uploads.controller');

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
});

describe('presignUpload', () => {
  test('R2 belum dikonfigurasi → 503', async () => {
    r2.isConfigured.mockReturnValue(false);

    const res = await call(controller.presignUpload, {
      user: { id: 9 },
      body: { purpose: 'post', contentType: 'image/png', size: 1024 },
    });

    expect(res.statusCode).toBe(503);
    expect(res.body.error.code).toBe('STORAGE_UNAVAILABLE');
    expect(r2.presignUpload).not.toHaveBeenCalled();
  });

  test('valid → 200 dengan key dan uploadUrl', async () => {
    r2.presignUpload.mockResolvedValue({
      key: 'posts/9/abc.jpg',
      uploadUrl: 'https://r2.example/posts/9/abc.jpg?X-Amz-Signature=x',
      expiresIn: 300,
      headers: { 'Content-Type': 'image/jpeg' },
    });

    const res = await call(controller.presignUpload, {
      user: { id: 9 },
      body: { purpose: 'post', contentType: 'image/jpeg', size: 1024 },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.key).toBe('posts/9/abc.jpg');
    expect(r2.presignUpload).toHaveBeenCalledWith({
      purpose: 'post', contentType: 'image/jpeg', size: 1024, userId: 9,
    });
  });

  test('purpose tidak dikenal → 400', async () => {
    const res = await call(controller.presignUpload, {
      user: { id: 9 },
      body: { purpose: 'lain', contentType: 'image/jpeg', size: 1024 },
    });
    expect(res.statusCode).toBe(400);
    expect(r2.presignUpload).not.toHaveBeenCalled();
  });

  test('contentType tidak diizinkan → 400', async () => {
    const res = await call(controller.presignUpload, {
      user: { id: 9 },
      body: { purpose: 'avatar', contentType: 'application/pdf', size: 1024 },
    });
    expect(res.statusCode).toBe(400);
    expect(r2.presignUpload).not.toHaveBeenCalled();
  });

  test('ukuran melebihi batas → 400', async () => {
    const res = await call(controller.presignUpload, {
      user: { id: 9 },
      body: { purpose: 'avatar', contentType: 'image/png', size: 6 * 1024 * 1024 },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('completeUpload', () => {
  test('valid → 200 setelah HEAD lolos', async () => {
    r2.verifyUpload.mockResolvedValue({
      purpose: 'scan', userId: 9, size: 2048, contentType: 'image/jpeg',
    });
    r2.resolveMediaUrl.mockResolvedValue('https://cdn.example/scans/9/x.jpg');

    const res = await call(controller.completeUpload, {
      user: { id: 9 },
      body: { key: 'scans/9/x.jpg' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual({
      key: 'scans/9/x.jpg',
      url: 'https://cdn.example/scans/9/x.jpg',
      contentType: 'image/jpeg',
      size: 2048,
    });
    expect(r2.verifyUpload).toHaveBeenCalledWith('scans/9/x.jpg');
  });

  test('key milik user lain → 403 tanpa HEAD', async () => {
    const res = await call(controller.completeUpload, {
      user: { id: 9 },
      body: { key: 'scans/8/x.jpg' },
    });
    expect(res.statusCode).toBe(403);
    expect(r2.verifyUpload).not.toHaveBeenCalled();
  });

  test('key tidak valid → 400', async () => {
    const res = await call(controller.completeUpload, {
      user: { id: 9 },
      body: { key: 'bukan-key' },
    });
    expect(res.statusCode).toBe(400);
  });

  test('object tidak ada → 404', async () => {
    r2.verifyUpload.mockRejectedValue(Object.assign(new Error('not found'), {
      name: 'NotFound', $metadata: { httpStatusCode: 404 },
    }));

    const res = await call(controller.completeUpload, {
      user: { id: 9 },
      body: { key: 'posts/9/x.jpg' },
    });

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('file di luar aturan → 400', async () => {
    r2.verifyUpload.mockRejectedValue(Object.assign(new Error('bad file'), { code: 'INVALID_UPLOAD' }));

    const res = await call(controller.completeUpload, {
      user: { id: 9 },
      body: { key: 'posts/9/x.jpg' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toBe('bad file');
  });
});

describe('deleteUpload', () => {
  test('valid → 200 dan delete dipanggil', async () => {
    const res = await call(controller.deleteUpload, {
      user: { id: 9 },
      body: { key: 'avatars/9/x.jpg' },
    });

    expect(res.statusCode).toBe(200);
    expect(r2.deleteObject).toHaveBeenCalledWith('avatars/9/x.jpg');
  });

  test('key milik user lain → 403 tanpa delete', async () => {
    const res = await call(controller.deleteUpload, {
      user: { id: 9 },
      body: { key: 'avatars/10/x.jpg' },
    });

    expect(res.statusCode).toBe(403);
    expect(r2.deleteObject).not.toHaveBeenCalled();
  });
});
