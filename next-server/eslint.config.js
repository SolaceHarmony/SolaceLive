import js from '@eslint/js'
import reactPlugin from 'eslint-plugin-react'
import hooksPlugin from 'eslint-plugin-react-hooks'
import nextPlugin from '@next/eslint-plugin-next'

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
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
  { ignores: ['.next/*', 'node_modules/'] },
]
