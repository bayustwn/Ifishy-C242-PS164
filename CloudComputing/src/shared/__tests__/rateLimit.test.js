jest.mock('../redis', () => null);

const { limit } = require('../rateLimit');

const run = (limiter, res, next = jest.fn()) => {
  limit(limiter, 'Too many')({ ip: '1.1.1.1' }, res, next);
  return new Promise((resolve) => setImmediate(resolve));
};

const fakeRes = () => {
  const res = { statusCode: null, body: null };
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

describe('limit middleware', () => {
  test('consume sukses → next()', async () => {
    const limiter = { consume: jest.fn().mockResolvedValue({ remainingPoints: 9 }) };
    const next = jest.fn();
    await run(limiter, fakeRes(), next);

    expect(limiter.consume).toHaveBeenCalledWith('1.1.1.1');
    expect(next).toHaveBeenCalled();
  });

  test('consume gagal → 429 TOO_MANY_REQUESTS', async () => {
    const limiter = { consume: jest.fn().mockRejectedValue(new Error('blocked')) };
    const next = jest.fn();
    const res = fakeRes();
    await run(limiter, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(res.body.error.message).toBe('Too many');
  });
});
