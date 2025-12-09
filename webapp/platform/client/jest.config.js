// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/** @type {import('jest').Config} */

module.exports = {
    moduleNameMapper: {
        '^@mattermost/types/(.*)$': '<rootDir>/../types/src/$1',
    },
    setupFiles: ['<rootDir>/setup_jest.ts'],
    transform: {
        '^.+\\.(js|jsx|ts|tsx|mjs)$': ['@swc/jest', {
            jsc: {
                parser: {
                    syntax: 'typescript',
                    tsx: true,
                },
                transform: {
                    react: {
                        runtime: 'automatic',
                    },
                },
            },
            module: {
                type: 'commonjs',
                noInterop: false,
                strict: false,
                strictMode: false,
            },
        }],
    },
};
