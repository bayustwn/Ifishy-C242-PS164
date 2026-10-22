const REQUIRED = ['JWT_SECRET', 'DATABASE_URL'];

const validateEnv = (env = process.env) => {
  const missing = REQUIRED.filter((key) => !env[key] || !String(env[key]).trim());
  if (missing.length) {
    const error = new Error(`Missing required environment variables: ${missing.join(', ')}`);
    error.code = 'ENV_INVALID';
    throw error;
  }
  return true;
};

module.exports = { validateEnv, REQUIRED };
