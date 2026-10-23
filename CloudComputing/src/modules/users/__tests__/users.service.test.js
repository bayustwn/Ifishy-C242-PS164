// Unit test users.service: mock prisma & bcrypt; jalankan via `npm test`.
const mockPrisma = {
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  $disconnect: jest.fn(),
};

jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => mockPrisma) }));
jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));
jest.mock('../../../shared/r2', () => {
  const actual = jest.requireActual('../../../shared/r2');
  return { ...actual, deleteUserObjects: jest.fn() };
});

const bcrypt = require('bcrypt');
const r2 = require('../../../shared/r2');
const usersService = require('../users.service');

beforeEach(() => {
  jest.resetAllMocks();
  r2.deleteUserObjects.mockResolvedValue(0);
});

describe('getAllUsers', () => {
  test('hanya kolom id, username, email', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 1, username: 'a', email: 'a@t.loc' }]);

    const users = await usersService.getAllUsers();

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({ select: { id: true, username: true, email: true } });
    expect(users[0]).toEqual({ id: 1, username: 'a', email: 'a@t.loc' });
  });
});

describe('updateUser', () => {
  const current = { id: 5, username: 'lama', email: 'lama@t.loc', password: 'hashed-lama' };

  test('user tidak ada → "not_found"', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    expect(await usersService.updateUser(999, {})).toBe('not_found');
  });

  test('tanpa newPassword → pakai nilai lama, update berjalan', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(current);
    mockPrisma.user.update.mockResolvedValue(current);

    const result = await usersService.updateUser(5, { username: 'baru' });

    expect(result).toBe('ok');
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { username: 'baru', email: 'lama@t.loc', password: 'hashed-lama' },
    });
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  test('newPassword + password lama salah → "incorrect_password" tanpa hash', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(current);
    bcrypt.compare.mockResolvedValue(false);

    const result = await usersService.updateUser(5, { password: 'salah', newPassword: 'baru' });

    expect(result).toBe('incorrect_password');
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  test('newPassword valid → hash lalu simpan', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(current);
    bcrypt.compare.mockResolvedValue(true);
    bcrypt.hash.mockResolvedValue('hashed-baru');

    await usersService.updateUser(5, { password: 'benar', newPassword: 'baru' });

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { username: 'lama', email: 'lama@t.loc', password: 'hashed-baru' },
    });
  });

  test('newPassword tanpa password lama → "incorrect_password"', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(current);
    bcrypt.compare.mockResolvedValue(false);

    expect(await usersService.updateUser(5, { newPassword: 'baru' })).toBe('incorrect_password');
  });
});

describe('deleteUserAccount', () => {
  test('row hilang → "not_found" tanpa cleanup storage; row ada → "ok" + cleanup', async () => {
    mockPrisma.user.deleteMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });

    expect(await usersService.deleteUserAccount(999)).toBe('not_found');
    expect(r2.deleteUserObjects).not.toHaveBeenCalled();

    expect(await usersService.deleteUserAccount(5)).toBe('ok');
    expect(mockPrisma.user.deleteMany).toHaveBeenCalledWith({ where: { id: 5 } });
    expect(r2.deleteUserObjects).toHaveBeenCalledWith(5);
  });

  test('cleanup storage gagal → tetap "ok"', async () => {
    mockPrisma.user.deleteMany.mockResolvedValue({ count: 1 });
    r2.deleteUserObjects.mockRejectedValue(new Error('r2 down'));

    expect(await usersService.deleteUserAccount(5)).toBe('ok');
  });
});

describe('replaceProfilePhoto', () => {
  test('user tidak ada → null tanpa update', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    expect(await usersService.replaceProfilePhoto(7, 'avatars/7/a.jpg')).toBeNull();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  test('user ada → simpan key baru dan kembalikan foto lama', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ profilePhoto: 'avatars/7/old.jpg' });
    mockPrisma.user.update.mockResolvedValue({});

    expect(await usersService.replaceProfilePhoto(7, 'avatars/7/new.jpg')).toBe('avatars/7/old.jpg');
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { profilePhoto: 'avatars/7/new.jpg' },
    });
  });
});

describe('getDashboardByEmail', () => {
  test('ditemukan → shape profile_photo snake_case', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 5, username: 'a', email: 'a@t.loc', profilePhoto: 'http://x/p.jpg',
    });

    const row = await usersService.getDashboardByEmail('a@t.loc');

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'a@t.loc' },
      select: { id: true, username: true, email: true, profilePhoto: true },
    });
    expect(row).toEqual({ id: 5, username: 'a', email: 'a@t.loc', profile_photo: 'http://x/p.jpg' });
  });

  test('tidak ada → null', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    expect(await usersService.getDashboardByEmail('zz@t.loc')).toBeNull();
  });
});
