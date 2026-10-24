const { validateEnv, REQUIRED } = require('../env');

describe('validateEnv', () => {
  test('env lengkap → true', () => {
    expect(validateEnv({ JWT_SECRET: 's', DATABASE_URL: 'postgresql://x' })).toBe(true);
  });

  test('env kosong → melempar ENV_INVALID berisi daftar variabel', () => {
    let caught;
    try {
      validateEnv({});
    } catch (error) {
      caught = error;
    }
    expect(caught.code).toBe('ENV_INVALID');
    for (const key of REQUIRED) expect(caught.message).toContain(key);
  });

  test('nilai spasi dianggap kosong', () => {
    expect(() => validateEnv({ JWT_SECRET: '   ', DATABASE_URL: 'postgresql://x' })).toThrow(/JWT_SECRET/);
  });
});
