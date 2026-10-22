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

const bcrypt = require('bcrypt');
const usersService = require('../users.service');

beforeEach(() => jest.resetAllMocks());

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
  test('row hilang → "not_found"; row ada → "ok"', async () => {
    mockPrisma.user.deleteMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });

    expect(await usersService.deleteUserAccount(999)).toBe('not_found');
    expect(await usersService.deleteUserAccount(5)).toBe('ok');
    expect(mockPrisma.user.deleteMany).toHaveBeenCalledWith({ where: { id: 5 } });
  });
});

describe('setProfilePhotoByUserId', () => {
  test('userId valid → updateMany profilePhoto', async () => {
    await usersService.setProfilePhotoByUserId(7, 'http://x/p.jpg');
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({ where: { id: 7 }, data: { profilePhoto: 'http://x/p.jpg' } });
  });

  test('userId tidak ada → tetap 200-able (sentinel -1, tanpa throw)', async () => {
    await usersService.setProfilePhotoByUserId(undefined, 'http://x/p.jpg');
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({ where: { id: -1 }, data: { profilePhoto: 'http://x/p.jpg' } });
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
