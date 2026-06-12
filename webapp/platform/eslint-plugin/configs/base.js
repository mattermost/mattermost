// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';
import {fileURLToPath} from 'url';

import {FlatCompat} from '@eslint/eslintrc';
import js from '@eslint/js';
import stylisticPlugin from '@stylistic/eslint-plugin';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import headersPlugin from 'eslint-plugin-headers';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

import rules from '../rules/index.js';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const compat = new FlatCompat({
    baseDirectory: dirname,
});

const base = {
    files: ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.ts', '**/*.tsx'],
    languageOptions: {
        ecmaVersion: 8,
        globals: {
            ...globals.browser,
            ...globals.node,
            ...globals.es6,
        },
        parser: typescriptParser,
        parserOptions: {
            ecmaFeatures: {
                jsx: true,
                impliedStrict: true,
                modules: true,
            },
        },
        sourceType: 'module',
    },
    plugins: {
        '@mattermost': {
            rules,
        },
        '@stylistic': stylisticPlugin,
        typescript: typescriptPlugin,
        headers: headersPlugin,
        import: importPlugin,
    },
    rules: {
        '@mattermost/no-dispatch-getstate': 2,
        '@mattermost/use-external-link': 2,
        '@stylistic/array-bracket-spacing': [
            2,
            'never',
        ],
        '@stylistic/arrow-parens': [
            2,
            'always',
        ],
        '@stylistic/arrow-spacing': [
            2,
            {
                before: true,
                after: true,
            },
        ],
        '@stylistic/brace-style': [
            2,
            '1tbs',
            {
                allowSingleLine: false,
            },
        ],
        '@stylistic/comma-dangle': [
            2,
            'always-multiline',
        ],
        '@stylistic/comma-spacing': [
            2,
            {
                before: false,
                after: true,
            },
        ],
        '@stylistic/comma-style': [
            2,
            'last',
        ],
        '@stylistic/computed-property-spacing': [
            2,
            'never',
        ],
        '@stylistic/dot-location': [
            2,
            'object',
        ],
        '@stylistic/eol-last': ['error', 'always'],
        '@stylistic/function-call-spacing': [
            2,
            'never',
        ],
        '@stylistic/generator-star-spacing': [
            2,
            {
                before: false,
                after: true,
            },
        ],
        '@stylistic/indent': [
            2,
            4,
            {
                SwitchCase: 0,
            },
        ],
        '@stylistic/jsx-quotes': [
            2,
            'prefer-single',
        ],
        '@stylistic/key-spacing': [
            2,
            {
                beforeColon: false,
                afterColon: true,
                mode: 'strict',
            },
        ],
        '@stylistic/keyword-spacing': [
            2,
            {
                before: true,
                after: true,
                overrides: {},
            },
        ],
        '@stylistic/linebreak-style': 2,
        '@stylistic/lines-around-comment': [
            2,
            {
                beforeBlockComment: true,
                beforeLineComment: true,
                allowBlockStart: true,
                allowBlockEnd: true,
            },
        ],
        '@stylistic/max-statements-per-line': [
            2,
            {
                max: 1,
            },
        ],
        '@stylistic/member-delimiter-style': 2,
        '@stylistic/multiline-ternary': [
            1,
            'never',
        ],
        '@stylistic/new-parens': 2,
        '@stylistic/no-confusing-arrow': 2,
        '@stylistic/no-extra-parens': 0,
        '@stylistic/no-extra-semi': 2,
        '@stylistic/no-floating-decimal': 2,
        '@stylistic/no-mixed-operators': [
            2,
            {
                allowSamePrecedence: false,
            },
        ],
        '@stylistic/no-mixed-spaces-and-tabs': 2,
        '@stylistic/no-multi-spaces': [
            2,
            {
                exceptions: {
                    Property: false,
                },
            },
        ],
        '@stylistic/no-multiple-empty-lines': [
            2,
            {
                max: 1,
            },
        ],
        '@stylistic/no-tabs': 0,
        '@stylistic/no-trailing-spaces': [
            2,
            {
                skipBlankLines: false,
            },
        ],
        '@stylistic/no-whitespace-before-property': 2,
        '@stylistic/object-curly-newline': 0,
        '@stylistic/object-curly-spacing': [
            2,
            'never',
        ],
        '@stylistic/object-property-newline': [
            2,
            {
                allowMultiplePropertiesPerLine: true,
            },
        ],
        '@stylistic/one-var-declaration-per-line': 0,
        '@stylistic/operator-linebreak': [
            2,
            'after',
        ],
        '@stylistic/padded-blocks': [
            2,
            'never',
        ],
        '@stylistic/quote-props': [
            2,
            'as-needed',
        ],
        '@stylistic/quotes': [
            2,
            'single',
            'avoid-escape',
        ],
        '@stylistic/rest-spread-spacing': [
            2,
            'never',
        ],
        '@stylistic/semi': [
            2,
            'always',
        ],
        '@stylistic/semi-spacing': [
            2,
            {
                before: false,
                after: true,
            },
        ],
        '@stylistic/space-before-blocks': [
            2,
            'always',
        ],
        '@stylistic/space-before-function-paren': [
            2,
            {
                anonymous: 'never',
                named: 'never',
                asyncArrow: 'always',
            },
        ],
        '@stylistic/space-in-parens': [
            2,
            'never',
        ],
        '@stylistic/space-infix-ops': 2,
        '@stylistic/space-unary-ops': [
            2,
            {
                words: true,
                nonwords: false,
            },
        ],
        '@stylistic/template-curly-spacing': [
            2,
            'never',
        ],
        '@stylistic/type-annotation-spacing': 2,
        '@stylistic/wrap-iife': [
            2,
            'outside',
        ],
        '@stylistic/wrap-regex': 2,
        '@typescript-eslint/array-type': [2, {default: 'array-simple'}],
        '@typescript-eslint/consistent-type-imports': ['error', {disallowTypeAnnotations: false}],
        '@typescript-eslint/explicit-function-return-type': 0,
        '@typescript-eslint/explicit-module-boundary-types': 0,
        '@typescript-eslint/naming-convention': [
            2,
            {
                selector: 'function',
                format: ['camelCase', 'PascalCase'],
            },
            {
                selector: 'variable',
                format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
            },
            {
                selector: 'parameter',
                format: ['camelCase', 'PascalCase'],
                leadingUnderscore: 'allow',
            },
            {
                selector: 'typeLike',
                format: ['PascalCase'],
            },
        ],
        '@typescript-eslint/no-dupe-class-members': 2,
        '@typescript-eslint/no-empty-function': 0,
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-unused-vars': [
            2,
            {
                vars: 'all',
                args: 'after-used',
            },
        ],
        '@typescript-eslint/no-use-before-define': [
            2,
            {
                classes: false,
                functions: false,
                variables: false,
            },
        ],
        '@typescript-eslint/no-var-requires': 0,
        'array-callback-return': 2,
        'arrow-body-style': 0,
        'block-scoped-var': 2,
        'capitalized-comments': 0,
        'class-methods-use-this': 0,
        complexity: [
            0,
            10,
        ],
        'consistent-return': 2,
        'consistent-this': [
            2,
            'self',
        ],
        'constructor-super': 2,
        curly: [
            2,
            'all',
        ],
        'dot-notation': 2,
        eqeqeq: [
            2,
            'smart',
        ],
        'func-name-matching': 0,
        'func-names': 2,
        'func-style': [
            2,
            'declaration',
            {
                allowArrowFunctions: true,
            },
        ],
        'global-require': 2,
        'guard-for-in': 2,
        'headers/header-format': [
            'error',
            {
                source: 'string',
                style: 'line',
                content: 'Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.\nSee LICENSE.txt for license information.',
                trailingNewlines: 2,
            },
        ],
        'id-blacklist': 0,
        'import/no-duplicates': 2,
        'import/no-unresolved': 0, // Handled better by TS
        'import/order': [
            2,
            {
                'newlines-between': 'always',
                groups: [
                    'builtin',
                    'external',
                    'internal',
                    'sibling',
                    'parent',
                    'index',
                ],
                pathGroups: [
                    {
                        pattern: '@mattermost/**',
                        group: 'external',
                        position: 'after',
                    },
                    {
                        pattern: 'mattermost-redux/**',
                        group: 'external',
                        position: 'after',
                    },
                    {
                        pattern: '@(selectors|actions|stores|store|reducers){,/**}',
                        group: 'external',
                        position: 'after',
                    },
                    {
                        pattern: 'components/**',
                        group: 'external',
                        position: 'after',
                    },
                    {
                        pattern: 'types{,/**}',
                        group: 'internal',
                        position: 'after',
                    },
                ],
                alphabetize: {
                    order: 'asc',
                    caseInsensitive: true,
                },
                distinctGroup: true,
                pathGroupsExcludedImportTypes: ['builtin'],
            },
        ],
        'line-comment-position': 0,
        'max-lines': [
            'warn',
            {
                max: 800,
                skipBlankLines: true,
                skipComments: false,
            },
        ],
        'max-nested-callbacks': ['error', 10],
        'new-cap': 2,
        'newline-before-return': 0,
        'newline-per-chained-call': 0,
        'no-alert': 2,
        'no-array-constructor': 2,
        'no-await-in-loop': 2,
        'no-caller': 2,
        'no-case-declarations': 2,
        'no-class-assign': 2,
        'no-compare-neg-zero': 2,
        'no-cond-assign': [
            2,
            'except-parens',
        ],
        'no-console': 2,
        'no-const-assign': 2,
        'no-constant-binary-expression': 2,
        'no-constant-condition': 2,
        'no-debugger': 2,
        'no-div-regex': 2,
        'no-dupe-args': 2,
        'no-dupe-class-members': 0, // Handled by @typescript-eslint/no-dupe-class-members
        'no-dupe-keys': 2,
        'no-duplicate-case': 2,
        'no-duplicate-imports': 0, // Handled by import/no-duplicates
        'no-else-return': 2,
        'no-empty': 2,
        'no-empty-function': 0,
        'no-empty-pattern': 2,
        'no-eval': 2,
        'no-ex-assign': 2,
        'no-extend-native': 2,
        'no-extra-bind': 2,
        'no-extra-label': 2,
        'no-fallthrough': 2,
        'no-func-assign': 2,
        'no-global-assign': 2,
        'no-implicit-coercion': 2,
        'no-implicit-globals': 0,
        'no-implied-eval': 2,
        'no-inner-declarations': 0,
        'no-invalid-regexp': 2,
        'no-irregular-whitespace': 2,
        'no-iterator': 2,
        'no-labels': 2,
        'no-lone-blocks': 2,
        'no-lonely-if': 2,
        'no-loop-func': 2,
        'no-magic-numbers': 0,
        'no-multi-assign': 2,
        'no-multi-str': 0,
        'no-native-reassign': 2,
        'no-negated-condition': 2,
        'no-nested-ternary': 2,
        'no-new': 2,
        'no-new-func': 2,
        'no-new-object': 2,
        'no-new-symbol': 2,
        'no-new-wrappers': 2,
        'no-octal-escape': 2,
        'no-param-reassign': 2,
        'no-process-env': 2,
        'no-process-exit': 2,
        'no-proto': 2,
        'no-prototype-builtins': 2,
        'no-restricted-imports': [
            'error',
            {
                paths: [
                    {
                        name: 'redux',
                        importNames: ['DeepPartial'],
                        message: 'Use DeepPartial from @mattermost/types/utilities instead.',
                    },
                    {
                        name: 'lodash',
                        message: 'Import individual functions from lodash/<function> instead.',
                    },
                ],
            },
        ],
        'no-return-assign': [
            2,
            'always',
        ],
        'no-return-await': 2,
        'no-script-url': 2,
        'no-self-assign': [
            2,
            {
                props: true,
            },
        ],
        'no-self-compare': 2,
        'no-sequences': 2,
        'no-shadow': 0, // This isn't currently enabled, but it probably should be
        'no-shadow-restricted-names': 2,
        'no-template-curly-in-string': 2,
        'no-ternary': 0,
        'no-this-before-super': 2,
        'no-throw-literal': 2,
        'no-undef-init': 2,
        'no-undefined': 0,
        'no-underscore-dangle': 2,
        'no-unexpected-multiline': 2,
        'no-unmodified-loop-condition': 2,
        'no-unneeded-ternary': [
            2,
            {
                defaultAssignment: false,
            },
        ],
        'no-unreachable': 2,
        'no-unsafe-finally': 2,
        'no-unsafe-negation': 2,
        'no-unused-expressions': 2,
        'no-unused-vars': 0, // Handled by @typescript-eslint/no-unused-vars
        'no-use-before-define': 0, // Handled by @typescript-eslint/no-use-before-define
        'no-useless-computed-key': 2,
        'no-useless-concat': 2,
        'no-useless-constructor': 2,
        'no-useless-escape': 2,
        'no-useless-rename': 2,
        'no-useless-return': 2,
        'no-var': 0,
        'no-void': 2,
        'no-warning-comments': 1,
        'no-with': 2,
        'object-shorthand': [
            2,
            'always',
        ],
        'one-var': [
            2,
            'never',
        ],
        'operator-assignment': [
            2,
            'always',
        ],
        'prefer-arrow-callback': 2,
        'prefer-const': 2,
        'prefer-destructuring': 0,
        'prefer-numeric-literals': 2,
        'prefer-promise-reject-errors': 2,
        'prefer-rest-params': 2,
        'prefer-spread': 2,
        'prefer-template': 0,
        radix: 2,
        'require-yield': 2,
        'sort-imports': 0,
        'sort-keys': 0,
        'symbol-description': 2,
        'valid-typeof': [
            2,
            {
                requireStringLiterals: false,
            },
        ],
        'vars-on-top': 0,
        yoda: [
            2,
            'never',
            {
                exceptRange: false,
                onlyEquality: false,
            },
        ],
    },
};

const testOverrides = {
    files: ['**/*.test.js', '**/*.test.jsx', '**/*.test.ts', '**/*.test.tsx', 'src/tests/**'],
    languageOptions: {
        globals: {
            after: true,
            afterAll: true,
            afterEach: true,
            before: true,
            beforeAll: true,
            beforeEach: true,
            describe: true,
            expect: true,
            it: true,
            jest: true,
            test: true,
        },
    },
    rules: {
        'func-names': 0,
        'global-require': 0,
        'no-console': 0,
        'no-import-assign': 0,
        'max-lines': 0,
        'max-nested-callbacks': 0,
        'new-cap': 0,
        'prefer-arrow-callback': 0,
    },
};

export default [
    js.configs.recommended,
    ...compat.extends('plugin:@typescript-eslint/recommended'),
    stylisticPlugin.configs['disable-legacy'],
    base,
    testOverrides,
];
