// Unit test auth.service: mock prisma & bcrypt; jalankan via `npm test`.
const mockPrisma = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  $disconnect: jest.fn(),
};

jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => mockPrisma) }));
jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));

const bcrypt = require('bcrypt');
const authService = require('../auth.service');

beforeEach(() => {
  jest.resetAllMocks();
  process.env.JWT_SECRET = 'test-secret-ifishy';
});

describe('registerUser', () => {
  test('hash password lalu create, balik {id,username,email}', async () => {
    bcrypt.hash.mockResolvedValue('hashed-123');
    mockPrisma.user.create.mockResolvedValue({ id: 9, username: 'bayu', email: 'b@t.loc', password: 'hashed-123' });

    const user = await authService.registerUser({ username: 'bayu', email: 'b@t.loc', password: 'rahasia' });

    expect(bcrypt.hash).toHaveBeenCalledWith('rahasia', 10);
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: { username: 'bayu', email: 'b@t.loc', password: 'hashed-123' },
    });
    expect(user).toEqual({ id: 9, username: 'bayu', email: 'b@t.loc' });
  });
});

describe('loginUser', () => {
  test('email kosong/bukan string → "not_found" tanpa query', async () => {
    expect(await authService.loginUser({})).toBe('not_found');
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  test('email tidak terdaftar → "not_found"', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    expect(await authService.loginUser({ email: 'x@t.loc', password: 'p' })).toBe('not_found');
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'x@t.loc' } });
  });

  test('password salah → "invalid"', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 9, email: 'x@t.loc', password: 'hashed-123' });
    bcrypt.compare.mockResolvedValue(false);

    expect(await authService.loginUser({ email: 'x@t.loc', password: 'salah' })).toBe('invalid');
    expect(bcrypt.compare).toHaveBeenCalledWith('salah', 'hashed-123');
  });

  test('password cocok → token JWT berisi {id,email}', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 9, email: 'x@t.loc', password: 'hashed-123' });
    bcrypt.compare.mockResolvedValue(true);

    const { token } = await authService.loginUser({ email: 'x@t.loc', password: 'benar' });

    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    expect(payload.id).toBe(9);
    expect(payload.email).toBe('x@t.loc');
    expect(payload.exp - payload.iat).toBe(2 * 24 * 60 * 60);
  });
});
