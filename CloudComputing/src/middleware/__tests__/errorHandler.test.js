const { notFound, errorHandler } = require('../errorHandler');

const makeRes = () => {
  const res = { statusCode: null, body: null, headersSent: false };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

const req = { method: 'GET', originalUrl: '/api/nope' };

describe('errorHandler', () => {
  test('notFound → 404 JSON berisi method dan url', () => {
    const res = makeRes();
    notFound(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found: GET /api/nope' } });
  });

  test('JSON rusak → 400 Invalid JSON payload', () => {
    const res = makeRes();
    const err = Object.assign(new Error('bad json'), { type: 'entity.parse.failed' });
    errorHandler(err, req, res, jest.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON payload' } });
  });

  test('MulterError → 400 dengan pesan error', () => {
    const res = makeRes();
    const err = Object.assign(new Error('File too large'), { name: 'MulterError' });
    errorHandler(err, req, res, jest.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, error: { code: 'UPLOAD_ERROR', message: 'File too large' } });
  });

  test('error dengan status < 500 → pesan asli', () => {
    const res = makeRes();
    const err = Object.assign(new Error('Forbidden'), { status: 403 });
    errorHandler(err, req, res, jest.fn());
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } });
  });

  test('error tak dikenal → 500 generik', () => {
    const res = makeRes();
    errorHandler(new Error('secret internals'), req, res, jest.fn());
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  });

  test('headers sudah terkirim → diteruskan ke next', () => {
    const res = makeRes();
    res.headersSent = true;
    const next = jest.fn();
    errorHandler(new Error('late'), req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
