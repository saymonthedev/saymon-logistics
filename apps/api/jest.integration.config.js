/**
 * Integration tests: hit a real Postgres database (DATABASE_URL) to exercise
 * row-level locking and DB constraints that a mocked Prisma client can't prove.
 * Run `docker-compose up -d db` (or a local Postgres) before running these.
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'test',
  testRegex: '.*\\.int-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  testTimeout: 30000,
  setupFiles: ['dotenv/config'],
};
