const r2 = require('../r2');

describe('r2 key helpers', () => {
  test('buildKey memakai prefix purpose, userId, dan ekstensi dari contentType', () => {
    const key = r2.buildKey('post', 9, 'image/jpeg');
    expect(key).toMatch(/^posts\/9\/[0-9a-f-]{36}\.jpg$/);
  });

  test('buildKey menolak contentType yang tidak didukung', () => {
    expect(() => r2.buildKey('post', 9, 'application/pdf')).toThrow('Unsupported upload type');
  });

  test('parseKey memetakan purpose dan userId', () => {
    expect(r2.parseKey('scans/12/abc.jpg')).toEqual({
      purpose: 'scan', userId: 12, filename: 'abc', ext: 'jpg',
    });
  });

  test('parseKey menolak key dengan path traversal atau format asing', () => {
    expect(r2.parseKey('../etc/passwd')).toBeNull();
    expect(r2.parseKey('scans/12/../x.jpg')).toBeNull();
    expect(r2.parseKey('scans/12/x.jpg?x=1')).toBeNull();
  });

  test('isOwnedKey hanya cocok untuk purpose dan userId yang sama', () => {
    expect(r2.isOwnedKey('posts/9/a.png', 'post', 9)).toBe(true);
    expect(r2.isOwnedKey('posts/9/a.png', 'post', 10)).toBe(false);
    expect(r2.isOwnedKey('posts/9/a.png', 'avatars', 9)).toBe(false);
    expect(r2.isOwnedKey(null, 'post', 9)).toBe(false);
  });

  test('publicUrl meneruskan URL lama dan menyusun URL dari key', () => {
    const original = process.env.R2_PUBLIC_BASE_URL;
    delete process.env.R2_PUBLIC_BASE_URL;
    expect(r2.publicUrl('http://localhost:9080/uploads/a.png')).toBe('http://localhost:9080/uploads/a.png');
    expect(r2.publicUrl('posts/9/a.png')).toBe('posts/9/a.png');

    process.env.R2_PUBLIC_BASE_URL = 'https://media.example.com/';
    expect(r2.publicUrl('posts/9/a.png')).toBe('https://media.example.com/posts/9/a.png');

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

  test('resolveMediaUrl memakai URL publik untuk semua purpose, termasuk scan', () => {
    const original = process.env.R2_PUBLIC_BASE_URL;
    process.env.R2_PUBLIC_BASE_URL = 'https://media.example.com';
    expect(r2.resolveMediaUrl('scans/12/a.jpg')).toBe('https://media.example.com/scans/12/a.jpg');
    expect(r2.resolveMediaUrl('https://legacy.example/a.jpg')).toBe('https://legacy.example/a.jpg');
    expect(r2.resolveMediaUrl(null)).toBeNull();

    if (original === undefined) delete process.env.R2_PUBLIC_BASE_URL;
    else process.env.R2_PUBLIC_BASE_URL = original;
  });
});
