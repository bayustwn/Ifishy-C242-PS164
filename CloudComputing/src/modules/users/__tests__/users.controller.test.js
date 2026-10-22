// Unit test users.controller: mock service; token di-sign asli via jose.
jest.mock('../users.service', () => ({
  getAllUsers: jest.fn(),
  updateUser: jest.fn(),
  deleteUserAccount: jest.fn(),
  setProfilePhotoByUserId: jest.fn(),
  getDashboardByEmail: jest.fn(),
  getProfileByEmail: jest.fn(),
}));

jest.mock('../../../shared/storage', () => ({
  saveFileToDisk: jest.fn().mockResolvedValue('http://h/uploads/photo-profile-user/p.jpg'),
  profileFolder: 'photo-profile-user',
  postFolder: 'image-post',
  scanHistoryFolder: 'scan-history',
}));

const { SignJWT } = require('jose');
const usersService = require('../users.service');
const controller = require('../users.controller');

const encoder = new TextEncoder();
const SECRET = 'test-secret-ifishy';

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

const tokenFor = async (id) =>
  new SignJWT({ id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2d')
    .sign(encoder.encode(SECRET));

beforeAll(() => {
  process.env.JWT_SECRET = SECRET;
});
beforeEach(() => jest.resetAllMocks());

describe('updateUser', () => {
  test('token tidak ada → 401 "Token is required"', async () => {
    const res = await call(controller.updateUser, { headers: {}, body: {} });
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Token is required');
    expect(usersService.updateUser).not.toHaveBeenCalled();
  });

  test('token invalid → 500 (perilaku lama: verify throw masuk catch)', async () => {
    const res = await call(controller.updateUser, { headers: { authorization: 'Bearer hacker' }, body: {} });
    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe('Failed to update user profile');
  });

  test('sukses → 200 "User profile updated successfully"', async () => {
    const token = await tokenFor(5);
    usersService.updateUser.mockResolvedValue('ok');

    const res = await call(controller.updateUser, {
      headers: { authorization: `Bearer ${token}` },
      body: { username: 'baru' },
    });

    expect(res.statusCode).toBe(200);
    expect(usersService.updateUser).toHaveBeenCalledWith(5, { username: 'baru' });
  });

  test('password lama salah → 400 "Incorrect password"', async () => {
    const token = await tokenFor(5);
    usersService.updateUser.mockResolvedValue('incorrect_password');

    const res = await call(controller.updateUser, {
      headers: { authorization: `Bearer ${token}` },
      body: { password: 'salah', newPassword: 'x' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Incorrect password');
  });
});

describe('deleteUserAccount', () => {
  test('sukses → 200; tidak ada → 404', async () => {
    const token = await tokenFor(5);

    usersService.deleteUserAccount.mockResolvedValueOnce('ok');
    let res = await call(controller.deleteUserAccount, { headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('User account deleted successfully');

    usersService.deleteUserAccount.mockReset();
    usersService.deleteUserAccount.mockResolvedValueOnce('not_found');
    res = await call(controller.deleteUserAccount, { headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(404);
  });
});

describe('uploadProfilePhoto', () => {
  test('file tidak ada → 400 "No file uploaded"', async () => {
    const res = await call(controller.uploadProfilePhoto, { body: { userId: '1' } });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('No file uploaded');
  });

  test('file + userId → 200 photoUrl', async () => {
    const { saveFileToDisk } = require('../../../shared/storage');
    saveFileToDisk.mockResolvedValue('http://h/uploads/photo-profile-user/p.jpg');
    usersService.setProfilePhotoByUserId.mockResolvedValue();

    const res = await call(controller.uploadProfilePhoto, {
      file: { originalname: 'p.jpg', buffer: Buffer.from('x') },
      protocol: 'http',
      get: () => 'h',
      body: { userId: '7' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.photoUrl).toBe('http://h/uploads/photo-profile-user/p.jpg');
    expect(usersService.setProfilePhotoByUserId).toHaveBeenCalledWith(7, 'http://h/uploads/photo-profile-user/p.jpg');
  });
});

describe('getDashboardData / getUserProfile', () => {
  test('email tidak dikenal → 404 "User not found"', async () => {
    usersService.getDashboardByEmail.mockResolvedValue(null);

    const res = await call(controller.getDashboardData, { params: { email: 'zz@t.loc' } });

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe('User not found');
  });

  test('ditemukan → 200 shape snake_case', async () => {
    usersService.getProfileByEmail.mockResolvedValue({ id: 5, username: 'a', email: 'a@t.loc', profile_photo: 'p.jpg' });

    const res = await call(controller.getUserProfile, { params: { email: 'a@t.loc' } });

    expect(res.statusCode).toBe(200);
    expect(res.body.profile).toEqual({ id: 5, username: 'a', email: 'a@t.loc', profile_photo: 'p.jpg' });
  });
});
