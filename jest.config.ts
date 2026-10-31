/** Jest configuration for Write Outreach */
export default {
  testEnvironment: 'node',
  preset: 'ts-jest',
  // Transform all .ts files using ts-jest
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  // Ignore node_modules and dist
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Test match patterns
  testMatch: ['**/test/**/*.test.ts', '**/src/**/*.test.ts'],
  // Collect coverage
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.guard.ts',
  ],
};