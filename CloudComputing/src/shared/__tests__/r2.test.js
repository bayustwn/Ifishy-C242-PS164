jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async (_client, command) => `https://signed.example/${command.input.Bucket}/${command.input.Key}`),
}));

const r2 = require('../r2');

const USER_ID = '00000000-0000-4000-8000-000000000009';
const OTHER_ID = '00000000-0000-4000-8000-000000000010';

describe('r2 key helpers', () => {
  test('buildKey memakai prefix purpose, userId, dan ekstensi dari contentType', () => {
    const key = r2.buildKey('post', USER_ID, 'image/jpeg');
    expect(key).toMatch(/^posts\/00000000-0000-4000-8000-000000000009\/[0-9a-f-]{36}\.jpg$/);
  });

  test('buildKey menolak contentType yang tidak didukung', () => {
    expect(() => r2.buildKey('post', USER_ID, 'application/pdf')).toThrow('Unsupported upload type');
  });

  test('parseKey memetakan purpose dan userId', () => {
    expect(r2.parseKey('scans/00000000-0000-4000-8000-000000000009/abc.jpg')).toEqual({
      purpose: 'scan', userId: USER_ID, filename: 'abc', ext: 'jpg',
    });
  });

  test('parseKey menolak key dengan path traversal atau format asing', () => {
    expect(r2.parseKey('../etc/passwd')).toBeNull();
    expect(r2.parseKey('scans/00000000-0000-4000-8000-000000000009/../x.jpg')).toBeNull();
    expect(r2.parseKey('scans/00000000-0000-4000-8000-000000000009/x.jpg?x=1')).toBeNull();
  });

  test('isOwnedKey hanya cocok untuk purpose dan userId yang sama', () => {
    expect(r2.isOwnedKey('posts/00000000-0000-4000-8000-000000000009/a.png', 'post', USER_ID)).toBe(true);
    expect(r2.isOwnedKey('posts/00000000-0000-4000-8000-000000000009/a.png', 'post', OTHER_ID)).toBe(false);
    expect(r2.isOwnedKey('posts/00000000-0000-4000-8000-000000000009/a.png', 'avatars', USER_ID)).toBe(false);
    expect(r2.isOwnedKey(null, 'post', USER_ID)).toBe(false);
  });

  test('publicUrl meneruskan URL lama dan menyusun URL dari key', () => {
    const original = process.env.R2_PUBLIC_BASE_URL;
    delete process.env.R2_PUBLIC_BASE_URL;
    expect(r2.publicUrl('http://localhost:9080/uploads/a.png')).toBe('http://localhost:9080/uploads/a.png');
    expect(r2.publicUrl('posts/00000000-0000-4000-8000-000000000009/a.png')).toBe(`posts/${USER_ID}/a.png`);

    process.env.R2_PUBLIC_BASE_URL = 'https://media.example.com/';
    expect(r2.publicUrl('posts/00000000-0000-4000-8000-000000000009/a.png')).toBe('https://media.example.com/posts/00000000-0000-4000-8000-000000000009/a.png');

    if (original === undefined) delete process.env.R2_PUBLIC_BASE_URL;
    else process.env.R2_PUBLIC_BASE_URL = original;
  });

  test('hasValidSignature mengenali magic bytes JPEG, PNG, dan WebP', () => {
    expect(r2.hasValidSignature(Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), 'image/jpeg')).toBe(true);
    expect(r2.hasValidSignature(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), 'image/png')).toBe(true);

    const webp = Buffer.from('RIFF0000WEBP', 'latin1');
    expect(r2.hasValidSignature(webp, 'image/webp')).toBe(true);
  });

  test('hasValidSignature menolak isi yang tidak cocok', () => {
    expect(r2.hasValidSignature(Buffer.from('<html>'), 'image/png')).toBe(false);
    expect(r2.hasValidSignature(Buffer.from([0xFF, 0xD8, 0xFF]), 'image/png')).toBe(false);
    expect(r2.hasValidSignature(Buffer.from('RIFF0000NOPE', 'latin1'), 'image/webp')).toBe(false);
    expect(r2.hasValidSignature(Buffer.from([0x89, 0x50]), 'image/jpeg')).toBe(false);
  });

  test('resolveMediaUrl memakai URL publik untuk avatar/post dan fallback scan', async () => {
    const original = process.env.R2_PUBLIC_BASE_URL;
    const originalPrivate = process.env.R2_BUCKET_PRIVATE;
    process.env.R2_PUBLIC_BASE_URL = 'https://media.example.com';
    delete process.env.R2_BUCKET_PRIVATE;
    await expect(r2.resolveMediaUrl('scans/00000000-0000-4000-8000-000000000009/a.jpg')).resolves.toBe('https://media.example.com/scans/00000000-0000-4000-8000-000000000009/a.jpg');
    await expect(r2.resolveMediaUrl('https://legacy.example/a.jpg')).resolves.toBe('https://legacy.example/a.jpg');
    await expect(r2.resolveMediaUrl(null)).resolves.toBeNull();

    if (original === undefined) delete process.env.R2_PUBLIC_BASE_URL;
    else process.env.R2_PUBLIC_BASE_URL = original;
    if (originalPrivate === undefined) delete process.env.R2_BUCKET_PRIVATE;
    else process.env.R2_BUCKET_PRIVATE = originalPrivate;
  });

  test('resolveMediaUrl menandatangani scan saat R2_BUCKET_PRIVATE diatur', async () => {
    const original = process.env.R2_BUCKET_PRIVATE;
    process.env.R2_BUCKET_PRIVATE = 'ifishy-private';
    process.env.R2_ACCOUNT_ID = 'test-account';
    process.env.R2_ACCESS_KEY_ID = 'test-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret';

    await expect(r2.resolveMediaUrl('scans/00000000-0000-4000-8000-000000000009/a.jpg'))
      .resolves.toBe('https://signed.example/ifishy-private/scans/00000000-0000-4000-8000-000000000009/a.jpg');
    expect(r2.isScanPrivate()).toBe(true);

    if (original === undefined) delete process.env.R2_BUCKET_PRIVATE;
    else process.env.R2_BUCKET_PRIVATE = original;
  });
});
