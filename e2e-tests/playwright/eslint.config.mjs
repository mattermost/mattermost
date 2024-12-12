import typescriptEslint from '@typescript-eslint/eslint-plugin';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import js from '@eslint/js';
import {FlatCompat} from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

export default [
    {
        ignores: ['**/node_modules', '**/playwright-report', '**/test-results', '**/results'],
    },
    ...compat.extends('eslint:recommended', 'plugin:@typescript-eslint/recommended').map((config) => ({
        ...config,
        files: ['**/*.ts', '**/*.s'],
    })),
    {
        files: ['**/*.ts', '**/*.s'],
        plugins: {
            '@typescript-eslint': typescriptEslint,
        },
        languageOptions: {
            globals: {
                ...globals.node,
            },
            parser: tsParser,
            ecmaVersion: 5,
            sourceType: 'module',
        },
        rules: {
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-var-requires': 'off',
            'no-console': 'error',
        },
    },
];
