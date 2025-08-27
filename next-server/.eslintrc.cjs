module.exports = {
  root: true,
  extends: ['next/core-web-vitals', 'plugin:react/recommended'],
  plugins: ['react', 'react-hooks', '@next/next', '@typescript-eslint'],
  settings: {
    react: { version: 'detect' },
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: null,
        ecmaFeatures: { jsx: true },
      },
      plugins: ['@typescript-eslint'],
      extends: [
        'plugin:@typescript-eslint/recommended',
      ],
      rules: {
        // Relax common TS rules for API routes and mixed JS/TS interop
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
      },
    },
  ],
  rules: {
    // customize rules as needed
  },
};
