// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/** @type {import('jest').Config} */

module.exports = {
    moduleNameMapper: {
        '^@mattermost/(client)$': '<rootDir>/../platform/$1/src',
        '^@mattermost/(types)/(.*)$': '<rootDir>/../platform/$1/src/$2',
    },
    setupFiles: ['<rootDir>/setup_jest.ts'],
};
