module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  coverageThreshold: {
    global: { statements: 85, branches: 70, functions: 85, lines: 85 },
  },
};
