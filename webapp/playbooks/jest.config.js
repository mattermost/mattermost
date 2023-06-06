// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/** @type {import('jest').Config} */

const config = {
    moduleDirectories: ['src', 'node_modules'],
    moduleNameMapper: {
        '^@mattermost/(components)$': '<rootDir>/../platform/$1/src',
        '^@mattermost/(client)$': '<rootDir>/../platform/$1/src',
        '^@mattermost/(types)/(.*)$': '<rootDir>/../platform/$1/src/$2',
        '^mattermost-redux/(.*)$': '<rootDir>/../channels/src/packages/mattermost-redux/src/$1',
        '^src/(.*)$': '<rootDir>/src/$1',
    },
    testEnvironment: 'jsdom',
};

module.exports = config;