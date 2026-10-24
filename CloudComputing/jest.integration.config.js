module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.integration.test.js'],
  testTimeout: 30000,
  maxWorkers: 1,
};
