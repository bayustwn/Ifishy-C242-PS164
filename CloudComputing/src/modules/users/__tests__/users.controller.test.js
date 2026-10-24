// Unit test users.controller: auth middleware diuji terpisah; controller memakai req.user.
jest.mock('../users.service', () => ({
  updateUser: jest.fn(),
  deleteUserAccount: jest.fn(),
  replaceProfilePhoto: jest.fn(),
  getDashboardByEmail: jest.fn(),
  getProfileByEmail: jest.fn(),
}));

jest.mock('../../../shared/r2', () => {
  const actual = jest.requireActual('../../../shared/r2');
  return { ...actual, verifyUpload: jest.fn(), deleteOwned: jest.fn() };
});

const r2 = require('../../../shared/r2');
const usersService = require('../users.service');
const controller = require('../users.controller');

const USER_ID = '40000000-0000-4000-8000-000000000005';
const PHOTO_USER_ID = '40000000-0000-4000-8000-000000000007';
const OTHER_USER_ID = '40000000-0000-4000-8000-000000000008';
const PHOTO_KEY = `avatars/${PHOTO_USER_ID}/p.jpg`;
const OLD_PHOTO_KEY = `avatars/${PHOTO_USER_ID}/old.jpg`;

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
  r2.verifyUpload.mockResolvedValue({});
  r2.deleteOwned.mockResolvedValue(true);
});

describe('updateUser', () => {
  test('body tidak valid → 400 tanpa update', async () => {
    const res = await call(controller.updateUser, { user: { id: USER_ID }, body: { email: 'bukan-email' } });
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(usersService.updateUser).not.toHaveBeenCalled();
  });

  test('sukses → 200 "User profile updated successfully"', async () => {
    usersService.updateUser.mockResolvedValue('ok');

    const res = await call(controller.updateUser, {
      user: { id: USER_ID },
      body: { username: 'baru' },
    });

    expect(res.statusCode).toBe(200);
    expect(usersService.updateUser).toHaveBeenCalledWith(USER_ID, { username: 'baru' });
  });

  test('password lama salah → 400 "Incorrect password"', async () => {
    usersService.updateUser.mockResolvedValue('incorrect_password');

    const res = await call(controller.updateUser, {
      user: { id: USER_ID },
      body: { password: 'salah', newPassword: 'baru123' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toBe('Incorrect password');
  });

  test('username/email bentrok → 409', async () => {
    usersService.updateUser.mockResolvedValue('conflict');

    const res = await call(controller.updateUser, {
      user: { id: USER_ID },
      body: { username: 'dipakai' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  test('newPassword kurang dari 6 karakter → 400', async () => {
    const res = await call(controller.updateUser, {
      user: { id: USER_ID },
      body: { password: 'lama', newPassword: '123' },
    });

    expect(res.statusCode).toBe(400);
    expect(usersService.updateUser).not.toHaveBeenCalled();
  });
});

describe('deleteUserAccount', () => {
  test('sukses → 200; tidak ada → 404', async () => {
    usersService.deleteUserAccount.mockResolvedValueOnce('ok');
    let res = await call(controller.deleteUserAccount, { user: { id: USER_ID } });
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('User account deleted successfully');

    usersService.deleteUserAccount.mockReset();
    usersService.deleteUserAccount.mockResolvedValueOnce('not_found');
    res = await call(controller.deleteUserAccount, { user: { id: USER_ID } });
    expect(res.statusCode).toBe(404);
  });
});

describe('uploadProfilePhoto', () => {
  test('imageKey tidak ada → 400', async () => {
    const res = await call(controller.uploadProfilePhoto, { user: { id: PHOTO_USER_ID }, body: { userId: '1' } });
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toBe('imageKey is required');
  });

  test('imageKey milik user lain → 400 tanpa update DB', async () => {
    const res = await call(controller.uploadProfilePhoto, { user: { id: PHOTO_USER_ID }, body: { imageKey: `avatars/${OTHER_USER_ID}/p.jpg` } });
    expect(res.statusCode).toBe(400);
    expect(usersService.replaceProfilePhoto).not.toHaveBeenCalled();
  });

  test('objek upload tidak ada → 400 tanpa update DB', async () => {
    r2.verifyUpload.mockRejectedValue(new Error('not found'));

    const res = await call(controller.uploadProfilePhoto, {
      user: { id: PHOTO_USER_ID },
      body: { imageKey: PHOTO_KEY },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toBe('Upload not found or invalid');
    expect(usersService.replaceProfilePhoto).not.toHaveBeenCalled();
  });

  test('imageKey valid → 200 photoUrl', async () => {
    usersService.replaceProfilePhoto.mockResolvedValue(null);

    const res = await call(controller.uploadProfilePhoto, {
      user: { id: PHOTO_USER_ID },
      body: { imageKey: PHOTO_KEY },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.photoUrl).toBe(PHOTO_KEY);
    expect(usersService.replaceProfilePhoto).toHaveBeenCalledWith(PHOTO_USER_ID, PHOTO_KEY);
  });

  test('foto lama R2 dihapus setelah ganti', async () => {
    usersService.replaceProfilePhoto.mockResolvedValue(OLD_PHOTO_KEY);

    const res = await call(controller.uploadProfilePhoto, {
      user: { id: PHOTO_USER_ID },
      body: { imageKey: PHOTO_KEY },
    });

    expect(res.statusCode).toBe(200);
    expect(r2.deleteOwned).toHaveBeenCalledWith(OLD_PHOTO_KEY, 'avatar', PHOTO_USER_ID);
  });
});

describe('getDashboardData / getUserProfile', () => {
  test('email tidak dikenal → 404 "User not found"', async () => {
    usersService.getDashboardByEmail.mockResolvedValue(null);

    const res = await call(controller.getDashboardData, { params: { email: 'zz@t.loc' } });

    expect(res.statusCode).toBe(404);
    expect(res.body.error.message).toBe('User not found');
  });

  test('ditemukan → 200 shape snake_case', async () => {
    usersService.getProfileByEmail.mockResolvedValue({ id: USER_ID, username: 'a', email: 'a@t.loc', profile_photo: 'p.jpg' });

    const res = await call(controller.getUserProfile, { params: { email: 'a@t.loc' } });

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual({ id: USER_ID, username: 'a', email: 'a@t.loc', profile_photo: 'p.jpg' });
  });
});
