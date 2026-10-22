// Unit test middleware authenticateToken (jose): jalankan via `npm test`.
const { SignJWT } = require('jose');

const encoder = new TextEncoder();
const SECRET = 'test-secret-ifishy';

const { authenticateToken } = require('../auth');

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

const sign = async (expired) => {
  const b = new SignJWT({ id: 1, email: 'x@t.loc' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt();
  if (expired) b.setExpirationTime(Math.floor(Date.now() / 1000) - 10);
  else b.setExpirationTime('2d');
  return b.sign(encoder.encode(SECRET));
};

const run = (header) => {
  const req = { header: (h) => (h === 'Authorization' ? header : undefined) };
  const res = fakeRes();
  const next = jest.fn();
  return Promise.resolve(authenticateToken(req, res, next)).then(() => ({ res, next }));
};

beforeAll(() => {
  process.env.JWT_SECRET = SECRET;
});

describe('authenticateToken', () => {
  test('token hilang / format salah → 401', async () => {
    const { res, next } = await run(undefined);
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Access denied, token missing or invalid');
    expect(next).not.toHaveBeenCalled();

    const r2 = await run('Basic abc');
    expect(r2.res.statusCode).toBe(401);
  });

  test('token valid → req.user terisi, next() dipanggil', async () => {
    const token = await sign(false);
    const { res, next } = await run(`Bearer ${token}`);
    expect(res.statusCode).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  test('token expired → 401 pesan expired', async () => {
    const token = await sign(true);
    const { res, next } = await run(`Bearer ${token}`);
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Token expired, please login again');
    expect(next).not.toHaveBeenCalled();
  });

  test('token tanda tangan salah → 401 pesan invalid', async () => {
    const token = await sign(false);
    const { res } = await run(`Bearer ${token.slice(0, -2)}xx`);
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid token, please login again');
  });
});
