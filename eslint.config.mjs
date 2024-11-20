// eslint.config.js

import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    files: ['**/*.js'],
    ignores: ['node_modules/**'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        // Add other globals if needed
      },
    },
    plugins: {
      // Add plugins if needed
    },
    rules: {
      // Your custom rules
      // For example:
      'no-unused-vars': 'warn',
      'no-console': 'off',
    },
  },
];
