/**
 * ESLint config for the LEI API.
 *
 * Beyond normal linting this file mechanically enforces two of the three
 * architectural rules from the design package. They are enforced by tooling
 * rather than by code review because both erode silently otherwise:
 *
 *   1. Controllers must never touch Prisma directly.
 *   2. Cross-module table access goes through services, not raw queries.
 *
 * The third rule (every non-public route is permission-guarded) cannot be
 * expressed as a lint rule — it is a boot-time assertion in
 * src/common/guards/route-coverage.assertion.ts instead.
 */
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['plugin:@typescript-eslint/recommended'],
  root: true,
  env: { node: true, jest: true },
  ignorePatterns: ['.eslintrc.cjs', 'dist', 'node_modules', 'coverage'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    'no-console': ['error', { allow: ['warn', 'error'] }],
    eqeqeq: ['error', 'always', { null: 'ignore' }],

    // ── Architectural rule 1 ────────────────────────────────────────────
    // PrismaService is reachable only from the repository layer. Everything
    // else goes through a module service.
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@prisma/client',
            importNames: ['PrismaClient'],
            message:
              'Do not instantiate PrismaClient. Inject PrismaService inside a *.repository.ts file.',
          },
        ],
        patterns: [
          {
            group: ['**/prisma/prisma.service', '**/prisma/prisma.service.js'],
            message:
              'PrismaService may only be injected in *.repository.ts files. Controllers and services must go through a repository.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      // The repository layer, the Prisma module itself, seeds and tests are
      // the only places allowed to reach the database client directly.
      files: [
        '**/*.repository.ts',
        'src/prisma/**/*.ts',
        'src/health/**/*.ts',
        'prisma/**/*.ts',
        '**/*.spec.ts',
      ],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
    {
      // Controllers are HTTP adapters. They may not contain business logic and
      // must not import repositories either.
      files: ['**/*.controller.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/*.repository', '**/prisma/prisma.service'],
                message:
                  'Controllers must call a module service. Repositories and PrismaService are not reachable from the HTTP layer.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['prisma/**/*.ts'],
      rules: { 'no-console': 'off' },
    },
  ],
};
