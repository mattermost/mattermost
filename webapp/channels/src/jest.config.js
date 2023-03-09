// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/** @type {import('jest').Config} */

const config = {
    snapshotSerializers: ['enzyme-to-json/serializer'],
    testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
    clearMocks: true,
    collectCoverageFrom: [
        'actions/**/*.{js,jsx,ts,tsx}',
        'client/**/*.{js,jsx,ts,tsx}',
        'components/**/*.{jsx,tsx}',
        'plugins/**/*.{js,jsx,ts,tsx}',
        'reducers/**/*.{js,jsx,ts,tsx}',
        'routes/**/*.{js,jsx,ts,tsx}',
        'selectors/**/*.{js,jsx,ts,tsx}',
        'stores/**/*.{js,jsx,ts,tsx}',
        'utils/**/*.{js,jsx,ts,tsx}',
        '!e2e/**',
    ],
    coverageReporters: ['lcov', 'text-summary'],
    moduleNameMapper: {
        '^@mattermost/(components)$': '<rootDir>/packages/$1/src',
        '^@mattermost/(client)$': '<rootDir>/packages/$1/src',
        '^@mattermost/(types)/(.*)$': '<rootDir>/packages/$1/src/$2',
        '^mattermost-redux/test/(.*)$':
            '<rootDir>/packages/mattermost-redux/test/$1',
        '^mattermost-redux/(.*)$': '<rootDir>/packages/mattermost-redux/src/$1',
        '^reselect$': '<rootDir>/packages/reselect/src',
        '^.+\\.(jpg|jpeg|png|apng|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
            'identity-obj-proxy',
        '^.+\\.(css|less|scss)$': 'identity-obj-proxy',
        '^.*i18n.*\\.(json)$': '<rootDir>/tests/i18n_mock.json',
        '^bundle-loader\\?lazy\\!(.*)$': '$1',
    },
    moduleDirectories: ['', 'node_modules'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    reporters: [
        'default',
        ['jest-junit', {outputDirectory: 'build', outputName: 'test-results.xml'}],
    ],
    transformIgnorePatterns: [
        'node_modules/(?!react-native|react-router|p-queue|p-timeout|@mattermost/compass-components|@mattermost/compass-icons)',
    ],
    setupFiles: ['jest-canvas-mock'],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    testEnvironment: 'jsdom',
    testTimeout: 60000,
    testURL: 'http://localhost:8065',
    watchPlugins: [
        'jest-watch-typeahead/filename',
        'jest-watch-typeahead/testname',
    ],
};

module.exports = config;
