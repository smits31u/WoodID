const { FlatCompat } = require('@eslint/eslintrc');
const prettierConfig = require('eslint-config-prettier');

const compat = new FlatCompat({ baseDirectory: __dirname });

module.exports = [
  ...compat.extends('expo'),
  prettierConfig,
  {
    ignores: ['dist/*', 'eslint.config.js'],
  },
];
