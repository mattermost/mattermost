// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/** @type {import('jest').Config} */

const config = {
    snapshotSerializers: ['enzyme-to-json/serializer'],
    testPathIgnorePatterns: ['/node_modules/'],
    clearMocks: true,
    collectCoverageFrom: [
        'actions/src/**/*.{js,jsx,ts,tsx}',
        'client/src/**/*.{js,jsx,ts,tsx}',
        'components/src/**/*.{jsx,tsx}',
        'plugins/src/**/*.{js,jsx,ts,tsx}',
        'reducers/src/**/*.{js,jsx,ts,tsx}',
        'routes/src/**/*.{js,jsx,ts,tsx}',
        'selectors/src/**/*.{js,jsx,ts,tsx}',
        'stores/src/**/*.{js,jsx,ts,tsx}',
        'utils/src/**/*.{js,jsx,ts,tsx}',
    ],
    coverageReporters: ['lcov', 'text-summary'],
    moduleNameMapper: {
        '^@mattermost/(components)$': '<rootDir>/../platform/$1/src',
        '^@mattermost/(client)$': '<rootDir>/../platform/$1/src',
        '^@mattermost/(types)/(.*)$': '<rootDir>/../platform/$1/src/$2',
        '^mattermost-redux/test/(.*)$':
            '<rootDir>/src/packages/mattermost-redux/test/$1',
        '^mattermost-redux/(.*)$': '<rootDir>/src/packages/mattermost-redux/src/$1',
        '^.+\\.(jpg|jpeg|png|apng|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
            'identity-obj-proxy',
        '^.+\\.(css|less|scss)$': 'identity-obj-proxy',
        '^.*i18n.*\\.(json)$': '<rootDir>/src/tests/i18n_mock.json',
        '^bundle-loader\\?lazy\\!(.*)$': '$1',
    },
    moduleDirectories: ['src', 'node_modules'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    reporters: [
        'default',
        ['jest-junit', {outputDirectory: 'build', outputName: 'test-results.xml'}],
    ],
    transformIgnorePatterns: [
        'node_modules/(?!react-native|react-router|p-queue|p-timeout|@mattermost/compass-components|@mattermost/compass-icons)',
    ],
    setupFiles: ['jest-canvas-mock'],
    setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],
    testEnvironment: 'jsdom',
    testTimeout: 60000,
    testURL: 'http://localhost:8065',
    watchPlugins: [
        'jest-watch-typeahead/filename',
        'jest-watch-typeahead/testname',
    ],
};

module.exports = config;
