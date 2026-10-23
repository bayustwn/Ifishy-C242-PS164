const { assertPublicHttpUrl, isPrivateIp, isBlockedHostname } = require('../urlSafety');

const lookupPublic = async () => [{ address: '93.184.216.34', family: 4 }];

describe('isPrivateIp', () => {
  test.each([
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '198.18.0.1',
    '203.0.113.10',
    '0.0.0.0',
    '255.255.255.255',
    '::',
    '::1',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'ff02::1',
    '2001:db8::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::7f00:1',
  ])('blokir %s', (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  test.each(['8.8.8.8', '93.184.216.34', '2606:4700:4700::1111'])('izinkan %s', (ip) => {
    expect(isPrivateIp(ip)).toBe(false);
  });
});

describe('isBlockedHostname', () => {
  test.each(['localhost', 'app.localhost', 'printer.local', 'metadata.google.internal', 'host.internal', 'x.home.arpa'])(
    'blokir %s',
    (host) => expect(isBlockedHostname(host)).toBe(true)
  );

  test('izinkan domain publik', () => {
    expect(isBlockedHostname('contoh.com')).toBe(false);
  });
});

describe('assertPublicHttpUrl', () => {
  test('URL publik dengan DNS publik diizinkan', async () => {
    const url = await assertPublicHttpUrl('https://contoh.com/artikel', { lookup: lookupPublic });
    expect(url.toString()).toBe('https://contoh.com/artikel');
  });

  test('DNS privat ditolak', async () => {
    await expect(assertPublicHttpUrl('https://contoh.com', {
      lookup: async () => [{ address: '10.1.2.3', family: 4 }],
    })).rejects.toMatchObject({ code: 'UNSAFE_URL' });
  });

  test.each([
    'file:///etc/passwd',
    'ftp://contoh.com/file',
    'http://localhost/',
    'http://127.0.0.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[::7f00:1]/',
    'http://contoh.com:8080/',
    'http://user:pass@contoh.com/',
  ])('tolak %s', async (value) => {
    await expect(assertPublicHttpUrl(value, { lookup: lookupPublic })).rejects.toMatchObject({ code: 'UNSAFE_URL' });
  });
});
