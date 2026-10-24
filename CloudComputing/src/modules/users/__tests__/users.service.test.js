// Unit test users.service: mock prisma & bcrypt; jalankan via `npm test`.
const mockPrisma = {
  user: {
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

const USER_ID = '40000000-0000-4000-8000-000000000005';
const PHOTO_USER_ID = '40000000-0000-4000-8000-000000000007';
const PHOTO_KEY = `avatars/${PHOTO_USER_ID}/a.jpg`;
const OLD_PHOTO_KEY = `avatars/${PHOTO_USER_ID}/old.jpg`;
const NEW_PHOTO_KEY = `avatars/${PHOTO_USER_ID}/new.jpg`;

beforeEach(() => {
  jest.resetAllMocks();
  r2.deleteUserObjects.mockResolvedValue(0);
});

describe('updateUser', () => {
  const current = { id: USER_ID, username: 'lama', email: 'lama@t.loc', password: 'hashed-lama' };

  test('user tidak ada → "not_found"', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    expect(await usersService.updateUser(999, {})).toBe('not_found');
  });

  test('tanpa newPassword → pakai nilai lama, update berjalan', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(current);
    mockPrisma.user.update.mockResolvedValue(current);

    const result = await usersService.updateUser(USER_ID, { username: 'baru' });

    expect(result).toBe('ok');
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { username: 'baru', email: 'lama@t.loc', password: 'hashed-lama' },
    });
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  test('newPassword + password lama salah → "incorrect_password" tanpa hash', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(current);
    bcrypt.compare.mockResolvedValue(false);

    const result = await usersService.updateUser(USER_ID, { password: 'salah', newPassword: 'baru' });

    expect(result).toBe('incorrect_password');
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  test('newPassword valid → hash lalu simpan', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(current);
    bcrypt.compare.mockResolvedValue(true);
    bcrypt.hash.mockResolvedValue('hashed-baru');

    await usersService.updateUser(USER_ID, { password: 'benar', newPassword: 'baru' });

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { username: 'lama', email: 'lama@t.loc', password: 'hashed-baru' },
    });
  });

  test('newPassword tanpa password lama → "incorrect_password"', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(current);
    bcrypt.compare.mockResolvedValue(false);

    expect(await usersService.updateUser(USER_ID, { newPassword: 'baru' })).toBe('incorrect_password');
  });

  test('username/email duplikat → "conflict"', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(current);
    mockPrisma.user.update.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 'P2002' }));

    expect(await usersService.updateUser(USER_ID, { username: 'dipakai' })).toBe('conflict');
  });
});

describe('deleteUserAccount', () => {
  test('row hilang → "not_found" tanpa cleanup storage; row ada → "ok" + cleanup', async () => {
    mockPrisma.user.deleteMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });

    expect(await usersService.deleteUserAccount(999)).toBe('not_found');
    expect(r2.deleteUserObjects).not.toHaveBeenCalled();

    expect(await usersService.deleteUserAccount(USER_ID)).toBe('ok');
    expect(mockPrisma.user.deleteMany).toHaveBeenCalledWith({ where: { id: USER_ID } });
    expect(r2.deleteUserObjects).toHaveBeenCalledWith(USER_ID);
  });

  test('cleanup storage gagal → tetap "ok"', async () => {
    mockPrisma.user.deleteMany.mockResolvedValue({ count: 1 });
    r2.deleteUserObjects.mockRejectedValue(new Error('r2 down'));

    expect(await usersService.deleteUserAccount(USER_ID)).toBe('ok');
  });
});

describe('replaceProfilePhoto', () => {
  test('user tidak ada → null tanpa update', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    expect(await usersService.replaceProfilePhoto(PHOTO_USER_ID, PHOTO_KEY)).toBeNull();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  test('user ada → simpan key baru dan kembalikan foto lama', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ profilePhoto: OLD_PHOTO_KEY });
    mockPrisma.user.update.mockResolvedValue({});

    expect(await usersService.replaceProfilePhoto(PHOTO_USER_ID, NEW_PHOTO_KEY)).toBe(OLD_PHOTO_KEY);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: PHOTO_USER_ID },
      data: { profilePhoto: NEW_PHOTO_KEY },
    });
  });
});

describe('getDashboardByEmail', () => {
  test('ditemukan → shape profile_photo snake_case', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: USER_ID, username: 'a', email: 'a@t.loc', profilePhoto: 'http://x/p.jpg',
    });

    const row = await usersService.getDashboardByEmail('a@t.loc');

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'a@t.loc' },
      select: { id: true, username: true, email: true, profilePhoto: true },
    });
    expect(row).toEqual({ id: USER_ID, username: 'a', email: 'a@t.loc', profile_photo: 'http://x/p.jpg' });
  });

  test('tidak ada → null', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    expect(await usersService.getDashboardByEmail('zz@t.loc')).toBeNull();
  });
});
