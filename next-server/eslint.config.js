import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import hooksPlugin from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

const commonGlobals = {
  process: 'readonly',
  console: 'readonly',
  module: 'readonly',
  __dirname: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  WebSocket: 'readonly',
  MessageEvent: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  window: 'readonly',
  navigator: 'readonly',
  document: 'readonly',
  fetch: 'readonly',
  AudioContext: 'readonly',
  MediaStreamAudioSourceNode: 'readonly',
  ScriptProcessorNode: 'readonly',
  MediaRecorder: 'readonly',
  Blob: 'readonly',
  MediaStream: 'readonly',
  cancelAnimationFrame: 'readonly',
  requestAnimationFrame: 'readonly',
  URL: 'readonly',
  NodeJS: 'readonly',
  HTMLCanvasElement: 'readonly',
  CanvasRenderingContext2D: 'readonly',
  JSX: 'readonly',
  sampleRate: 'readonly',
  AudioWorkletProcessor: 'readonly',
  currentFrame: 'readonly',
  currentTime: 'readonly',
  registerProcessor: 'readonly',
  performance: 'readonly',
  Window: 'readonly',
  HTMLDivElement: 'readonly',
};

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: commonGlobals,
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
      'react/react-in-jsx-scope': 'off',
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
      globals: commonGlobals,
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'experiments/**',
      'examples/**',
      'dist/**',
      'lib/unified/archive/**',
      'lib/unified/audio/whisperx/**',
      'lib/unified/wasm/**',
      'scripts/**',
    ],
  },
];
