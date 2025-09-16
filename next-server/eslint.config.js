import js from '@eslint/js'
import reactPlugin from 'eslint-plugin-react'
import hooksPlugin from 'eslint-plugin-react-hooks'
import nextPlugin from '@next/eslint-plugin-next'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
  parserOptions: { ecmaFeatures: { jsx: true } },
  globals: { process: 'readonly', console: 'readonly', module: 'readonly', __dirname: 'readonly' },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': hooksPlugin,
      '@next/next': nextPlugin,
    },
    rules: {
      ...(reactPlugin.configs && reactPlugin.configs.recommended ? reactPlugin.configs.recommended.rules : {}),
      ...(hooksPlugin.configs && hooksPlugin.configs.recommended ? hooksPlugin.configs.recommended.rules : {}),
      ...(nextPlugin.configs && nextPlugin.configs.recommended ? nextPlugin.configs.recommended.rules : {}),
      ...(nextPlugin.configs && nextPlugin.configs['core-web-vitals'] ? nextPlugin.configs['core-web-vitals'].rules : {}),
    },
    settings: { react: { version: 'detect' } },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tsParser,
  parserOptions: { ecmaFeatures: { jsx: true } },
  globals: { process: 'readonly', console: 'readonly', module: 'readonly', __dirname: 'readonly' },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
  { ignores: ['.next/**', 'node_modules/**', 'experiments/**', 'examples/**', 'dist/**'] },
]
