import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // Ignore build output and dependencies
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.js', '*.config.ts'],
  },

  // Base JavaScript recommended rules
  js.configs.recommended,

  // TypeScript recommended rules
  ...tseslint.configs.recommendedTypeChecked,

  // Main configuration
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      import: importPlugin,
    },
    rules: {
      // === Console ===
      // Allow console for frontend debugging
      'no-console': 'off',

      // === TypeScript ===
      // Disallow explicit any (common in API parsing)
      '@typescript-eslint/no-explicit-any': 'error',

      // Enforce type-only imports
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],

      // Relax unsafe any operations
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',

      // Remove redundant type assertions
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',

      // Surface unnecessary checks for later cleanup
      '@typescript-eslint/no-unnecessary-condition': 'warn',

      // Allow non-null assertion (developer knows better)
      '@typescript-eslint/no-non-null-assertion': 'off',

      // Strict Promise handling (best practice)
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/require-await': 'error',

      // Prefer unknown for catch callback
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'warn',

      // Allow flexible template expressions
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allowNumber: true,
          allowBoolean: true,
          allowAny: false,
          allowNullish: true,
        },
      ],

      // Let TypeScript handle unused vars (noUnusedLocals: true)
      '@typescript-eslint/no-unused-vars': 'off',

      // Don't require explicit return types (type inference is good)
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      // === Code Quality ===
      // Enforce === and !==
      eqeqeq: ['error', 'always'],

      // Prefer const
      'prefer-const': 'error',

      // No var
      'no-var': 'error',

      // No fallthrough in switch
      'no-fallthrough': 'error',

      // === Import Order ===
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling'],
            'type',
            'object',
          ],
          'newlines-between': 'never',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],

      // Ensure imports are valid
      'import/no-unresolved': 'off', // TypeScript handles this
    },
  },

  // Disable formatting rules (handled by Prettier)
  eslintConfigPrettier
);
