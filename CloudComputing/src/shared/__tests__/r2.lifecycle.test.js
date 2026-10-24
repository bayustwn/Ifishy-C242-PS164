const mockSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  class Command {
    constructor(input) {
      this.input = input;
    }
  }
  return {
    S3Client: jest.fn(() => ({ send: mockSend })),
    PutObjectCommand: Command,
    GetObjectCommand: Command,
    HeadObjectCommand: Command,
    DeleteObjectCommand: Command,
    DeleteObjectsCommand: Command,
    ListObjectsV2Command: Command,
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn() }));

process.env.R2_ACCOUNT_ID = 'test-account';
process.env.R2_ACCESS_KEY_ID = 'test-key';
process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
process.env.R2_BUCKET_PUBLIC = 'test-bucket';
process.env.R2_PUBLIC_BASE_URL = 'https://media.example.com';

const r2 = require('../r2');

const USER_ID = '00000000-0000-4000-8000-000000000009';
const key = `scans/${USER_ID}/abc.jpg`;

beforeEach(() => {
  mockSend.mockReset();
  mockSend.mockResolvedValue({});
});

describe('verifyUpload lifecycle', () => {
  test('objek valid → metadata tanpa delete', async () => {
    mockSend
      .mockResolvedValueOnce({ ContentLength: 4, ContentType: 'image/jpeg' })
      .mockResolvedValueOnce({ Body: { transformToByteArray: async () => Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]) } });

    const result = await r2.verifyUpload(key);

    expect(result).toEqual({ purpose: 'scan', userId: USER_ID, filename: 'abc', ext: 'jpg', size: 4, contentType: 'image/jpeg' });
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  test('ukuran melebihi batas → INVALID_UPLOAD dan objek dihapus', async () => {
    mockSend.mockResolvedValueOnce({ ContentLength: 16 * 1024 * 1024, ContentType: 'image/jpeg' });

    await expect(r2.verifyUpload(key)).rejects.toMatchObject({ code: 'INVALID_UPLOAD' });
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend.mock.calls[1][0].input).toEqual({ Bucket: 'test-bucket', Key: key });
  });

  test('magic bytes tidak cocok → INVALID_UPLOAD dan objek dihapus', async () => {
    mockSend
      .mockResolvedValueOnce({ ContentLength: 4, ContentType: 'image/jpeg' })
      .mockResolvedValueOnce({ Body: { transformToByteArray: async () => Buffer.from('<html>') } });

    await expect(r2.verifyUpload(key)).rejects.toMatchObject({ code: 'INVALID_UPLOAD' });
    expect(mockSend).toHaveBeenCalledTimes(3);
    expect(mockSend.mock.calls[2][0].input).toEqual({ Bucket: 'test-bucket', Key: key });
  });
});

describe('deleteKeys', () => {
  test('memecah lebih dari 1000 key menjadi batch', async () => {
    const keys = Array.from({ length: 1001 }, (_, index) => `posts/${USER_ID}/${index}.jpg`);

    const deleted = await r2.deleteKeys(keys);

    expect(deleted).toBe(1001);
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend.mock.calls[0][0].input.Delete.Objects).toHaveLength(1000);
    expect(mockSend.mock.calls[1][0].input.Delete.Objects).toHaveLength(1);
  });
});

describe('deleteUserObjects', () => {
  test('userId tidak valid → 0 tanpa request', async () => {
    expect(await r2.deleteUserObjects('abc')).toBe(0);
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('menghapus ketiga prefix milik user', async () => {
    mockSend.mockImplementation(async (command) => {
      if (command.input.Prefix) {
        return { Contents: [{ Key: `${command.input.Prefix}a.jpg` }], IsTruncated: false };
      }
      return {};
    });

    const deleted = await r2.deleteUserObjects(USER_ID);

    expect(deleted).toBe(3);
    expect(mockSend).toHaveBeenCalledTimes(6);
  });
});
