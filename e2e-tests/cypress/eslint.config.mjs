import typescriptEslint from '@typescript-eslint/eslint-plugin';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import js from '@eslint/js';
import {FlatCompat} from '@eslint/eslintrc';
import eslintPluginHeader from 'eslint-plugin-header';
import pluginCypress from 'eslint-plugin-cypress';
import noOnlyTest from 'eslint-plugin-no-only-tests';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

eslintPluginHeader.rules.header.meta.schema = false;

export default [
    {
        ignores: ['**/node_modules', '**/logs', '**/results'],
    },
    ...compat
        .extends('eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:import/recommended')
        .map((config) => ({
            ...config,
            files: ['**/*.ts', '**/*.js'],
        })),
    {
        files: ['**/*.ts', '**/*.js'],
        plugins: {
            '@typescript-eslint': typescriptEslint,
            header: eslintPluginHeader,
            cypress: pluginCypress,
            'no-only-tests': noOnlyTest,
        },
        languageOptions: {
            globals: {
                ...globals.node,
            },
            parser: tsParser,
            ecmaVersion: 5,
            sourceType: 'module',
        },
        settings: {
            'import/resolver': {
                node: true,
            },
        },
        rules: {
            'cypress/assertion-before-screenshot': 'warn',
            'cypress/no-assigning-return-values': 'error',
            'cypress/no-force': 'off',
            'cypress/no-async-tests': 'error',
            'cypress/no-pause': 'error',
            'cypress/no-unnecessary-waiting': 0,
            'cypress/unsafe-to-chain-command': 0,
            'func-names': 0,
            'import/no-unresolved': 0,
            'max-nested-callbacks': 0,
            'no-unused-expressions': 0,
            'no-process-env': 0,
            'no-duplicate-imports': 0,
            'no-undefined': 0,
            'no-use-before-define': 0,
            'no-only-tests/no-only-tests': ['error', {'focus': ['only']}],
            'no-console': 'error',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-unused-expressions': 'off',
            '@typescript-eslint/no-var-requires': 'off',
            'header/header': [
                'error',
                'line',
                ' Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.\n See LICENSE.txt for license information.',
                2,
            ],
            'import/no-duplicates': 2,
            'import/order': [
                'error',
                {
                    'newlines-between': 'always',
                    groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
                },
            ],
            'import/no-unresolved': 'off',
            'max-lines': ['warn', {'max': 800, 'skipBlankLines': true, 'skipComments': true}],
            'eol-last': ['error', 'always'],
            'no-trailing-spaces': 'error',
        },
    },
];
