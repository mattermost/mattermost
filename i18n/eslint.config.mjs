// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The translation pipeline is plain Node, outside the webapp, so it takes the
// webapp's base rules without the React ones. Its scripts are commands, which
// report on the console and through their exit status. Run from this directory,
// after installing the webapp's dependencies: ../webapp/node_modules/.bin/eslint .
import eslintPlugin from '../webapp/platform/eslint-plugin/index.js';

export default [
    ...eslintPlugin.configs.base,
    {
        languageOptions: {
            ecmaVersion: 'latest',
        },
        rules: {
            'no-console': 0,
            'no-process-exit': 0,
            '@stylistic/multiline-ternary': [1, 'always-multiline'],
        },
    },
];
