// Unit test auth.controller: mock service; jalankan via `npm test`.
jest.mock('../auth.service', () => ({
  signJwt: jest.fn(),
  registerUser: jest.fn(),
  loginUser: jest.fn(),
}));

const authService = require('../auth.service');
const controller = require('../auth.controller');

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

describe('registerUser', () => {
  test('field kosong → 400 pesan required', async () => {
    const res = await call(controller.registerUser, { body: { username: 'bayu', password: 'password1', confirmPassword: 'password1' } });
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toBe('Username, email, password, and confirm password are required.');
    expect(authService.registerUser).not.toHaveBeenCalled();
  });

  test('confirmPassword beda → 400 "Passwords do not match"', async () => {
    const res = await call(controller.registerUser, {
      body: { username: 'bayu', email: 'x@t.loc', password: 'password1', confirmPassword: 'beda1234' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toBe('Passwords do not match');
  });

  test('sukses → 201 {user}', async () => {
    authService.registerUser.mockResolvedValue({ id: 9, username: 'b', email: 'x@t.loc' });

    const res = await call(controller.registerUser, {
      body: { username: 'bayu', email: 'x@t.loc', password: 'password1', confirmPassword: 'password1' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe('User successfully registered!');
    expect(res.body.data).toEqual({ id: 9, username: 'b', email: 'x@t.loc' });
  });

  test('db error (mis. email duplikat) → 500 "Failed to create user"', async () => {
    authService.registerUser.mockRejectedValue(new Error('P2002 duplicate'));

    const res = await call(controller.registerUser, {
      body: { username: 'bayu', email: 'x@t.loc', password: 'password1', confirmPassword: 'password1' },
    });

    expect(res.statusCode).toBe(500);
    expect(res.body.error.message).toBe('Failed to create user');
  });
});

describe('loginUser', () => {
  test('service "not_found" → 401 generic (anti-enumeration)', async () => {
    authService.loginUser.mockResolvedValue('not_found');
    const res = await call(controller.loginUser, { body: { email: 'x@t.loc', password: 'password1' } });
    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.error.message).toBe('Invalid credentials');
  });

  test('service "invalid" → 401', async () => {
    authService.loginUser.mockResolvedValue('invalid');
    const res = await call(controller.loginUser, { body: { email: 'x@t.loc', password: 'salah' } });
    expect(res.statusCode).toBe(401);
    expect(res.body.error.message).toBe('Invalid credentials');
  });

  test('sukses → 200 dengan token', async () => {
    authService.loginUser.mockResolvedValue({ token: 'jwt-token' });
    const res = await call(controller.loginUser, { body: { email: 'x@t.loc', password: 'password1' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.token).toBe('jwt-token');
    expect(res.body.message).toBe('Login successful');
  });

  test('service error (mis. JWT_SECRET hilang) → 500 "Failed to login"', async () => {
    authService.loginUser.mockRejectedValue(new Error('JWT_SECRET is missing'));
    const res = await call(controller.loginUser, { body: { email: 'x@t.loc', password: 'password1' } });
    expect(res.statusCode).toBe(500);
    expect(res.body.error.message).toBe('Failed to login');
  });
});

describe('logoutUser', () => {
  test('200 "Logout successful"', async () => {
    const res = await call(controller.logoutUser, {});
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Logout successful');
  });
});
