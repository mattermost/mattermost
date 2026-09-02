// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

import base from './base.js';

const react = {
    files: ['**/*.jsx', '**/*.tsx'],
    rules: {
        '@stylistic/jsx-closing-bracket-location': [
            2,
            {
                location: 'tag-aligned',
            },
        ],
        '@stylistic/jsx-curly-spacing': [
            2,
            'never',
        ],
        '@stylistic/jsx-equals-spacing': [
            2,
            'never',
        ],
        '@stylistic/jsx-first-prop-new-line': [
            2,
            'multiline',
        ],
        '@stylistic/jsx-indent-props': [
            2,
            4,
        ],
        '@stylistic/jsx-max-props-per-line': [
            2,
            {
                maximum: 1,
            },
        ],
        '@stylistic/jsx-pascal-case': 2,
        '@stylistic/jsx-tag-spacing': [
            2,
            {
                closingSlash: 'never',
                beforeSelfClosing: 'never',
                afterOpening: 'never',
            },
        ],
        '@stylistic/jsx-wrap-multilines': 2,
        'jsx-a11y/alt-text': 'warn',
        'jsx-a11y/anchor-has-content': 'error',
        'jsx-a11y/anchor-is-valid': 'warn',
        'jsx-a11y/aria-activedescendant-has-tabindex': 'error',
        'jsx-a11y/aria-props': 'error',
        'jsx-a11y/aria-proptypes': 'error',
        'jsx-a11y/aria-role': 'error',
        'jsx-a11y/aria-unsupported-elements': 'error',
        'jsx-a11y/autocomplete-valid': 'error',
        'jsx-a11y/click-events-have-key-events': 'warn',
        'jsx-a11y/heading-has-content': 'error',
        'jsx-a11y/html-has-lang': 'error',
        'jsx-a11y/iframe-has-title': 'error',
        'jsx-a11y/img-redundant-alt': 'warn',
        'jsx-a11y/interactive-supports-focus': 'warn',
        'jsx-a11y/label-has-associated-control': 'error',
        'jsx-a11y/media-has-caption': 'warn',
        'jsx-a11y/mouse-events-have-key-events': 'off',
        'jsx-a11y/no-access-key': 'error',
        'jsx-a11y/no-aria-hidden-on-focusable': 'error',
        'jsx-a11y/no-autofocus': 'warn',
        'jsx-a11y/no-distracting-elements': 'error',
        'jsx-a11y/no-interactive-element-to-noninteractive-role': 'error',
        'jsx-a11y/no-noninteractive-element-interactions': 'warn',
        'jsx-a11y/no-noninteractive-element-to-interactive-role': 'warn',
        'jsx-a11y/no-noninteractive-tabindex': 'warn',
        'jsx-a11y/no-redundant-roles': 'warn',
        'jsx-a11y/no-static-element-interactions': 'warn',
        'jsx-a11y/role-has-required-aria-props': 'warn',
        'jsx-a11y/role-supports-aria-props': 'warn',
        'jsx-a11y/scope': 'error',
        'jsx-a11y/tabindex-no-positive': 'warn',
        'react/display-name': [
            0,
            {
                ignoreTranspilerName: false,
            },
        ],
        'react/forbid-component-props': 0,
        'react/forbid-elements': [
            2,
            {
                forbid: [
                    'embed',
                ],
            },
        ],
        'react/jsx-boolean-value': [
            2,
            'always',
        ],
        'react/jsx-filename-extension': [
            2,
            {
                extensions: [
                    '.jsx',
                    '.tsx',
                ],
            },
        ],
        'react/jsx-handler-names': 0,
        'react/jsx-key': 2,
        'react/jsx-no-bind': 0,
        'react/jsx-no-comment-textnodes': 2,
        'react/jsx-no-duplicate-props': [
            2,
            {
                ignoreCase: false,
            },
        ],
        'react/jsx-no-literals': 2,
        'react/jsx-no-target-blank': 2,
        'react/jsx-no-undef': 2,
        'react/jsx-uses-react': 2,
        'react/jsx-uses-vars': 2,
        'react/no-array-index-key': 1,
        'react/no-children-prop': 2,
        'react/no-danger': 0,
        'react/no-danger-with-children': 2,
        'react/no-deprecated': 1,
        'react/no-did-mount-set-state': 2,
        'react/no-did-update-set-state': 2,
        'react/no-direct-mutation-state': 2,
        'react/no-find-dom-node': 1,
        'react/no-is-mounted': 2,
        'react/no-multi-comp': [
            2,
            {
                ignoreStateless: true,
            },
        ],
        'react/no-render-return-value': 2,
        'react/no-set-state': 0,
        'react/no-string-refs': 2,
        'react/no-unescaped-entities': 2,
        'react/no-unknown-property': [
            2,
            {
                ignore: ['mask-type'],
            },
        ],
        'react/no-unused-prop-types': [
            1,
            {
                skipShapeProps: true,
            },
        ],
        'react/prefer-es6-class': 2,
        'react/prefer-stateless-function': 0,
        'react/prop-types': 2,
        'react/require-default-props': 0,
        'react/require-optimization': 1,
        'react/require-render-return': 2,
        'react/self-closing-comp': 2,
        'react/sort-comp': 0,
        'react/style-prop-object': 2,
    },
};

export default [
    ...base,
    jsxA11yPlugin.flatConfigs.recommended,
    reactPlugin.configs.flat.recommended,
    reactHooksPlugin.configs.flat.recommended,
    react,
    {

        // Disable new rules that are primarily needed to enable React Compiler because we're not using that yet
        rules: {
            'react-hooks/immutability': 0,
            'react-hooks/preserve-manual-memoization': 0,
            'react-hooks/purity': 0,
            'react-hooks/refs': 0,
            'react-hooks/set-state-in-effect': 0,

            // This rule can be enabled once https://github.com/mattermost/mattermost/pull/36575 is merged because it
            // should be done by converting getChannelIconComponent and getArchiveIconComponent to proper components
            // instead of functions that return component constructors.
            'react-hooks/static-components': 0,
        },
    },
    {
        settings: {
            react: {
                pragma: 'React',
                version: 'detect',
            },
        },
    },
];
