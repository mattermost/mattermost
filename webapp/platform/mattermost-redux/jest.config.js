// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/** @type {import('jest').Config} */

module.exports = {
    clearMocks: true,
    moduleNameMapper: {
        '^@mattermost/types/(.*)$': '<rootDir>/../types/src/$1',
        '^mattermost-redux/(.*)$': '<rootDir>/src/$1',
        '^.+\\.(jpg|jpeg|png|apng|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
            'identity-obj-proxy',
        '^.+\\.(css|less|scss)$': 'identity-obj-proxy',
        '^.*i18n.*\\.(json)$': '<rootDir>/../../channels/src/tests/i18n_mock.json',
    },
    // setupFilesAfterEnv: ['<rootDir>/test/setup_jest.ts'],
    // testEnvironment: 'jsdom',
};
